#!/usr/bin/env node
/**
 * Reconstruye el catálogo de plantas de irradiación gamma desde el volcado
 * crudo del fork y publica **solo las filas que se pueden validar**.
 *
 * Por qué hay que reconstruirlo: el volcado (`data/gamma-irradiators-raw.json`)
 * es una descarga de la visualización de Tableau de la IAEA (DIIF). Trae 136
 * pares de coordenadas (primero las 136 latitudes y después las 136 longitudes)
 * pero solo 124 nombres de ciudad **distintos**, así que las dos listas no se
 * pueden unir por índice. La versión derivada del fork lo hizo igualmente y
 * quedó corrida desde la fila 124: a Abuja le puso la latitud de Túnez
 * (36.93 N en vez de 9.04 N) y a Acra la de Abuya.
 *
 * Cómo se reconstruye aquí, sin inventar una sola coordenada:
 *
 *  1. Los pares `(lat, lon)` salen del volcado: la latitud y la longitud de una
 *     fila están en el mismo índice de sus dos bloques. El corte se detecta solo.
 *  2. Cada coordenada se **geolocaliza al revés contra OpenStreetMap**
 *     (Nominatim), que es la fuente administrativa que dice en qué ciudad y en
 *     qué país cae de verdad. Ese es el nombre que se publica.
 *  3. Contraste con la lista de la IAEA: se geocodifican sus topónimos y se
 *     comprueba que la coordenada caiga en un país que la lista menciona y a
 *     qué distancia queda el topónimo declarado más cercano. Una fila cuyo país
 *     no aparece en el listado, o que cae en el mar, se descarta.
 *
 * Uso:  node scripts/build-gamma-irradiators.mjs [--offline]
 *       (--offline usa la caché de scripts/.cache/, sin llamadas de red)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RAW_URL =
  "https://raw.githubusercontent.com/Alien69Flow/worldmonitor/main/data/gamma-irradiators-raw.json";
const CACHE_DIR = path.join(ROOT, "scripts", ".cache");
const CACHE_RAW = path.join(CACHE_DIR, "gamma-raw.json");
const CACHE_PLACES = path.join(CACHE_DIR, "gamma-places.json");
const CACHE_LABELS = path.join(CACHE_DIR, "gamma-labels.json");
const OUT_JSON = path.join(ROOT, "public", "data", "gamma-irradiators.json");
const OUT_TS = path.join(ROOT, "src", "lib", "gamma-irradiators.ts");
const REPORT = path.join(ROOT, "docs", "gamma-irradiators.md");

const USER_AGENT = "aitor-globe/1.0 (+https://aitor.alienflow.space)";
const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";
const GEOCODER = "https://geocoding-api.open-meteo.com/v1/search";

/**
 * Distancia máxima al topónimo declarado más cercano. No es informativa: es el
 * último filtro contra las filas corridas. Cuando el nombre del volcado queda a
 * más de 250 km del punto, ese nombre no describe la coordenada (a la fila
 * irlandesa de «Wesport» le tocó un topónimo a 509 km y a una villa iraní la
 * latitud de Túnez), así que la fila no se publica.
 */
const NEAREST_LABEL_MAX_KM = 250;

/**
 * Nombres del mismo país según quién los escriba. La lista de la IAEA usa
 * «USA», «UK», «Czech Republic» o «Philipinnes» (sic); OpenStreetMap devuelve
 * «United States», «United Kingdom», «Czechia» y «Philippines». Sin esta tabla
 * se descartarían filas válidas por una diferencia de nombre.
 */
const COUNTRY_ALIASES = new Map([
  ["usa", "united states"],
  ["us", "united states"],
  ["united states of america", "united states"],
  ["uk", "united kingdom"],
  ["gb", "united kingdom"],
  ["great britain", "united kingdom"],
  ["czech republic", "czechia"],
  ["czech rep.", "czechia"],
  ["philipinnes", "philippines"],
  ["russian federation", "russia"],
  ["türkiye", "turkey"],
  ["turkiye", "turkey"],
  ["korea, republic of", "south korea"],
  ["republic of korea", "south korea"],
  ["iran, islamic republic of", "iran"],
]);

function normaliseCountry(name) {
  const key = String(name ?? "")
    .trim()
    .toLowerCase();
  return COUNTRY_ALIASES.get(key) ?? key;
}
const EARTH_KM = 6371;

/**
 * Correcciones de escritura del volcado. Solo arreglan el nombre para poder
 * geocodificarlo; no añaden, mueven ni inventan coordenadas.
 */
const NAME_FIXES = new Map([
  ["Northborogh, MA", "Northborough"],
  ["Haw River NC", "Haw River"],
  ["Memphis, AR", "Memphis"],
  ["Grand Prarie, TX", "Grand Prairie"],
  ["Temescula, CA", "Temecula"],
  ["East Sandy, UT", "Sandy"],
  ["Admedabad", "Ahmedabad"],
  ["Wesport", "Westport"],
  ["VEVERSKA BITYSKA", "Veverská Bítýška"],
  ["CHUSCLAN", "Chusclan"],
  ["DAGNEUX", "Dagneux"],
  ["SABLE-SUR-SARTHE", "Sablé-sur-Sarthe"],
  ["POUZAUGES", "Pouzauges"],
  ["CHESTERFIELD", "Chesterfield"],
  ["CHONBURI", "Chonburi"],
  ["IBARAKI", "Ibaraki"],
  ["Baden Württemberg", "Baden-Württemberg"],
  ["Northants", "Northampton"],
  ["Telangana", "Hyderabad"],
  ["Jeollabuk-do", "Jeonju"],
  ["La Habana", "Havana"],
  ["Metapa de Dominguez", "Metapa"],
  ["Tepeji del Rio", "Tepeji del Río"],
  ["Sidi Thabet", "Sidi Thabet"],
  ["Ongkharak", "Ongkharak"],
  ["Malwana", "Malwana"],
  ["Malur", "Malur"],
  ["Bonab", "Bonab"],
  ["Sao Paulo Region", "São Paulo"],
  ["Jiangsu Province", "Nanjing"],
  ["Rayong Province", "Rayong"],
  ["Selangor", "Shah Alam"],
  ["Kedah", "Alor Setar"],
  ["Thani", "Thanyaburi"],
]);

function haversineKm(aLat, aLon, bLat, bLon) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * El volcado parte los valores en dos bloques: latitudes y después longitudes.
 * Devuelve los pares y el índice de corte, sin suponer cuántas filas hay.
 */
export function splitCoordinates(values, expectedRows) {
  for (let cut = expectedRows; cut <= values.length; cut += 1) {
    const lats = values.slice(0, cut);
    const lons = values.slice(cut);
    if (lats.length !== lons.length) continue;
    if (lats.every((v) => v >= -90 && v <= 90) && lons.every((v) => v >= -180 && v <= 180)) {
      return { cut, pairs: lats.map((lat, i) => ({ lat, lon: lons[i] })) };
    }
  }
  throw new Error("No pude separar latitudes y longitudes del volcado crudo");
}

/** Ciudad y país del punto según OSM. `null` si cae en el mar o sin datos. */
function placeFromNominatim(payload) {
  const address = payload?.address ?? {};
  const city =
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.hamlet ??
    address.county ??
    payload?.name ??
    null;
  const country = address.country ?? null;
  const countryCode = (address.country_code ?? "").toUpperCase() || null;
  const water = ["water", "ocean", "sea", "bay", "strait"].includes(payload?.type ?? "");
  if (!city || !country || water) return null;
  return { city, country, countryCode, admin1: address.state ?? address.region ?? null };
}

async function reverse(lat, lon) {
  const url = new URL(NOMINATIM);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("zoom", "10");
  url.searchParams.set("accept-language", "en");
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  return placeFromNominatim(await response.json());
}

async function buildPlaces(pairs) {
  const places = [];
  // Un punto por segundo es la política de uso de Nominatim; 136 puntos son
  // dos minutos y medio, y el resultado se cachea.
  for (const [index, pair] of pairs.entries()) {
    try {
      places.push(await reverse(pair.lat, pair.lon));
    } catch (error) {
      places.push({ error: String(error) });
    }
    if ((index + 1) % 10 === 0) console.error(`  geolocalizadas ${index + 1}/${pairs.length}`);
    await new Promise((resolve) => setTimeout(resolve, 1_100));
  }
  return places;
}

async function geocode(name) {
  const url = new URL(GEOCODER);
  url.searchParams.set("name", name);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`geocoder ${response.status}`);
  const payload = await response.json();
  return (payload.results ?? []).map((r) => ({
    name: r.name,
    country: r.country,
    countryCode: (r.country_code ?? "").toUpperCase(),
    lat: r.latitude,
    lon: r.longitude,
  }));
}

/** Topónimos declarados por la IAEA, geocodificados, para contrastar. */
async function buildLabels(names) {
  const labels = [];
  for (const raw of names) {
    const query = NAME_FIXES.get(raw) ?? raw;
    try {
      for (const hit of await geocode(query)) labels.push({ raw, query, ...hit });
    } catch {
      /* un topónimo que el geocodificador no conoce no invalida la fila */
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  return labels;
}

async function main() {
  const offline = process.argv.includes("--offline");
  mkdirSync(CACHE_DIR, { recursive: true });

  let raw;
  if (offline) {
    raw = JSON.parse(readFileSync(CACHE_RAW, "utf8"));
  } else {
    const response = await fetch(RAW_URL, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`El volcado crudo respondió ${response.status}`);
    raw = await response.json();
    writeFileSync(CACHE_RAW, JSON.stringify(raw, null, 2));
  }

  const { cut, pairs } = splitCoordinates(raw.realValues, raw.cities.length);

  let places;
  if (offline) {
    places = JSON.parse(readFileSync(CACHE_PLACES, "utf8"));
  } else {
    places = await buildPlaces(pairs);
    writeFileSync(CACHE_PLACES, JSON.stringify(places, null, 2));
  }

  let labels;
  if (offline) {
    labels = JSON.parse(readFileSync(CACHE_LABELS, "utf8"));
  } else {
    labels = await buildLabels(raw.cities);
    writeFileSync(CACHE_LABELS, JSON.stringify(labels, null, 2));
  }

  // El contraste se hace contra la lista de países que declara la IAEA, no
  // contra los que hayan sobrevivido al geocodificador: si un topónimo suyo no
  // se geocodifica, su país sigue estando declarado.
  const declaredCountries = new Set(raw.countries.map(normaliseCountry));
  const kept = [];
  const dropped = [];
  const seen = new Set();

  pairs.forEach((pair, index) => {
    const place = places[index];
    const lat = Number(pair.lat.toFixed(5));
    const lon = Number(pair.lon.toFixed(5));

    let nearest = null;
    for (const label of labels) {
      const distanceKm = haversineKm(lat, lon, label.lat, label.lon);
      if (!nearest || distanceKm < nearest.distanceKm) nearest = { label, distanceKm };
    }
    const nearestKm = nearest ? Math.round(nearest.distanceKm) : null;
    const base = { index, lat, lon, city: place?.city ?? null, nearest: nearest?.label.raw ?? null, nearestKm };

    if (!place?.city || !place?.country) {
      dropped.push({ ...base, reason: "la coordenada no cae en ninguna localidad (mar o sin datos)" });
      return;
    }
    if (!declaredCountries.has(normaliseCountry(place.country))) {
      dropped.push({ ...base, reason: `«${place.country}» no aparece en la lista de la IAEA` });
      return;
    }
    if (nearestKm !== null && nearestKm > NEAREST_LABEL_MAX_KM) {
      dropped.push({
        ...base,
        reason: `el topónimo declarado más cercano («${nearest.label.raw}») queda a ${nearestKm} km`,
      });
      return;
    }

    const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    if (seen.has(key)) {
      dropped.push({ ...base, reason: "duplicado: misma coordenada que otra fila" });
      return;
    }
    seen.add(key);

    kept.push({
      id: `gi-${String(kept.length + 1).padStart(3, "0")}`,
      city: place.city,
      admin1: place.admin1,
      country: place.country,
      countryCode: place.countryCode,
      lat,
      lon,
      /** Topónimo más cercano de la lista de la IAEA y su distancia (contraste). */
      declaredNearest: nearest?.label.raw ?? null,
      declaredKm: nearestKm,
    });
  });

  kept.sort((a, b) => a.country.localeCompare(b.country) || a.city.localeCompare(b.city));
  kept.forEach((row, i) => {
    row.id = `gi-${String(i + 1).padStart(3, "0")}`;
  });

  const dataset = {
    source: "IAEA DIIF — Database on Industrial Irradiation Facilities (visualización de Tableau)",
    sourceUrl: raw.url,
    rawUrl: RAW_URL,
    extracted: raw.extracted ?? null,
    method:
      "Pares (lat, lon) del volcado crudo. Ciudad y país salen de geolocalización inversa " +
      "contra OpenStreetMap (Nominatim); el topónimo de la IAEA se usa como contraste, no " +
      "como índice. Sin coordenadas inventadas: lo que no valida, no se publica.",
    generatedAt: new Date().toISOString(),
    coordinatePairs: pairs.length,
    published: kept.length,
    dropped: dropped.length,
    facilities: kept,
  };

  mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  writeFileSync(OUT_JSON, `${JSON.stringify(dataset, null, 2)}\n`);

  const tsRows = kept
    .map(
      (r) =>
        `  { id: "${r.id}", city: ${JSON.stringify(r.city)}, country: ${JSON.stringify(r.country)}, ` +
        `countryCode: "${r.countryCode ?? ""}", lat: ${r.lat}, lon: ${r.lon}, ` +
        `declaredKm: ${r.declaredKm ?? "null"} },`,
    )
    .join("\n");

  writeFileSync(
    OUT_TS,
    `/**
 * Plantas de irradiación gamma (IAEA DIIF), reconstruidas desde el volcado
 * crudo del fork y validadas coordenada a coordenada.
 *
 * Fichero GENERADO por \`scripts/build-gamma-irradiators.mjs\` —no lo edites a
 * mano—. El volcado trae ${cut} pares de coordenadas y solo ${raw.cities.length}
 * nombres de ciudad distintos, así que unirlos por índice corre los nombres desde
 * la fila ${raw.cities.length} (a Abuja le quedaba la latitud de Túnez). Aquí la
 * ciudad y el país de cada punto salen de geolocalización inversa contra
 * OpenStreetMap, y la lista de la IAEA se usa solo como contraste: se publican las
 * filas que caen en una localidad real de un país que la lista menciona. Las
 * descartadas y el método completo están en docs/gamma-irradiators.md.
 *
 * Fuente: ${dataset.source}
 * Generado: ${dataset.generatedAt} · ${kept.length} de ${pairs.length} pares publicados
 */

export interface GammaIrradiator {
  id: string;
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
  /** Distancia al topónimo más cercano que declara la IAEA, en km. */
  declaredKm: number | null;
}

export const GAMMA_IRRADIATORS: GammaIrradiator[] = [
${tsRows}
];
`,
  );

  const reportRows = dropped
    .map(
      (d) =>
        `| ${d.index} | ${d.lat}, ${d.lon} | ${d.city ?? "—"} | ${d.nearest ?? "—"} (${d.nearestKm ?? "—"} km) | ${d.reason} |`,
    )
    .join("\n");

  writeFileSync(
    REPORT,
    `# Plantas de irradiación gamma (IAEA DIIF)

Generado por \`scripts/build-gamma-irradiators.mjs\`. No se edita a mano.

## El problema del volcado

El fichero crudo del fork (\`data/gamma-irradiators-raw.json\`) es una descarga de
la visualización de Tableau de la IAEA. Trae **${pairs.length} pares de
coordenadas** (\`realValues\`: primero las ${cut} latitudes, después las ${cut}
longitudes) pero solo **${raw.cities.length} nombres de ciudad distintos**, así que
las dos listas no se pueden unir por índice. La versión derivada del fork lo hizo
igual y quedó corrida desde la fila ${raw.cities.length}: a Abuja le puso la
latitud de Túnez, a Acra la de Abuya y a Ibaraki una longitud de Ghana. Además la
lista de países (${raw.countries.length}) y la de organismos (${raw.organizations.length}) son
*listas de valores distintos*, no columnas: tampoco se pueden unir por fila.

## Método

1. Los pares salen del volcado tal cual; el corte entre latitudes y longitudes se
   detecta solo.
2. Ciudad, región y país de cada punto salen de **geolocalización inversa contra
   OpenStreetMap** (Nominatim, zoom 10). Es la fuente administrativa, no una
   suposición.
3. Contraste con la IAEA: se geocodifican sus topónimos y se comprueba que la
   coordenada caiga en un país que la lista menciona. Se guarda también a qué
   distancia queda el topónimo declarado más cercano.
4. Se descarta lo que no cumple: coordenadas en el mar, países que la lista no
   menciona y duplicados exactos.

## Resultado

| | |
| --- | --- |
| Pares de coordenadas en el volcado | ${pairs.length} |
| Filas publicadas | **${kept.length}** |
| Filas descartadas | ${dropped.length} |
| Países representados | ${new Set(kept.map((k) => k.country)).size} |
| Topónimo IAEA más cercano (mediana) | ${
      kept
        .map((k) => k.declaredKm ?? 0)
        .sort((a, b) => a - b)[Math.floor(kept.length / 2)] ?? "—"
    } km |

## Filas descartadas

| Fila | Coordenada | Ciudad OSM | Topónimo IAEA más cercano | Motivo |
| --- | --- | --- | --- | --- |
${reportRows || "| — | — | — | — | ninguna |"}

## Filtro de contraste

Una fila se publica solo si el topónimo más cercano que declara la IAEA queda a
**${NEAREST_LABEL_MAX_KM} km o menos**. Es el filtro que atrapa las filas corridas
que la geolocalización inversa no detecta por sí sola: un punto real de Irlanda
o de Irán con el nombre de otra fila del volcado. Las que caen por encima
aparecen arriba, en «Filas descartadas», con la distancia que las delata.
`,
  );

  console.log(`gamma-irradiators: ${kept.length}/${pairs.length} publicadas, ${dropped.length} descartadas`);
  for (const d of dropped) {
    console.log(`  #${d.index} ${d.lat},${d.lon} → ${d.reason}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
