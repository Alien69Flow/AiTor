// Refreshes `public/data/war-gov-uap.json`, the snapshot of the UAP records the
// U.S. Department of War publishes at https://www.war.gov/ufo/ .
//
// Why a build-time snapshot and not a browser fetch: the page publishes its
// index as a single CSV that the browser cannot read cross-origin (no CORS
// header on the asset), and the HTML page itself refuses non-browser clients
// with a 403. Downloading it here — once per build — keeps the anomaly registry
// fed with the official releases without a proxy, and the committed JSON is
// what the visitor actually loads.
//
// Run it any time:  npm run sync:war-gov
// A network failure keeps the previous snapshot in place, so it is safe to run
// from `prebuild`.
//
// Nothing is invented: every field below comes from a CSV column. The release
// date is the date an agency *published* the record (that is the news), and the
// incident date stays in its own field so a 1957 report is not mistaken for a
// 2026 event.

import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PAGE = "https://www.war.gov/ufo/";
/** The index the page itself loads. No cache-buster: the plain URL is current. */
const CSV_URL = "https://www.war.gov/Portals/1/Interactive/2026/UFO/uap-data.csv";

/** The site answers 403 to clients that do not look like a browser. */
const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  accept: "text/csv,application/json;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  referer: PAGE,
};

/** Fewer rows than this means the answer was not the index we asked for. */
const MIN_RECORDS = 100;
/** Card text is read, not stored: the full blurb of a long memo is 1 200 chars. */
const BLURB_LIMIT = 260;

const outPath = resolve(dirname(fileURLToPath(import.meta.url)), "../public/data/war-gov-uap.json");

/** RFC-4180 reader: the blurbs contain quoted commas and line breaks. */
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
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.some((cell) => cell !== "")) rows.push(row);
  }
  return rows;
}

const clean = (value) => (value ?? "").replace(/\s+/g, " ").trim();

/** `10/23/2026` → `2026-10-23`; anything else is left null instead of guessed. */
function toIsoDate(raw) {
  const value = clean(raw);
  const slash = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!slash) return null;
  const [, month, day, year] = slash.map(Number);
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Cut at a word boundary: a blurb chopped mid-word reads like a bug. */
function truncate(text, limit) {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).replace(/[,;:.]$/, "")}…`;
}

function slug(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

/** The document type as the registry shows it, from the `Type` column. */
function typeLabel(raw) {
  switch (clean(raw).toUpperCase()) {
    case "PDF":
      return "PDF oficial";
    case "VID":
      return "Vídeo oficial";
    case "AUD":
      return "Audio oficial";
    case "IMG":
      return "Imagen oficial";
    default:
      return "Registro oficial";
  }
}

/**
 * The link the card opens: the document itself when the record carries one,
 * otherwise the DoD video, otherwise the page that lists the file. Never a
 * guessed URL.
 */
function sourceUrl(row) {
  const document = clean(row[13]);
  if (/^https:\/\//.test(document)) return document;
  const video = clean(row[8]);
  if (video) return `https://www.dvidshub.net/video/${video}`;
  const image = clean(row[14]);
  if (/^https:\/\//.test(image)) return image;
  return PAGE;
}

/**
 * Multi-place incidents arrive separated by a pipe ("Ladakh, Nepal | Sikkim,
 * India"); the registry is a list, not a table, so the separator becomes a
 * middot that reads in a sentence.
 */
function normalizeLocation(raw) {
  const value = clean(raw).replace(/\s*\|\s*/g, " · ");
  if (!value || /^n\/?a$/i.test(value)) return null;
  return value;
}

function collectRecords(text) {
  const rows = parseCsv(text);
  const header = rows[0].map((cell) => clean(cell).toLowerCase());
  const index = (name) => header.indexOf(name.toLowerCase());

  const col = {
    featured: index("Featured"),
    release: index("Release Date"),
    title: index("Title"),
    type: index("Type"),
    blurb: index("Description Blurb"),
    video: index("DVIDS Video ID"),
    agency: index("Agency"),
    incident: index("Incident Date"),
    location: index("Incident Location"),
    document: index("PDF | Image Link"),
    image: index("Modal Image"),
  };

  if (col.title < 0 || col.release < 0) {
    throw new Error(`el CSV no tiene las columnas esperadas (cabecera: ${rows[0].slice(0, 6).join(", ")})`);
  }

  const pick = (row, key) => (col[key] >= 0 ? row[col[key]] ?? "" : "");

  const seen = new Set();
  const records = [];
  const skipped = [];

  for (const row of rows.slice(1)) {
    const title = clean(pick(row, "title"));
    const release = toIsoDate(pick(row, "release"));
    if (!title) {
      skipped.push("sin título");
      continue;
    }
    if (!release) {
      skipped.push(`${title.slice(0, 40)}: fecha de entrega ilegible`);
      continue;
    }

    const key = `${release}|${title}`;
    if (seen.has(key)) {
      skipped.push(`${title.slice(0, 40)}: repetido`);
      continue;
    }
    seen.add(key);

    records.push({
      id: `wargov-${slug(title) || records.length}`,
      release,
      title: truncate(title, 200),
      type: typeLabel(pick(row, "type")),
      agency: clean(pick(row, "agency")) || null,
      incident: clean(pick(row, "incident")) || null,
      location: normalizeLocation(pick(row, "location")),
      featured: clean(pick(row, "featured")).toLowerCase() === "yes",
      blurb: truncate(clean(pick(row, "blurb")), BLURB_LIMIT) || null,
      url: sourceUrl(row),
    });
  }

  records.sort((a, b) => b.release.localeCompare(a.release) || a.title.localeCompare(b.title));
  return { records, skipped };
}

async function loadDataset() {
  const response = await fetch(CSV_URL, { headers: HEADERS, signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`${new URL(CSV_URL).host} → HTTP ${response.status}`);
  const text = await response.text();
  const { records, skipped } = collectRecords(text);
  if (records.length < MIN_RECORDS) {
    throw new Error(`${new URL(CSV_URL).host} → ${records.length} registros en ${text.length} bytes`);
  }
  return { records, skipped, bytes: text.length };
}

function summarize(records) {
  const releases = new Map();
  const agencies = new Map();
  for (const record of records) {
    releases.set(record.release, (releases.get(record.release) ?? 0) + 1);
    if (record.agency) agencies.set(record.agency, (agencies.get(record.agency) ?? 0) + 1);
  }
  return {
    releases: [...releases.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, count]) => ({ date, count })),
    agencies: [...agencies.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
  };
}

async function build() {
  const { records, skipped, bytes } = await loadDataset();
  const { releases, agencies } = summarize(records);

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "war.gov/ufo — Departamento de Guerra de EE. UU.",
    sourceUrl: PAGE,
    datasetUrl: CSV_URL,
    total: records.length,
    latestRelease: releases[0]?.date ?? null,
    earliestRelease: releases.at(-1)?.date ?? null,
    releases,
    agencies,
    bytesRead: bytes,
    records,
  };

  writeFileSync(outPath, `${JSON.stringify(payload)}\n`);

  console.log(
    `war.gov snapshot: ${records.length} registros en ${releases.length} entregas ` +
      `(${payload.earliestRelease} → ${payload.latestRelease}), ${agencies.length} agencias ` +
      `(${Math.round(bytes / 1024)} KB leídos) → ${outPath}`,
  );
  if (skipped.length) {
    console.warn(`⚠️  ${skipped.length} fila(s) descartadas: ${skipped.slice(0, 5).join("; ")}`);
  }
}

try {
  await build();
} catch (error) {
  // Keep the committed snapshot rather than failing the dev server or build.
  if (existsSync(outPath)) {
    const previous = JSON.parse(readFileSync(outPath, "utf8"));
    console.warn(
      `war.gov snapshot: no se pudo actualizar (${String(error).slice(0, 200)}); se mantiene el del ${previous.generatedAt} con ${previous.total} registros`,
    );
  } else {
    console.warn(`war.gov snapshot: no se pudo generar (${String(error).slice(0, 200)})`);
  }
}
