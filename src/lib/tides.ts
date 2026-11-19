/**
 * Mareas del globo con Open-Meteo Marine (abierto, sin clave ni cuenta).
 *
 * Qué publica la fuente: `sea_level_height_msl`, el nivel del mar sobre el nivel
 * medio en metros, y la corriente superficial (`ocean_current_velocity` en km/h,
 * `ocean_current_direction` en grados desde el norte), hora a hora.
 *
 * Qué **no** es: no es la tabla oficial de pleamares y bajamares de un puerto.
 * Es el nivel del mar del modelo marino, que ya incluye marea astronómica y
 * efecto meteorológico. La tarjeta lo dice con esas palabras: es una estimación
 * de modelo, no un dato de autoridad portuaria.
 *
 * Cobertura: sólo mar. En un punto de tierra adentro la API contesta con la
 * serie llena de `null`, y aquí eso se traduce a «sin cobertura». Nunca a cero:
 * un cero es una altura, y no la tenemos.
 */

export const TIDE_SOURCE = "Open-Meteo Marine";
export const TIDE_SOURCE_URL = "https://marine-api.open-meteo.com/v1/marine";
export const TIDE_COVERAGE =
  "océanos y mares que cubre el modelo; tierra adentro y algunos mares interiores no tienen dato";
export const TIDE_NATURE =
  "nivel del mar del modelo (marea + efecto meteorológico), no tabla oficial de puerto";

export interface TideStation {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
}

/**
 * Puertos de referencia, repartidos por océano. No es una lista de «todas las
 * mareas del mundo»: es una muestra fija y barata (una sola petición) que dice
 * si la capa funciona y de dónde viene el dato.
 */
export const TIDE_STATIONS: TideStation[] = [
  { id: "acoruna", name: "A Coruña", region: "Atlántico norte", lat: 43.37, lon: -8.4 },
  { id: "lisboa", name: "Lisboa", region: "Atlántico norte", lat: 38.7, lon: -9.42 },
  { id: "cadiz", name: "Cádiz", region: "Atlántico norte", lat: 36.53, lon: -6.29 },
  { id: "barcelona", name: "Barcelona", region: "Mediterráneo", lat: 41.38, lon: 2.18 },
  { id: "marsella", name: "Marsella", region: "Mediterráneo", lat: 43.3, lon: 5.37 },
  { id: "napoles", name: "Nápoles", region: "Mediterráneo", lat: 40.83, lon: 14.25 },
  { id: "pireo", name: "El Pireo", region: "Egeo", lat: 37.94, lon: 23.64 },
  { id: "estambul", name: "Estambul", region: "Bósforo", lat: 41.0, lon: 28.97 },
  { id: "casablanca", name: "Casablanca", region: "Atlántico norte", lat: 33.6, lon: -7.62 },
  { id: "dakar", name: "Dakar", region: "Atlántico tropical", lat: 14.69, lon: -17.45 },
  { id: "elcabo", name: "Ciudad del Cabo", region: "Atlántico sur", lat: -33.92, lon: 18.42 },
  { id: "nuevayork", name: "Nueva York", region: "Atlántico noroeste", lat: 40.7, lon: -74.01 },
  { id: "miami", name: "Miami", region: "Atlántico noroeste", lat: 25.77, lon: -80.13 },
  { id: "losangeles", name: "Los Ángeles", region: "Pacífico noreste", lat: 33.72, lon: -118.27 },
  { id: "valparaiso", name: "Valparaíso", region: "Pacífico sur", lat: -33.03, lon: -71.63 },
  { id: "buenosaires", name: "Buenos Aires", region: "Río de la Plata", lat: -34.6, lon: -58.37 },
  { id: "rio", name: "Río de Janeiro", region: "Atlántico sur", lat: -22.9, lon: -43.17 },
  { id: "sidney", name: "Sídney", region: "Pacífico suroeste", lat: -33.87, lon: 151.21 },
  { id: "auckland", name: "Auckland", region: "Pacífico sur", lat: -36.84, lon: 174.77 },
  { id: "tokio", name: "Tokio", region: "Pacífico noroeste", lat: 35.65, lon: 139.76 },
  { id: "shanghai", name: "Shanghái", region: "Pacífico noroeste", lat: 31.23, lon: 121.49 },
  { id: "mumbai", name: "Mumbai", region: "Índico norte", lat: 19.05, lon: 72.83 },
  { id: "dubai", name: "Dubái", region: "Golfo Pérsico", lat: 25.2, lon: 55.27 },
  { id: "reikiavik", name: "Reikiavik", region: "Atlántico norte", lat: 64.15, lon: -21.94 },
];

export type TideTrend = "subiendo" | "bajando" | "estable";

export interface TideExtreme {
  kind: "pleamar" | "bajamar";
  heightM: number;
  /** ISO 8601 en UTC. */
  atIso: string;
}

export interface TideSeries {
  time: string[];
  height: (number | null)[];
  currentKmh: (number | null)[];
  currentDirectionDeg: (number | null)[];
}

export interface TideSample {
  heightM: number | null;
  trend: TideTrend | null;
  next: TideExtreme | null;
}

/** Un número de la API, o `null`. Nunca se sustituye por cero. */
export function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numArray(value: unknown): (number | null)[] {
  return Array.isArray(value) ? value.map(num) : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/**
 * Serie horaria de una respuesta de Open-Meteo Marine, o `null` si la respuesta
 * no tiene la forma esperada. Sin `hourly` no hay dato: no se inventa la serie.
 */
export function readSeries(payload: unknown): TideSeries | null {
  const hourly = (payload as { hourly?: unknown } | null)?.hourly;
  if (!hourly || typeof hourly !== "object") return null;
  const row = hourly as Record<string, unknown>;
  const time = stringArray(row.time);
  if (time.length === 0) return null;
  return {
    time,
    height: numArray(row.sea_level_height_msl),
    currentKmh: numArray(row.ocean_current_velocity),
    currentDirectionDeg: numArray(row.ocean_current_direction),
  };
}

/** Hora de la serie (`2026-11-19T00:00`) a ISO UTC (`2026-11-19T00:00:00.000Z`). */
function isoOf(stamp: string): string {
  const withZone = /Z$|[+-]\d{2}:?\d{2}$/.test(stamp) ? stamp : `${stamp}Z`;
  const parsed = new Date(withStamp(withZone));
  return Number.isNaN(parsed.getTime()) ? stamp : parsed.toISOString();
}

function withStamp(stamp: string): string {
  // `2026-11-19T00:00` no lleva segundos; `Date` lo entiende, pero se normaliza.
  return /T\d{2}:\d{2}$/.test(stamp) ? `${stamp}:00` : stamp;
}

/**
 * Altura ahora, tendencia y próxima pleamar/bajamar.
 *
 * Todo puede ser `null`: si la serie no cubre el punto (tierra adentro), la
 * estación sale sin datos y la tarjeta lo dice.
 */
export function snapshotAt(series: TideSeries | null, nowIso: string): TideSample {
  const empty: TideSample = { heightM: null, trend: null, next: null };
  if (!series || series.height.length === 0) return empty;

  const now = new Date(nowIso).getTime();
  if (Number.isNaN(now)) return empty;

  // Índice de la última hora que ya ha empezado; si el día aún no ha empezado,
  // la primera.
  let index = -1;
  for (let i = 0; i < series.time.length; i += 1) {
    const at = new Date(withStamp(series.time[i])).getTime();
    if (Number.isNaN(at)) continue;
    if (at <= now) index = i;
    else break;
  }
  if (index < 0) index = 0;

  const heightM = num(series.height[index]);
  if (heightM === null) return empty;

  const nextHeight = num(series.height[index + 1]);
  const previousHeight = num(series.height[index - 1]);
  let trend: TideTrend = "estable";
  if (nextHeight !== null) {
    const delta = nextHeight - heightM;
    if (delta > 0.02) trend = "subiendo";
    else if (delta < -0.02) trend = "bajando";
  } else if (previousHeight !== null) {
    const delta = heightM - previousHeight;
    if (delta > 0.02) trend = "subiendo";
    else if (delta < -0.02) trend = "bajando";
  }

  return { heightM, trend, next: nextExtreme(series, index) };
}

/** Primera pleamar o bajamar después de `from`; `null` si no hay ninguna clara. */
export function nextExtreme(series: TideSeries, from: number): TideExtreme | null {
  for (let i = Math.max(1, from + 1); i < series.height.length - 1; i += 1) {
    const before = num(series.height[i - 1]);
    const at = num(series.height[i]);
    const after = num(series.height[i + 1]);
    if (before === null || at === null || after === null) continue;
    if (at >= before && at >= after) {
      return { kind: "pleamar", heightM: at, atIso: isoOf(series.time[i]) };
    }
    if (at <= before && at <= after) {
      return { kind: "bajamar", heightM: at, atIso: isoOf(series.time[i]) };
    }
  }
  return null;
}

/** Dirección de la corriente en rumbos de 16, o `null` si no hay ángulo. */
export function compassOf(degrees: number | null): string | null {
  if (degrees === null) return null;
  const points = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO",
  ];
  const normalized = ((degrees % 360) + 360) % 360;
  return points[Math.round(normalized / 22.5) % 16];
}

/** Texto corto para una altura, sin inventar: `null` se dice con palabras. */
export function formatHeight(meters: number | null): string {
  if (meters === null) return "sin dato";
  const sign = meters > 0 ? "+" : "";
  return `${sign}${meters.toFixed(2)} m`;
}

/** Velocidad de la corriente, sin convertir un hueco en `0.0 km/h`. */
export function formatSpeed(kmh: number | null): string {
  if (kmh === null) return "sin dato";
  return `${kmh.toFixed(1)} km/h`;
}

export interface TideReading extends TideSample {
  station: TideStation;
  currentKmh: number | null;
  currentDirectionDeg: number | null;
  /** `false` cuando la fuente no cubre ese punto (todo `null`). */
  covered: boolean;
}

/** Convierte una fila de la API en la lectura de una estación. */
export function readingOf(
  station: TideStation,
  payload: unknown,
  nowIso: string,
): TideReading {
  const series = readSeries(payload);
  const sample = snapshotAt(series, nowIso);
  const index = series ? series.time.length - 1 : -1;
  return {
    station,
    ...sample,
    currentKmh: series && index >= 0 ? num(series.currentKmh[index]) : null,
    currentDirectionDeg: series && index >= 0 ? num(series.currentDirectionDeg[index]) : null,
    covered: sample.heightM !== null,
  };
}
