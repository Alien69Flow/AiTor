/**
 * Capa de mareas del globo: nivel del mar y corriente superficial.
 *
 * No sustituye a `useTides` (NOAA CO-OPS), que sigue alimentando el ticker con
 * observaciones reales de tres boyas estadounidenses. Esto es otra cosa y se
 * llama distinto: **cobertura mundial** de un modelo, una sola petición para
 * todas las estaciones de referencia.
 *
 * Open-Meteo acepta coordenadas separadas por comas y devuelve un array, así
 * que 24 estaciones cuestan una llamada, no 24. Refresco cada 15 minutos: el
 * nivel del mar se mueve despacio y no merece más batería.
 *
 * Si la fuente falla, el conector rechaza; el hook conserva la última lectura
 * buena y expone el error. La tarjeta decide qué enseñar, y nunca rellena.
 */
import { safeFetchJson, usePolledConnector } from "@/lib/connectors";
import {
  readingOf,
  TIDE_SOURCE_URL,
  TIDE_STATIONS,
  type TideReading,
} from "@/lib/tides";

export interface TideLevelsPayload {
  readings: TideReading[];
  /** Hora a la que se pidió el dato (UTC, ISO). */
  fetchedAt: string;
  /** Estaciones con dato de verdad; el resto no está cubierto por el modelo. */
  covered: number;
}

export function tideLevelsUrl(
  stations: { lat: number; lon: number }[] = TIDE_STATIONS,
): string {
  const lat = stations.map((station) => station.lat).join(",");
  const lon = stations.map((station) => station.lon).join(",");
  return `${TIDE_SOURCE_URL}?latitude=${lat}&longitude=${lon}&hourly=sea_level_height_msl,ocean_current_velocity,ocean_current_direction&forecast_days=1&timezone=UTC`;
}

/** Convierte la respuesta de Open-Meteo en lecturas, una por estación. */
export function parseTideLevels(payload: unknown, nowIso: string): TideReading[] {
  const rows = Array.isArray(payload) ? payload : [payload];
  return TIDE_STATIONS.map((station, index) => readingOf(station, rows[index], nowIso));
}

export function useTideLevels(enabled: boolean, intervalMs = 15 * 60_000) {
  return usePolledConnector<TideLevelsPayload>(
    async (signal) => {
      const payload = await safeFetchJson<unknown>(tideLevelsUrl(), { signal, timeoutMs: 12_000 });
      const fetchedAt = new Date().toISOString();
      const readings = parseTideLevels(payload, fetchedAt);
      return {
        readings,
        fetchedAt,
        covered: readings.filter((reading) => reading.covered).length,
      };
    },
    { readings: [], fetchedAt: "", covered: 0 },
    intervalMs,
    enabled,
  );
}
