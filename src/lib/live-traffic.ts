/**
 * Tráfico aéreo y marítimo de verdad.
 *
 * El globo pedía los datos a las funciones `air-traffic` y `marine-traffic`, y
 * las versiones desplegadas siguen contestando filas generadas al azar **sin**
 * poner `mock: true`: `icao24: "mock0000"`, `mmsi: "mock000000000"`. El cliente
 * sólo miraba esa bandera, así que los pintaba como tráfico real.
 *
 * Aquí se detectan por el identificador —ningún ICAO24 ni MMSI real empieza por
 * «mock»— y se cae al proxy propio `/api/traffic`, que pide los feeds abiertos
 * desde el servidor: OpenSky y Digitraffic no permiten la petición desde el
 * navegador (CORS de un solo origen y gzip obligatorio, respectivamente).
 */

export interface FlightRow {
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

export interface ShipRow {
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

export interface AirTrafficPayload {
  count: number;
  flights: FlightRow[];
  source: string | null;
  unavailable: boolean;
  reason: string | null;
  timestamp: string;
}

export interface MarineTrafficPayload {
  count: number;
  ships: ShipRow[];
  source: string | null;
  coverage: string | null;
  unavailable: boolean;
  reason: string | null;
  timestamp: string;
}

/** Un identificador inventado por los despliegues antiguos (`mock0000`). */
export function isFabricatedId(id: string | null | undefined): boolean {
  return typeof id === "string" && /^mock/i.test(id.trim());
}

/** Cuántas filas del lote son inventadas. */
export function countFabricatedIds(ids: (string | null | undefined)[]): number {
  return ids.filter(isFabricatedId).length;
}

async function getJson<T>(url: string, timeoutMs = 20_000): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`El proxy de tráfico respondió ${response.status}`);
  return (await response.json()) as T;
}

/** Aeronaves reales vía proxy de mismo origen. */
export function fetchAirTrafficDirect(): Promise<AirTrafficPayload> {
  return getJson<AirTrafficPayload>("/api/traffic?kind=air");
}

/** Buques reales vía proxy de mismo origen (cobertura: Báltico). */
export function fetchMarineTrafficDirect(): Promise<MarineTrafficPayload> {
  return getJson<MarineTrafficPayload>("/api/traffic?kind=marine");
}
