#!/usr/bin/env node
/**
 * Verifica el proxy de predicciones contra un despliegue real (o el dev server).
 *
 *   node scripts/verify-predictions-proxy.mjs                       # producción
 *   node scripts/verify-predictions-proxy.mjs --base http://127.0.0.1:8080
 *   PREDICTIONS_BASE=https://… node scripts/verify-predictions-proxy.mjs
 *
 * Comprueba, por cada venue:
 *   - que la respuesta es 200 y NO un 5xx (el 502/500 es el fallo a cazar),
 *   - de qué camino salió (`x-aitor-egress: direct|reader`),
 *   - el peso de la respuesta (Vercel corta en 4,5 MB),
 *   - que llegan eventos con opciones apostadas reales (precio por opción).
 *
 * Y para Polymarket, además, las opciones completas de un evento por `slug`.
 *
 * Exit != 0 si algo falla, así que sirve tal cual en CI o en un runbook.
 */

const DEFAULT_BASE = "https://aitor.alienflow.space";
const VERCEL_RESPONSE_LIMIT = 4.5 * 1024 * 1024;
const VENUES = ["polymarket", "kalshi", "limitless"];

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const base = (argValue("--base") ?? process.env.PREDICTIONS_BASE ?? DEFAULT_BASE).replace(/\/+$/, "");
const limit = Number(argValue("--limit") ?? 15);
const timeoutMs = Number(argValue("--timeout") ?? 45_000);

let failures = 0;
const fail = (label, detail) => {
  failures++;
  console.error(`  ✘ ${label}`, detail ?? "");
};
const pass = (label, detail) => console.log(`  ✔ ${label}`, detail ?? "");

async function getJson(path) {
  const url = `${base}${path}`;
  const started = Date.now();
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return {
    url,
    status: res.status,
    egress: res.headers.get("x-aitor-egress"),
    reportedBytes: res.headers.get("x-aitor-bytes"),
    bytes: Buffer.byteLength(text),
    ms: Date.now() - started,
    body,
    head: text.slice(0, 160),
  };
}

/** Formas que devuelve cada venue, resumidas a "cuántas filas". */
function summarize(venue, body) {
  if (venue === "kalshi") {
    const events = Array.isArray(body?.events) ? body.events : [];
    const markets = events.flatMap((event) => (Array.isArray(event?.markets) ? event.markets : []));
    return { rows: events.length, options: markets.length, title: events[0]?.title ?? null };
  }
  if (venue === "limitless") {
    const rows = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
    const markets = rows.filter((row) => Array.isArray(row?.prices) && row.prices.length >= 2);
    return { rows: rows.length, options: markets.length, title: rows[0]?.title ?? null };
  }
  const events = Array.isArray(body) ? body : Array.isArray(body?.events) ? body.events : [];
  const markets = events.flatMap((event) => (Array.isArray(event?.markets) ? event.markets : []));
  const withPrices = markets.filter((m) => Array.isArray(m?.outcomePrices) || m?.outcomePrices);
  return {
    rows: events.length,
    options: withPrices.length,
    markets,
    title: events[0]?.title ?? null,
    eventSlug: events[0]?.slug ?? null,
  };
}

function parsePriceList(raw) {
  if (Array.isArray(raw)) return raw.map(Number);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(Number) : [];
    } catch {
      return [];
    }
  }
  return [];
}

console.log(`Proxy de predicciones · base ${base} · limit ${limit}\n`);

let polymarketSlug = null;

for (const venue of VENUES) {
  console.log(`${venue}:`);
  let response;
  try {
    response = await getJson(`/api/predictions?venue=${venue}&limit=${limit}`);
  } catch (error) {
    fail("la petición no llegó a completarse", error instanceof Error ? error.message : String(error));
    continue;
  }

  const meta = `HTTP ${response.status} · ${(response.bytes / 1024).toFixed(0)} KB · ${response.ms} ms · egress ${response.egress ?? "—"}`;
  if (response.status === 200) pass("200 OK", meta);
  else if (response.status === 502) fail("502 del proxy (ningún camino sirvió)", meta + ` · ${response.head}`);
  else if (response.status >= 500) fail(`${response.status} (la función murió, no es un bloqueo del venue)`, meta + ` · ${response.head}`);
  else fail(`HTTP ${response.status}`, meta + ` · ${response.head}`);

  if (response.bytes > VERCEL_RESPONSE_LIMIT) {
    fail("la respuesta no cabe en Vercel (4,5 MB): el despliegue devolvería 500", `${(response.bytes / 1024 / 1024).toFixed(2)} MB`);
  }

  if (response.status !== 200) continue;

  const summary = summarize(venue, response.body);
  if (summary.rows > 0) pass(`${summary.rows} filas con ${summary.options} opciones apostadas`, summary.title ?? "");
  else fail("la respuesta llegó vacía o con otra forma", response.head);

  if (venue === "polymarket") {
    // El evento se pide por SU slug: el slug del mercado no resuelve en Gamma.
    polymarketSlug = summary.eventSlug ?? null;
    const first = summary.markets?.find((m) => m?.slug);
    const prices = parsePriceList(first?.outcomePrices);
    if (prices.length) pass("precios reales por opción", prices.slice(0, 4).join(" · "));
    else if (response.body) fail("ninguna opción trae outcomePrices", first?.slug);
    const volume = Number(first?.volume24hr ?? 0);
    const liquidity = Number(first?.liquidityNum ?? first?.liquidity ?? 0);
    if (volume > 0 || liquidity > 0) pass("volumen/liquidez por opción", `vol24h ${volume} · liq ${liquidity}`);
    else fail("sin volumen ni liquidez por opción", first?.slug);
  }
}

if (polymarketSlug) {
  console.log(`\npolymarket · opciones completas de "${polymarketSlug}":`);
  try {
    const legs = await getJson(`/api/predictions?venue=polymarket&slug=${encodeURIComponent(polymarketSlug)}`);
    const event = Array.isArray(legs.body) ? legs.body[0] : null;
    const options = Array.isArray(event?.markets) ? event.markets.length : 0;
    if (legs.status === 200) pass("200 OK", `HTTP ${legs.status} · ${(legs.bytes / 1024).toFixed(0)} KB · egress ${legs.egress ?? "—"}`);
    else fail(`HTTP ${legs.status} al pedir el evento`, legs.head);
    if (options > 0) pass(`${options} opciones en el evento`);
    else fail("el evento no trae opciones", legs.head);
  } catch (error) {
    fail("la petición por slug no se completó", error instanceof Error ? error.message : String(error));
  }
}

if (failures > 0) {
  console.error(`\n${failures} comprobación(es) fallida(s) contra ${base}`);
  process.exit(1);
}
console.log(`\nTodo pasa contra ${base}: ningún 5xx, Polymarket sirve opciones reales por el proxy.`);
