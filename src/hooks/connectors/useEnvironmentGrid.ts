import { safeFetchJson, usePolledConnector } from "@/lib/connectors";
import {
  POLLEN_SPECIES,
  dominantPollen,
  dryingIndex,
  seaFlag,
  type BeachFlag,
  type PollenLevel,
} from "@/lib/environment-metrics";

/**
 * Rejilla ambiental de Open-Meteo: secado de la ropa, polen, estado del mar y
 * nieve.
 *
 * Son las cuatro preguntas cotidianas que faltaban en el globo —«¿puedo tender
 * la ropa?», «¿cómo está el mar?», «¿hay nieve en la estación?», «¿cuánto polen
 * hay?»— y las cuatro salen de APIs abiertas, sin clave y con atribución
 * directa:
 *
 *  - `api.open-meteo.com/v1/forecast`      → temperatura, humedad, viento, lluvia, nieve
 *  - `air-quality-api.open-meteo.com`      → polen de CAMS (sólo Europa)
 *  - `marine-api.open-meteo.com/v1/marine` → oleaje, mar de fondo, agua
 *
 * El índice de secado, la bandera de baño y el nivel de polen se calculan aquí
 * y no se piden a nadie: son convenciones, no medidas, y quedan a la vista para
 * poder discutirlas en una prueba.
 */

export type PlaceKind = "city" | "coast" | "ski";

export interface EnvPlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
  kind: PlaceKind;
}

/**
 * La rejilla es a propósito corta y sesgada a España: el producto se usa sobre
 * todo ahí y una petición batida por API cuesta lo mismo con 12 puntos que con
 * 300, pero 300 marcadores no se leen.
 */
export const ENV_PLACES: EnvPlace[] = [
  // Ciudades — secado y polen
  { id: "mad", name: "Madrid", lat: 40.41, lon: -3.7, kind: "city" },
  { id: "zgz", name: "Zaragoza", lat: 41.65, lon: -0.88, kind: "city" },
  { id: "bcn", name: "Barcelona", lat: 41.39, lon: 2.17, kind: "city" },
  { id: "svq", name: "Sevilla", lat: 37.39, lon: -5.99, kind: "city" },
  { id: "vlc", name: "Valencia", lat: 39.47, lon: -0.38, kind: "city" },
  { id: "bio", name: "Bilbao", lat: 43.26, lon: -2.93, kind: "city" },
  { id: "lis", name: "Lisboa", lat: 38.72, lon: -9.14, kind: "city" },
  { id: "par", name: "París", lat: 48.85, lon: 2.35, kind: "city" },
  { id: "lon", name: "Londres", lat: 51.5, lon: -0.13, kind: "city" },
  { id: "ber", name: "Berlín", lat: 52.52, lon: 13.4, kind: "city" },
  { id: "rom", name: "Roma", lat: 41.9, lon: 12.5, kind: "city" },
  { id: "ath", name: "Atenas", lat: 37.98, lon: 23.73, kind: "city" },
  { id: "ist", name: "Estambul", lat: 41.01, lon: 28.98, kind: "city" },
  { id: "nyc", name: "Nueva York", lat: 40.71, lon: -74.0, kind: "city" },
  { id: "mex", name: "Ciudad de México", lat: 19.43, lon: -99.13, kind: "city" },
  { id: "bue", name: "Buenos Aires", lat: -34.6, lon: -58.38, kind: "city" },
  { id: "scl", name: "Santiago", lat: -33.45, lon: -70.67, kind: "city" },
  { id: "lim", name: "Lima", lat: -12.05, lon: -77.04, kind: "city" },
  { id: "bog", name: "Bogotá", lat: 4.71, lon: -74.07, kind: "city" },
  { id: "sao", name: "São Paulo", lat: -23.55, lon: -46.63, kind: "city" },
  { id: "jnb", name: "Johannesburgo", lat: -26.2, lon: 28.05, kind: "city" },
  { id: "dxb", name: "Dubái", lat: 25.2, lon: 55.27, kind: "city" },
  { id: "del", name: "Delhi", lat: 28.61, lon: 77.21, kind: "city" },
  { id: "pek", name: "Pekín", lat: 39.9, lon: 116.4, kind: "city" },
  { id: "tyo", name: "Tokio", lat: 35.68, lon: 139.69, kind: "city" },
  { id: "syd", name: "Sídney", lat: -33.87, lon: 151.21, kind: "city" },

  // Costa — estado del mar
  { id: "lcg", name: "A Coruña", lat: 43.37, lon: -8.4, kind: "coast" },
  { id: "sse", name: "San Sebastián", lat: 43.32, lon: -1.98, kind: "coast" },
  { id: "cad", name: "Cádiz", lat: 36.53, lon: -6.29, kind: "coast" },
  { id: "mlg", name: "Málaga", lat: 36.72, lon: -4.42, kind: "coast" },
  { id: "pmi", name: "Palma", lat: 39.57, lon: 2.65, kind: "coast" },
  { id: "sdr", name: "Santander", lat: 43.46, lon: -3.81, kind: "coast" },
  { id: "fao", name: "Faro", lat: 37.02, lon: -7.93, kind: "coast" },
  { id: "nce", name: "Niza", lat: 43.7, lon: 7.27, kind: "coast" },
  { id: "nap", name: "Nápoles", lat: 40.85, lon: 14.27, kind: "coast" },
  { id: "mia", name: "Miami", lat: 25.79, lon: -80.13, kind: "coast" },
  { id: "lax", name: "Los Ángeles", lat: 33.98, lon: -118.47, kind: "coast" },
  { id: "hnl", name: "Honolulú", lat: 21.3, lon: -157.87, kind: "coast" },
  { id: "cpt", name: "Ciudad del Cabo", lat: -33.92, lon: 18.42, kind: "coast" },
  { id: "rec", name: "Recife", lat: -8.05, lon: -34.88, kind: "coast" },

  // Estaciones de esquí — nieve y cota
  { id: "baq", name: "Baqueira", lat: 42.7, lon: 0.93, kind: "ski" },
  { id: "frm", name: "Formigal", lat: 42.8, lon: -0.35, kind: "ski" },
  { id: "sne", name: "Sierra Nevada", lat: 37.1, lon: -3.4, kind: "ski" },
  { id: "grv", name: "Grandvalira", lat: 42.58, lon: 1.6, kind: "ski" },
  { id: "zrm", name: "Zermatt", lat: 46.02, lon: 7.75, kind: "ski" },
  { id: "chm", name: "Chamonix", lat: 45.92, lon: 6.87, kind: "ski" },
  { id: "ant", name: "St. Anton", lat: 47.13, lon: 10.27, kind: "ski" },
  { id: "crn", name: "Cortina d'Ampezzo", lat: 46.54, lon: 12.13, kind: "ski" },
  { id: "asp", name: "Aspen", lat: 39.19, lon: -106.82, kind: "ski" },
  { id: "whi", name: "Whistler", lat: 50.11, lon: -122.95, kind: "ski" },
  { id: "bar", name: "Bariloche", lat: -41.15, lon: -71.44, kind: "ski" },
  { id: "nsk", name: "Niseko", lat: 42.86, lon: 140.7, kind: "ski" },
];

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const MARINE_URL = "https://marine-api.open-meteo.com/v1/marine";

export interface DryingPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  temperatureC: number;
  humidityPercent: number;
  windKmh: number;
  precipitationMm: number;
  /** 0 (no seca nada) a 100 (tiende la ropa fuera y vuelve seca). */
  index: number;
  time: string;
}

export interface PollenPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Especie con más granos de las cinco que publica CAMS. */
  dominant: string | null;
  dominantGrains: number | null;
  level: PollenLevel;
  species: Record<string, number | null>;
  time: string;
}

export interface SeaPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  waveHeightM: number;
  swellHeightM: number | null;
  seaTempC: number | null;
  flag: BeachFlag;
  time: string;
}

export interface SnowPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Espesor en metros, tal como lo da Open-Meteo. */
  snowDepthM: number;
  snowfallCm: number;
  temperatureC: number;
  /** Altura de la isoterma de 0 °C: la cota de nieve aproximada. */
  freezingLevelM: number | null;
  time: string;
}

export interface EnvironmentGrid {
  drying: DryingPoint[];
  pollen: PollenPoint[];
  sea: SeaPoint[];
  snow: SnowPoint[];
}

export const EMPTY_ENVIRONMENT: EnvironmentGrid = { drying: [], pollen: [], sea: [], snow: [] };

interface OpenMeteoRow {
  current?: Record<string, number | string | null | undefined>;
}

function rowsOf(json: OpenMeteoRow | OpenMeteoRow[]): OpenMeteoRow[] {
  return Array.isArray(json) ? json : [json];
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function batched(url: string, places: EnvPlace[], params: string): string {
  const lat = places.map((place) => place.lat).join(",");
  const lon = places.map((place) => place.lon).join(",");
  return `${url}?latitude=${lat}&longitude=${lon}&current=${params}&timezone=UTC`;
}

export interface EnvironmentOptions {
  drying: boolean;
  pollen: boolean;
  sea: boolean;
  snow: boolean;
}

/**
 * Una sola rejilla para las cuatro capas: cada grupo se pide sólo si su capa
 * está encendida, y un grupo caído no vacía los demás (una API con latencia no
 * puede apagar el resto del globo).
 */
export function useEnvironmentGrid(enabled: EnvironmentOptions, intervalMs = 900_000) {
  const anyEnabled = enabled.drying || enabled.pollen || enabled.sea || enabled.snow;
  const coast = ENV_PLACES.filter((place) => place.kind === "coast");

  return usePolledConnector<EnvironmentGrid>(
    async (signal) => {
      const weatherNeeded = enabled.drying || enabled.snow;
      const [weather, pollen, marine] = await Promise.allSettled([
        weatherNeeded
          ? safeFetchJson<OpenMeteoRow | OpenMeteoRow[]>(
              batched(
                FORECAST_URL,
                ENV_PLACES,
                "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,snow_depth,snowfall,freezing_level_height",
              ),
              { signal, timeoutMs: 12_000 },
            )
          : Promise.resolve(null),
        enabled.pollen
          ? safeFetchJson<OpenMeteoRow | OpenMeteoRow[]>(
              batched(
                AIR_QUALITY_URL,
                ENV_PLACES,
                "grass_pollen,olive_pollen,birch_pollen,alder_pollen,ragweed_pollen",
              ),
              { signal, timeoutMs: 12_000 },
            )
          : Promise.resolve(null),
        enabled.sea
          ? safeFetchJson<OpenMeteoRow | OpenMeteoRow[]>(
              batched(MARINE_URL, coast, "wave_height,swell_wave_height,sea_surface_temperature"),
              { signal, timeoutMs: 12_000 },
            )
          : Promise.resolve(null),
      ]);

      // Si todo lo pedido falló, el conector falla: el panel tiene que poder
      // decir «esta capa no responde» en vez de mostrar una rejilla vacía.
      const requested = [weatherNeeded, enabled.pollen, enabled.sea].filter(Boolean).length;
      const failed = [weather, pollen, marine].filter((result) => result.status === "rejected").length;
      if (requested > 0 && failed === requested) {
        const first = [weather, pollen, marine].find((result) => result.status === "rejected");
        throw first && first.status === "rejected" ? first.reason : new Error("Open-Meteo no responde");
      }

      const grid: EnvironmentGrid = { drying: [], pollen: [], sea: [], snow: [] };

      if (weather.status === "fulfilled" && weather.value) {
        rowsOf(weather.value).forEach((row, i) => {
          const place = ENV_PLACES[i];
          const current = row.current;
          if (!place || !current) return;
          const temperatureC = numberOrNull(current.temperature_2m) ?? 0;
          const humidityPercent = numberOrNull(current.relative_humidity_2m) ?? 0;
          const windKmh = numberOrNull(current.wind_speed_10m) ?? 0;
          const precipitationMm = numberOrNull(current.precipitation) ?? 0;
          const time = typeof current.time === "string" ? current.time : "";

          grid.drying.push({
            id: place.id,
            name: place.name,
            lat: place.lat,
            lon: place.lon,
            temperatureC,
            humidityPercent,
            windKmh,
            precipitationMm,
            index: dryingIndex({ temperatureC, humidityPercent, windKmh, precipitationMm }),
            time,
          });
          // Sólo las estaciones y los puntos con nieve real: marcar 52 ceros
          // de «0 cm» taparía el globo sin decir nada.
          const snowDepthM = numberOrNull(current.snow_depth) ?? 0;
          const snowfallCm = numberOrNull(current.snowfall) ?? 0;
          if (place.kind === "ski" || snowDepthM > 0 || snowfallCm > 0) {
            grid.snow.push({
              id: place.id,
              name: place.name,
              lat: place.lat,
              lon: place.lon,
              snowDepthM,
              snowfallCm,
              temperatureC,
              freezingLevelM: numberOrNull(current.freezing_level_height),
              time,
            });
          }
        });
      }

      if (pollen.status === "fulfilled" && pollen.value) {
        rowsOf(pollen.value).forEach((row, i) => {
          const place = ENV_PLACES[i];
          const current = row.current;
          if (!place || !current) return;
          const species: Record<string, number | null> = {};
          for (const { key } of POLLEN_SPECIES) species[key] = numberOrNull(current[key]);
          const dominant = dominantPollen(species);
          // Sin ninguna de las cinco especies el punto no está cubierto por
          // CAMS (fuera de Europa), y no se pinta: un cero fingiría una medida.
          if (!dominant) return;
          grid.pollen.push({
            id: place.id,
            name: place.name,
            lat: place.lat,
            lon: place.lon,
            dominant: dominant.species,
            dominantGrains: dominant.grains,
            level: dominant.level,
            species,
            time: typeof current.time === "string" ? current.time : "",
          });
        });
      }

      if (marine.status === "fulfilled" && marine.value) {
        rowsOf(marine.value).forEach((row, i) => {
          const place = coast[i];
          const current = row.current;
          if (!place || !current) return;
          const waveHeightM = numberOrNull(current.wave_height);
          if (waveHeightM === null) return;
          grid.sea.push({
            id: place.id,
            name: place.name,
            lat: place.lat,
            lon: place.lon,
            waveHeightM,
            swellHeightM: numberOrNull(current.swell_wave_height),
            seaTempC: numberOrNull(current.sea_surface_temperature),
            flag: seaFlag(waveHeightM),
            time: typeof current.time === "string" ? current.time : "",
          });
        });
      }

      return grid;
    },
    EMPTY_ENVIRONMENT,
    intervalMs,
    anyEnabled,
  );
}
