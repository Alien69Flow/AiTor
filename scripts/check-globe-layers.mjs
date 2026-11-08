#!/usr/bin/env node
/**
 * Auditoría de las capas raster del globo contra sus servidores reales.
 *
 * No forma parte del build: se ejecuta a mano (o antes de desplegar) para
 * comprobar que **cada capa de la leyenda que pinta un ráster responde con una
 * imagen de verdad**. Es la comprobación que faltaba cuando el globo tenía la
 * leyenda llena de capas que en realidad devolvían 404/500.
 *
 * Uso:  node scripts/check-globe-layers.mjs
 * Sale con código 1 si alguna capa falla.
 */
import { readFileSync } from "node:fs";

/** Origen con el que el proxy de OpenWeather acepta peticiones de teselas. */
const APP_ORIGIN = "https://aitor.alienflow.space";

const src = readFileSync("src/lib/globe-layers.ts", "utf8");
// Objetos separados por salto de línea, más los que se declaran en la misma
// línea (`},\t{`): con el patrón anterior, `wind` caía dentro del bloque de
// `isobars` y la auditoría nunca llegaba a probarlo.
const blocks = src.split(/\n\t\{|\},\t\{/).slice(1);

const gibs = [];
const owm = [];
for (const block of blocks) {
  const key = /key:\s*"([A-Za-z]+)"/.exec(block)?.[1];
  if (!key) continue;
  const group = /group:\s*"([^"]+)"/.exec(block)?.[1] ?? "—";
  const g = /gibs:\s*\{([^}]+)\}/.exec(block)?.[1];
  if (g) {
    gibs.push({
      key,
      group,
      layer: /layer:\s*"([^"]+)"/.exec(g)?.[1],
      level: Number(/level:\s*(\d+)/.exec(g)?.[1]),
      offset: Number(/dateOffsetHours:\s*(\d+)/.exec(g)?.[1] ?? 36),
      timeless: /timeless:\s*true/.test(g),
      date: /date:\s*"([^"]+)"/.exec(g)?.[1] ?? null,
    });
  }
  const o = /owm:\s*"([^"]+)"/.exec(block)?.[1];
  if (o) owm.push({ key, group, tile: o });
}

const day = (hours) => new Date(Date.now() - hours * 3600 * 1000).toISOString().slice(0, 10);

async function head(url, headers) {
  // GIBS devuelve 500 sueltos (una tesela de cada tantas, sobre todo en los
  // niveles bajos). Un solo 500 no significa que la capa esté rota, así que se
  // reintenta una vez antes de darla por caída.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(25_000) });
      const buf = await r.arrayBuffer();
      const result = { status: r.status, type: r.headers.get("content-type"), bytes: buf.byteLength };
      if (result.status < 500 || attempt === 1) return result;
    } catch (error) {
      if (attempt === 1) return { status: 0, type: null, bytes: 0, error: String(error) };
    }
    await new Promise((resolve) => setTimeout(resolve, 900));
  }
  return { status: 0, type: null, bytes: 0 };
}

/** El proxy vive en el mismo Supabase que sirve los datos del globo. */
function owmProxyUrl() {
  const client = readFileSync("src/integrations/supabase/client.ts", "utf8");
  const hardcoded = /https:\/\/([a-z]+)\.supabase\.co/.exec(client)?.[1];
  const fromEnv = process.env.VITE_DATA_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const host = fromEnv ? new URL(fromEnv).hostname.split(".")[0] : hardcoded;
  if (!host) throw new Error("No encuentro el proyecto de Supabase al que apuntan las teselas");
  return `https://${host}.supabase.co/functions/v1/openweather`;
}

let failed = 0;
const record = (ok, extra = false) => {
  if (!ok) failed += 1;
  return ok ? (extra ? "AVISO" : "OK  ") : "FALLO";
};

console.log(`Capas raster declaradas — GIBS: ${gibs.length} · OWM: ${owm.length}\n`);

for (const g of gibs) {
  const time = g.timeless ? "" : `${g.date ?? day(g.offset)}/`;
  const base = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${g.layer}/default/${time}GoogleMapsCompatible_Level${g.level}`;
  const r = await head(`${base}/3/3/4.png`);
  // Sonda polar: la misma capa pedida sobre el Ártico (z=2, esquina 1/0).
  // Comparar estos bytes con los de la tesela de referencia separa «la capa
  // está rota» de «la capa existe pero no tiene datos en esa parte del mundo».
  const polar = await head(`${base}/2/1/0.png`);
  const isImage = Boolean(r.type?.startsWith("image")) && r.status === 200;
  const empty = isImage && r.bytes < 1_500;
  const polarImage = Boolean(polar.type?.startsWith("image")) && polar.status === 200;
  const polarEmpty = polarImage && polar.bytes < 1_500;
  const esPolar = /Sea_Ice|Snow_Cover|Ice_Surface/i.test(g.layer);
  const nota = esPolar ? (polarEmpty ? " · polo vacío" : " · polo con datos") : "";
  console.log(
    `${record(isImage, empty)} ${g.key.padEnd(20)} ${String(r.status).padStart(3)} ${String(r.bytes).padStart(6)}B  ${time || "(sin fecha)"}  ${g.layer}` +
      `\n      ${" ".repeat(20)} polo ${String(polar.status).padStart(3)} ${String(polar.bytes).padStart(6)}B${nota}`,
  );
}

const proxy = owmProxyUrl();
for (const o of owm) {
  const r = await head(`${proxy}?tile=${o.tile}&z=4&x=8&y=6`, { origin: APP_ORIGIN });
  const isImage = Boolean(r.type?.startsWith("image")) && r.status === 200;
  console.log(
    `${record(isImage)} ${o.key.padEnd(20)} ${String(r.status).padStart(3)} ${String(r.bytes).padStart(6)}B  ${o.tile}`,
  );
}

console.log(
  failed === 0
    ? `\nTodas las capas raster responden imagen.`
    : `\n${failed} capa(s) sin imagen: la leyenda las anuncia y el globo no las puede pintar.`,
);
process.exit(failed === 0 ? 0 : 1);
