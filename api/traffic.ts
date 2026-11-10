/**
 * `GET /api/traffic?kind=air|marine` — tráfico real, servido desde Vercel.
 *
 * Por qué existe esta ruta: las funciones `air-traffic` y `marine-traffic`
 * desplegadas en el proyecto de datos siguen contestando datos **simulados** sin
 * marcarlos como tales (`icao24: "mock0000"`, `mmsi: "mock000000000"`), y los
 * feeds abiertos no se pueden pedir desde el navegador: OpenSky sólo permite su
 * propio origen en `access-control-allow-origin` y Digitraffic exige `gzip` y
 * una petición sin preflight. Un proxy de mismo origen resuelve las dos cosas.
 *
 * Fuentes, todas sin clave:
 *  - Aire:  `api.adsb.lol/v2/point/{lat}/{lon}/{radio}` (red comunitaria ADS-B),
 *           con OpenSky como respaldo si la primera no responde.
 *  - Mar:   `meri.digitraffic.fi` (AIS abierto de la agencia finlandesa, CC BY
 *           4.0). Cubre el Báltico y se dice: no se extrapola al resto del mundo.
 *
 * Los dos feeds se cachean en memoria 90 s y reutilizan la última lectura real
 * hasta 15 min (`stale: true`) para no machacar a las fuentes comunitarias ni
 * dejar la capa vacía por un 429 puntual.
 *
 * Regla que no se negocia: si ninguna fuente responde, la respuesta lo dice
 * (`unavailable: true`) y devuelve una lista vacía. Nunca se rellena con barcos
 * ni aviones inventados.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

export const maxDuration = 30;

/**
 * Tope de espera por fuente, el mismo para todas. Antes eran 12 s por sondeo y,
 * como el aire encadena adsb.lol y luego OpenSky, el peor caso se acercaba a los
 * 30 s de `maxDuration`. Con 8 s —el margen que ya usa la función edge— ninguna
 * fuente corta distinto y el total queda holgado.
 */
const SOURCE_TIMEOUT_MS = 8_000;

interface Flight {
  icao24: string;
  callsign: string;
  origin: string | null;
  destination: string | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number;
  velocity: number;
  heading: number;
  aircraftType: string | null;
  aircraftCategory: string | null;
  timestamp: string;
}

interface Ship {
  mmsi: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  destination: string | null;
  timestamp: string;
}

/**
 * Centros de muestreo del ADS-B comunitario. Un solo punto deja medio planeta
 * sin aviones; seis cubren las rutas densas sin pedir el catálogo entero.
 */
const ADS_B_CENTERS: { lat: number; lon: number; radiusNm: number }[] = [
  { lat: 48.5, lon: 9.0, radiusNm: 250 }, // Europa central
  { lat: 41.6, lon: 2.3, radiusNm: 250 }, // Península Ibérica
  { lat: 40.7, lon: -74.0, radiusNm: 250 }, // Noreste de EE. UU.
  { lat: 34.0, lon: -118.2, radiusNm: 250 }, // Costa oeste de EE. UU.
  { lat: 35.6, lon: 139.6, radiusNm: 250 }, // Japón
  { lat: -33.8, lon: 151.2, radiusNm: 250 }, // Sídney
  { lat: 25.2, lon: 55.3, radiusNm: 250 }, // Golfo Pérsico
  { lat: -23.5, lon: -46.6, radiusNm: 250 }, // São Paulo
];

/** Tope de puntos: Cesium se arrastra con miles de billboards. */
const MAX_FLIGHTS = 600;
const MAX_SHIPS = 500;

/**
 * Caché en memoria del feed aéreo. adsb.lol es una red ciudadana sin clave: si
 * cada visitante dispara ocho sondeos, su proxy nos frena con 429 y la capa se
 * queda vacía. Con 90 s de frescura, una ráfaga de visitas cuesta un solo
 * barrido; con 15 min de reutilización, un corte puntual de las fuentes no
 * borra los aviones que ya estaban pintados.
 */
const AIR_FRESH_MS = 90_000;
const AIR_STALE_MS = 15 * 60_000;

/** Igual para el mar: Digitraffic sirve un catálogo grande y no hace falta por visita. */
const MARINE_FRESH_MS = 90_000;
const MARINE_STALE_MS = 15 * 60_000;

interface AirPayload {
  count: number;
  flights: Flight[];
  source: string | null;
  unavailable: boolean;
  reason: string | null;
  /** La lectura sale de la caché, no de esta petición. */
  cached?: boolean;
  /** Se reutiliza la última lectura real porque ahora mismo no responde nadie. */
  stale?: boolean;
}

interface MarinePayload {
  count: number;
  ships: Ship[];
  source: string | null;
  coverage: string | null;
  unavailable: boolean;
  reason: string | null;
  cached?: boolean;
  stale?: boolean;
}

let airCache: { at: number; body: AirPayload } | null = null;
let marineCache: { at: number; body: MarinePayload } | null = null;

interface AdsbAircraft {
  hex?: string;
  flight?: string;
  t?: string;
  alt_baro?: number | string;
  alt_geom?: number;
  gs?: number;
  track?: number;
  lat?: number;
  lon?: number;
  category?: string;
}

/**
 * Una fila es inventada si su identificador empieza por `mock`. Es el patrón de
 * los despliegues antiguos de las funciones (`mock0000`, `mock000000000`) y no
 * coincide con ningún ICAO24 ni MMSI real.
 */
export function isFabricatedId(id: string | null | undefined): boolean {
  return typeof id === "string" && /^mock/i.test(id.trim());
}

function json(res: VercelResponse, body: unknown, status = 200) {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  // Es un proxy de datos públicos y el navegador lo llama desde el mismo
  // origen; el comodín sólo evita sorpresas si algún día se sirve aparte.
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("cache-control", "public, max-age=30, s-maxage=30");
  res.send(JSON.stringify(body));
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "user-agent": "aitor-intel/1.0", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} en ${url}`);
  return (await response.json()) as T;
}

/** Mapea una aeronave de adsb.lol; descarta filas sin posición o inventadas. */
export function mapAdsbAircraft(aircraft: AdsbAircraft[], now = new Date()): Flight[] {
  const stamp = now.toISOString();
  const out: Flight[] = [];
  for (const row of aircraft) {
    const hex = row.hex?.trim().toLowerCase();
    if (!hex || isFabricatedId(hex)) continue;
    if (typeof row.lat !== "number" || typeof row.lon !== "number") continue;
    // `alt_baro` puede venir como "ground" cuando el avión está en tierra.
    const altitudeFt = typeof row.alt_baro === "number" ? row.alt_baro : row.alt_geom ?? 0;
    out.push({
      icao24: hex,
      callsign: (row.flight ?? "").trim() || hex.toUpperCase(),
      origin: null,
      destination: null,
      latitude: row.lat,
      longitude: row.lon,
      altitude: Math.round(altitudeFt * 0.3048),
      velocity: Math.round((row.gs ?? 0) * 0.514444),
      heading: Math.round(row.track ?? 0),
      aircraftType: row.t ?? null,
      aircraftCategory: row.category ?? null,
      timestamp: stamp,
    });
  }
  return out;
}

/** [icao24, callsign, country, …, lon, lat, altura m, …, velocidad, rumbo] */
type OpenSkyRow = (string | number | boolean | null)[];

export function mapOpenSkyStates(states: OpenSkyRow[], now = new Date()): Flight[] {
  const stamp = now.toISOString();
  const out: Flight[] = [];
  for (const state of states) {
    const icao = typeof state[0] === "string" ? state[0].trim().toLowerCase() : "";
    if (!icao || isFabricatedId(icao)) continue;
    const lon = typeof state[5] === "number" ? state[5] : null;
    const lat = typeof state[6] === "number" ? state[6] : null;
    if (lat === null || lon === null) continue;
    out.push({
      icao24: icao,
      callsign: typeof state[1] === "string" ? state[1].trim() : icao.toUpperCase(),
      origin: null,
      destination: null,
      latitude: lat,
      longitude: lon,
      altitude: Math.round(typeof state[7] === "number" ? state[7] : 0),
      velocity: Math.round(typeof state[9] === "number" ? state[9] : 0),
      heading: Math.round(typeof state[10] === "number" ? state[10] : 0),
      aircraftType: null,
      aircraftCategory: null,
      timestamp: stamp,
    });
  }
  return out;
}

async function fetchAir(): Promise<{ flights: Flight[]; source: string | null; reason: string | null }> {
  const results = await Promise.allSettled(
    ADS_B_CENTERS.map((center) =>
      getJson<{ ac?: AdsbAircraft[] }>(
        `https://api.adsb.lol/v2/point/${center.lat}/${center.lon}/${center.radiusNm}`,
      ),
    ),
  );

  const byIcao = new Map<string, Flight>();
  let responded = 0;
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    responded += 1;
    for (const flight of mapAdsbAircraft(result.value.ac ?? [])) {
      if (!byIcao.has(flight.icao24)) byIcao.set(flight.icao24, flight);
    }
  }

  if (byIcao.size > 0) {
    // Si hay más de los que caben, se muestrea de forma uniforme en vez de
    // quedarse con los primeros centros y dejar medio mundo vacío.
    const all = [...byIcao.values()];
    const flights =
      all.length <= MAX_FLIGHTS
        ? all
        : all.filter((_, index) => index % Math.ceil(all.length / MAX_FLIGHTS) === 0);
    return { flights, source: "adsb.lol", reason: null };
  }

  // Respaldo: OpenSky desde el servidor (su CORS sólo permite su propio origen).
  try {
    const payload = await getJson<{ states?: OpenSkyRow[] }>(
      "https://opensky-network.org/api/states/all?lamin=-55&lomin=-170&lamax=70&lomax=180",
    );
    const flights = mapOpenSkyStates(payload.states ?? []).slice(0, MAX_FLIGHTS);
    return {
      flights,
      source: flights.length > 0 ? "opensky" : null,
      reason: flights.length > 0 ? null : "Ni adsb.lol ni OpenSky devolvieron aeronaves",
    };
  } catch (error) {
    return {
      flights: [],
      source: null,
      reason: `adsb.lol respondió en ${responded}/${ADS_B_CENTERS.length} sondeos sin aeronaves y OpenSky falló: ${
        error instanceof Error ? error.message : "error"
      }`,
    };
  }
}

/**
 * Aire con caché: si hay una lectura de hace menos de 90 s se devuelve tal cual y
 * no se toca la red. Si las fuentes fallan y hay una lectura real de menos de
 * 15 min, se reutiliza marcada como `stale` — son posiciones que existieron, no
 * una lista inventada — para que un 429 puntual no deje la capa sin aviones.
 */
async function getAir(): Promise<AirPayload> {
  const hit = airCache;
  if (hit && Date.now() - hit.at < AIR_FRESH_MS) {
    return { ...hit.body, cached: true };
  }

  const { flights, source, reason } = await fetchAir();
  const body: AirPayload = {
    count: flights.length,
    flights,
    source,
    unavailable: flights.length === 0,
    reason,
  };

  if (flights.length > 0) {
    airCache = { at: Date.now(), body };
    return body;
  }

  if (hit && Date.now() - hit.at < AIR_STALE_MS) {
    return { ...hit.body, stale: true, reason: reason ?? hit.body.reason };
  }

  return body;
}

interface DigitrafficLocation {
  mmsi?: number;
  geometry?: { coordinates?: [number, number] };
  properties?: { mmsi?: number; sog?: number; cog?: number; heading?: number; timestampExternal?: number };
}

interface DigitrafficVessel {
  mmsi?: number;
  name?: string;
  destination?: string | null;
  /** El catálogo usa `shipType`; se acepta el nombre antiguo por si cambia. */
  shipType?: number;
  shipTypeCode?: number;
}

/**
 * Códigos de «no disponible» del AIS. La velocidad viaja en décimas de nudo y
 * 1023 (102,3 kn) significa «sin dato»; el rumbo usa 511 por lo mismo. Sin
 * normalizarlos, el globo enseña un petrolero amarrado navegando a 102 nudos.
 */
export const AIS_UNAVAILABLE_SPEED_KN = 102.2;
export const AIS_UNAVAILABLE_HEADING = 360;
/** Ni el hidroala más rápido pasa de ~60 kn: por encima es un transpondedor roto. */
export const AIS_MAX_PLAUSIBLE_SPEED_KN = 70;

export function normaliseSpeed(sog: number | undefined): number {
  if (typeof sog !== "number" || !Number.isFinite(sog)) return 0;
  if (sog >= AIS_UNAVAILABLE_SPEED_KN || sog > AIS_MAX_PLAUSIBLE_SPEED_KN) return 0;
  return Number(sog.toFixed(1));
}

export function normaliseHeading(heading: number | undefined, cog: number | undefined): number {
  const candidate =
    typeof heading === "number" && heading < AIS_UNAVAILABLE_HEADING ? heading : cog;
  if (typeof candidate !== "number" || !Number.isFinite(candidate) || candidate >= 360) return 0;
  return Math.round(candidate);
}

const SHIP_TYPES: Record<number, string> = {
  30: "Pesquero", 31: "Remolcador", 32: "Remolcador", 35: "Militar", 36: "Velero", 37: "Deportivo",
  52: "Remolcador", 60: "Pasaje", 69: "Pasaje", 70: "Carga", 79: "Carga", 80: "Petrolero",
  89: "Petrolero", 90: "Otro",
};

async function fetchMarine(): Promise<{
  ships: Ship[];
  source: string | null;
  coverage: string | null;
  reason: string | null;
}> {
  const coverage = "Báltico y aguas finlandesas (Digitraffic, CC BY 4.0)";
  try {
    const [locations, vessels] = await Promise.all([
      getJson<{ features?: DigitrafficLocation[] }>("https://meri.digitraffic.fi/api/ais/v1/locations"),
      // El catálogo de nombres es grande pero necesario: un mapa de MMSI sin
      // nombre no dice qué barco es.
      getJson<DigitrafficVessel[]>("https://meri.digitraffic.fi/api/ais/v1/vessels").catch(() => []),
    ]);

    const names = new Map<number, DigitrafficVessel>();
    for (const vessel of Array.isArray(vessels) ? vessels : []) {
      if (typeof vessel.mmsi === "number") names.set(vessel.mmsi, vessel);
    }

    const now = new Date().toISOString();
    const ships: Ship[] = [];
    for (const feature of locations.features ?? []) {
      const coords = feature.geometry?.coordinates;
      const mmsi = feature.mmsi ?? feature.properties?.mmsi;
      if (!coords || typeof coords[0] !== "number" || typeof coords[1] !== "number" || !mmsi) continue;
      const meta = names.get(mmsi);
      ships.push({
        mmsi: String(mmsi),
        name: meta?.name?.trim() || `MMSI ${mmsi}`,
        type: SHIP_TYPES[Math.floor((meta?.shipType ?? meta?.shipTypeCode ?? 0) / 10) * 10] ?? "Buque",
        latitude: coords[1],
        longitude: coords[0],
        speed: normaliseSpeed(feature.properties?.sog),
        heading: normaliseHeading(feature.properties?.heading, feature.properties?.cog),
        destination: meta?.destination ?? null,
        timestamp: frameStamp(feature, now),
      });
    }

    // Orden por lectura más reciente, no por velocidad: ordenar por `speed`
    // subía a los transpondedores con datos absurdos a lo alto de la lista.
    ships.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    return {
      ships: ships.slice(0, MAX_SHIPS),
      source: ships.length > 0 ? "digitraffic" : null,
      coverage,
      reason: ships.length > 0 ? null : "Digitraffic no devolvió posiciones AIS en este momento",
    };
  } catch (error) {
    return {
      ships: [],
      source: null,
      coverage,
      reason: `Digitraffic falló: ${error instanceof Error ? error.message : "error"}`,
    };
  }
}

/**
 * Mar con la misma política que el aire: 90 s de frescura y, si las fuentes
 * callan, la última lectura real hasta 15 min en vez de una capa vacía. Los
 * barcos que llegan así siguen siendo barcos que existieron; sólo se dice que la
 * lectura es antigua.
 */
async function getMarine(): Promise<MarinePayload> {
  const hit = marineCache;
  if (hit && Date.now() - hit.at < MARINE_FRESH_MS) {
    return { ...hit.body, cached: true };
  }

  const { ships, source, coverage, reason } = await fetchMarine();
  const body: MarinePayload = {
    count: ships.length,
    ships,
    source,
    coverage,
    unavailable: ships.length === 0,
    reason,
  };

  if (ships.length > 0) {
    marineCache = { at: Date.now(), body };
    return body;
  }

  if (hit && Date.now() - hit.at < MARINE_STALE_MS) {
    return { ...hit.body, stale: true, reason: reason ?? hit.body.reason };
  }

  return body;
}

function frameStamp(feature: DigitrafficLocation, fallback: string): string {
  const stamp = feature.properties?.timestampExternal;
  return typeof stamp === "number" ? new Date(stamp).toISOString() : fallback;
}

export default async function traffic(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.status(204);
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-methods", "GET, OPTIONS");
    return res.end();
  }

  const kind = String(req.query.kind ?? "air");

  if (kind === "air") {
    const body = await getAir();
    return json(res, { ...body, timestamp: new Date().toISOString() });
  }

  if (kind === "marine") {
    const body = await getMarine();
    return json(res, { ...body, timestamp: new Date().toISOString() });
  }

  return json(res, { error: "kind debe ser air o marine" }, 400);
}
