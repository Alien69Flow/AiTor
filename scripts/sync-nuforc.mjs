// Refreshes `public/data/nuforc-recent.json`, the snapshot of NUFORC reports
// shown in the Alien tab.
//
// Why a build-time snapshot: the open mirror is a ~19.7 MB CSV and loading it
// from the browser on every visit is wasteful, so the newest reports are
// parsed here and committed as a small JSON asset.
//
// Why the whole file and not the tail: the old version asked the CDN for the
// last bytes with a `Range` header on the assumption that the mirror was sorted
// ascending and still growing. jsDelivr ignores suffix ranges, some edges slice
// the range out of the compressed stream, and — the part that actually bit —
// the dataset is *frozen*: its newest sighting is 2022-05-12, so "the tail" was
// never the newest reports of a live feed. Downloading the file once and
// sorting it by date is deterministic, and the freshness of the source is
// measured instead of assumed.
//
// Run it any time:  npm run sync:nuforc
// A network failure keeps the previous snapshot in place, so it is safe to
// wire into hooks (it already runs before every build).

import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Raw GitHub first (no CDN cache in the middle), then the CDN as fallback. */
const SOURCES = [
  "https://raw.githubusercontent.com/DataHerb/nuforc-ufo-records/master/dataset/nuforc_ufo_records.csv",
  "https://cdn.jsdelivr.net/gh/DataHerb/nuforc-ufo-records@master/dataset/nuforc_ufo_records.csv",
];
const MIRROR_PAGE = "https://github.com/DataHerb/nuforc-ufo-records";
const MIRROR_API = "https://api.github.com/repos/DataHerb/nuforc-ufo-records/commits?per_page=1";
const OFFICIAL = "https://nuforc.org/";

const KEEP = 300;
/** Fewer records than this means the answer was not the CSV we asked for. */
const MIN_RECORDS = 50;
/** A source that has not grown in this long is reported as frozen. */
const STALE_DAYS = 400;
const HEADER_PREFIX = "Date / Time,";

const outPath = resolve(dirname(fileURLToPath(import.meta.url)), "../public/data/nuforc-recent.json");

/** RFC-4180 reader: reports contain quoted commas and quoted line breaks. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

/**
 * Two-digit years are ambiguous: this archive spans 1900s-2022 and stores them
 * as `yy`, so `99` is 1999 and `25` can be 1925. Guessing with a fixed cut-off
 * is what broke this before — `2000 + yy` invented 20,000 reports dated
 * 2043-2099 that sorted above every real one, and still left `12/28/25` (a 1925
 * report, posted in 2005) as the single newest sighting.
 *
 * So the pivot comes from the data: a sighting cannot postdate the row that
 * reports it. Of the two candidate years, take the newest one that is not later
 * than `pivotYear` (the row's own `Posted` year). `12/28/25` posted `5/11/05`
 * resolves to 1925, `4/8/20` posted `4/9/20` resolves to 2020.
 */
function toIsoDate(raw, pivotYear = new Date().getUTCFullYear()) {
  const value = (raw ?? "").trim();
  if (!value) return null;

  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const slash = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s|$)/);
  if (!slash) return null;
  const month = Number(slash[1]);
  const day = Number(slash[2]);
  const yearRaw = slash[3];
  let year = Number(yearRaw);
  if (yearRaw.length === 2) {
    const candidates = [1900 + year, 2000 + year].filter((candidate) => candidate <= pivotYear);
    year = candidates.length ? Math.max(...candidates) : 2000 + year;
  }
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) return null;
  if (!(year >= 1900 && year <= 2100)) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

const titleCase = (value) =>
  value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");

/** Every parseable report in the file, deduplicated and newest first. */
function collectRecords(text) {
  const body = text.startsWith(HEADER_PREFIX) ? text : text.slice(text.indexOf("\n") + 1);
  const today = new Date().toISOString().slice(0, 10);
  const thisYear = new Date().getUTCFullYear();

  const seen = new Set();
  const records = [];
  let skipped = 0;
  let futureDated = 0;

  for (const cells of parseCsv(body)) {
    if (cells.length < 7) {
      skipped++;
      continue;
    }
    const [when, city, state, country, shape, duration, summary, posted] = cells;
    // The posting date disambiguates the sighting's two-digit year.
    const postedYear = Number((toIsoDate(posted, thisYear) ?? "").slice(0, 4)) || thisYear;
    const date = toIsoDate(when, postedYear);
    if (!date) {
      skipped++;
      continue;
    }
    // Reports cannot come from the future: a handful of rows carry a typo year
    // and would otherwise become the "newest" entries of the snapshot.
    if (date > today) {
      skipped++;
      futureDated++;
      continue;
    }

    // The mirror repeats the country when a city has no state ("Liverpool,
    // United Kingdom, United Kingdom"), so collapsed duplicates are dropped.
    const parts = [city, state, country].map((part) => (part ?? "").trim()).filter(Boolean);
    const location = parts.filter((part, index) => index === 0 || part !== parts[index - 1]).join(", ");
    if (!location) {
      skipped++;
      continue;
    }

    const description = (summary ?? "").trim();
    const durationText = (duration ?? "").trim();
    if (!description && !durationText) {
      skipped++;
      continue;
    }
    // Automated MADAR magnetometer nodes post a placeholder summary ("MADAR
    // Node 163") and no narrative. They are 15% of the newest window, so in
    // practice they would push the actual sightings off the list.
    if (/^madar node \d+$/i.test(description)) {
      skipped++;
      continue;
    }

    const key = `${date}|${location}|${description.slice(0, 60)}`;
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);

    records.push({
      date,
      location,
      shape: (shape ?? "").trim() ? titleCase(shape.trim()) : null,
      duration: durationText || null,
      summary: description.slice(0, 400),
    });
  }

  records.sort((a, b) => b.date.localeCompare(a.date));
  return { records, skipped, futureDated };
}

/** First source that answers with something that parses as the dataset. */
async function loadDataset() {
  const problems = [];
  for (const url of SOURCES) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(180_000) });
      if (!response.ok) {
        problems.push(`${new URL(url).host} → HTTP ${response.status}`);
        continue;
      }
      const text = await response.text();
      const parsed = collectRecords(text);
      if (parsed.records.length < MIN_RECORDS) {
        problems.push(`${new URL(url).host} → ${parsed.records.length} registros en ${text.length} bytes`);
        continue;
      }
      return { ...parsed, url, bytes: text.length };
    } catch (error) {
      problems.push(`${new URL(url).host} → ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`ninguna fuente sirvió el dataset (${problems.join("; ")})`);
}

/** Last commit of the mirror, for provenance. Never fatal. */
async function mirrorUpdatedAt() {
  try {
    const response = await fetch(MIRROR_API, {
      headers: { accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    const [commit] = await response.json();
    return commit?.commit?.committer?.date ?? null;
  } catch {
    return null;
  }
}

const daysBetween = (isoDate, now) => Math.round((now - new Date(`${isoDate}T00:00:00Z`)) / 86_400_000);

async function build() {
  const [{ records, skipped, futureDated, url, bytes }, updatedAt] = await Promise.all([
    loadDataset(),
    mirrorUpdatedAt(),
  ]);

  const kept = records.slice(0, KEEP);
  const datasetLatest = records[0]?.date ?? null;
  const now = new Date();
  const staleDays = datasetLatest ? daysBetween(datasetLatest, now) : null;
  const stale = staleDays === null || staleDays > STALE_DAYS;

  const payload = {
    generatedAt: now.toISOString(),
    source: "NUFORC (espejo abierto DataHerb)",
    sourceUrl: MIRROR_PAGE,
    officialUrl: OFFICIAL,
    datasetUrl: url,
    /** Last commit of the mirror; the data itself can be much older. */
    sourceUpdatedAt: updatedAt,
    /** Newest sighting the dataset contains — the real freshness of the feed. */
    datasetLatest,
    /** Days between the newest record and today. */
    datasetAgeDays: staleDays,
    stale,
    rowsParsed: records.length,
    rowsSkipped: skipped,
    rowsFutureDated: futureDated,
    bytesRead: bytes,
    totalInTail: records.length,
    dateFrom: kept.at(-1)?.date ?? null,
    dateTo: kept[0]?.date ?? null,
    records: kept,
  };

  writeFileSync(outPath, `${JSON.stringify(payload, null, 0)}\n`);

  console.log(
    `nuforc snapshot: ${kept.length} registros (${payload.dateFrom} → ${payload.dateTo}) ` +
      `de ${records.length} filas parseadas (${skipped} descartadas, ${futureDated} con fecha futura, ${Math.round(bytes / 1024)} KB) → ${outPath}`,
  );
  console.log(
    `dataset completo: ${records.at(-1)?.date} → ${datasetLatest} ` +
      "(los años de dos dígitos se resuelven contra la fecha de publicación de cada fila)",
  );
  if (stale) {
    console.warn(
      `⚠️  el dataset de origen está congelado en ${datasetLatest} ` +
        `(${staleDays} días sin datos nuevos; último commit del espejo: ${updatedAt?.slice(0, 10) ?? "desconocido"}). ` +
        "El snapshot se marca como stale y la UI lo dice.",
    );
  }
}

try {
  await build();
} catch (error) {
  // Keep the committed snapshot rather than failing the dev server or build.
  if (existsSync(outPath)) {
    const previous = JSON.parse(readFileSync(outPath, "utf8"));
    console.warn(
      `nuforc snapshot: no se pudo actualizar (${String(error).slice(0, 200)}); se mantiene el del ${previous.generatedAt}`,
    );
  } else {
    console.warn(`nuforc snapshot: no se pudo generar (${String(error).slice(0, 200)})`);
  }
}
