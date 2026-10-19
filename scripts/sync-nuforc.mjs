// Refreshes `public/data/nuforc-recent.json`, the snapshot of recent NUFORC
// reports shown in the Alien tab.
//
// Why a build-time snapshot: the open mirror is a 19.7 MB CSV, and browsers
// refuse a JS-set `Range` header (Chromium: TypeError: Failed to fetch), so a
// browser cannot ask for just the newest bytes. Node can, so the tail of the
// file — the mirror is sorted ascending by sighting date — is fetched here and
// the newest reports are committed as a small JSON asset.
//
// Run it any time:  npm run sync:nuforc
// A network failure keeps the previous snapshot in place, so it is safe to
// wire into hooks.

import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MIRROR =
  "https://cdn.jsdelivr.net/gh/DataHerb/nuforc-ufo-records@master/dataset/nuforc_ufo_records.csv";
const MIRROR_PAGE = "https://github.com/DataHerb/nuforc-ufo-records";
const OFFICIAL = "https://nuforc.org/";
/** Newest reports live in the tail; ~2 MB covers several years. */
const TAIL_BYTES = 2 * 1024 * 1024;
const KEEP = 300;
/** Fewer records than this means the answer was not the CSV we asked for. */
const MIN_RECORDS = 50;
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

/** `4/8/20 22:44` / `04/08/2020 22:44` / `2020-04-08 22:44` → `YYYY-MM-DD`. */
function toIsoDate(raw) {
  const value = (raw ?? "").trim();
  if (!value) return null;

  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const slash = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s|$)/);
  if (!slash) return null;
  const month = Number(slash[1]);
  const day = Number(slash[2]);
  const yearRaw = slash[3];
  const year = yearRaw.length === 2 ? 2000 + Number(yearRaw) : Number(yearRaw);
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

/** Sorted, deduplicated reports parsed out of the tail of the CSV. */
function collectRecords(text) {
  // A ranged answer starts mid-file, so the first (torn) line is dropped. A
  // full download starts with the CSV header, which the filter below discards.
  const body = text.startsWith(HEADER_PREFIX) ? text : text.slice(text.indexOf("\n") + 1);

  const seen = new Set();
  const records = [];

  for (const cells of parseCsv(body)) {
    if (cells.length < 7) continue;
    const [when, city, state, country, shape, duration, summary] = cells;
    const date = toIsoDate(when);
    if (!date) continue;

    // The mirror repeats the country when a city has no state ("Liverpool,
    // United Kingdom, United Kingdom"), so collapsed duplicates are dropped.
    const parts = [city, state, country].map((part) => (part ?? "").trim()).filter(Boolean);
    const location = parts.filter((part, index) => index === 0 || part !== parts[index - 1]).join(", ");
    if (!location) continue;

    const description = (summary ?? "").trim();
    const durationText = (duration ?? "").trim();
    if (!description && !durationText) continue;

    const key = `${date}|${location}|${description.slice(0, 60)}`;
    if (seen.has(key)) continue;
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
  return records;
}

/**
 * The newest `TAIL_BYTES` of the dataset, obtained the hard way:
 *  1. a ranged request (cheap) — but some CDN edges slice the range out of the
 *     *compressed* stream, which comes back as binary, so the result is always
 *     validated before it is trusted;
 *  2. a full download (≈6.5 MB brotli, well under a second) as the fallback.
 */
async function loadTail() {
  try {
    const ranged = await fetch(MIRROR, {
      headers: { Range: `bytes=-${TAIL_BYTES}` },
      signal: AbortSignal.timeout(60_000),
    });
    if (ranged.ok) {
      const text = await ranged.text();
      if (collectRecords(text).length >= MIN_RECORDS) return text;
    }
  } catch {
    // fall through to the full download
  }

  const full = await fetch(MIRROR, { signal: AbortSignal.timeout(120_000) });
  if (!full.ok) throw new Error(`mirror answered ${full.status}`);
  const text = await full.text();
  return text.slice(-TAIL_BYTES);
}

async function build() {
  const text = await loadTail();
  const records = collectRecords(text);
  // Anything that does not look like the dataset (HTML error page, compressed
  // range, rate limit) would silently empty the registry, so it is an error:
  // build() then keeps the previous snapshot instead of overwriting it.
  if (records.length < MIN_RECORDS) {
    throw new Error(`only ${records.length} parseable records in ${text.length} bytes`);
  }

  const kept = records.slice(0, KEEP);

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "NUFORC (espejo abierto DataHerb)",
    sourceUrl: MIRROR_PAGE,
    officialUrl: OFFICIAL,
    totalInTail: records.length,
    dateFrom: kept.at(-1)?.date ?? null,
    dateTo: kept[0]?.date ?? null,
    records: kept,
  };

  writeFileSync(outPath, `${JSON.stringify(payload, null, 0)}\n`);
  console.log(
    `nuforc snapshot: ${kept.length} registros (${payload.dateFrom} → ${payload.dateTo}) → ${outPath}`,
  );
}

try {
  await build();
} catch (error) {
  // Keep the committed snapshot rather than failing the dev server or build.
  if (existsSync(outPath)) {
    const previous = JSON.parse(readFileSync(outPath, "utf8"));
    console.warn(
      `nuforc snapshot: no se pudo actualizar (${String(error).slice(0, 120)}); se mantiene el del ${previous.generatedAt}`,
    );
  } else {
    console.warn(`nuforc snapshot: no se pudo generar (${String(error).slice(0, 120)})`);
  }
}
