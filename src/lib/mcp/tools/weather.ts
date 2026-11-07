import { toolResult, type McpTool } from "../registry";
import { dominantPollen, dryingIndex, dryingVerdict, seaFlag } from "@/lib/environment-metrics";

/**
 * Previsión y estado del entorno con Open-Meteo, la misma fuente que pinta el
 * globo. Tres APIs abiertas, sin clave:
 *
 *  - `geocoding-api.open-meteo.com`  → nombre de lugar a coordenadas
 *  - `api.open-meteo.com/v1/forecast` → ahora mismo y las próximas horas
 *  - `marine-api` / `air-quality-api` → oleaje y polen, cuando el punto los tiene
 *
 * Es la herramienta que contesta a «¿puedo tender la ropa?» y a «¿me baño hoy?»
 * con el dato delante en vez de con una estimación. Cuando una de las tres
 * respuestas opcionales no cubre el punto —el polen es sólo Europa, el oleaje
 * sólo el mar— se devuelve `null` y se dice por qué; no se rellena con ceros.
 */

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const MARINE_URL = "https://marine-api.open-meteo.com/v1/marine";
const AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";

const TIMEOUT_MS = 12_000;
const HOURS = 6;

interface Coordinates {
  lat: number;
  lon: number;
  name: string;
}

interface CurrentRow {
  time?: string;
  temperature_2m?: number;
  relative_humidity_2m?: number;
  wind_speed_10m?: number;
  precipitation?: number;
  snow_depth?: number;
  freezing_level_height?: number;
  wave_height?: number;
  swell_wave_height?: number;
  sea_surface_temperature?: number;
  grass_pollen?: number;
  olive_pollen?: number;
  birch_pollen?: number;
  alder_pollen?: number;
  ragweed_pollen?: number;
}

interface OpenMeteoResponse {
  current?: CurrentRow;
  hourly?: {
    time?: string[];
    precipitation_probability?: (number | null)[];
    precipitation?: (number | null)[];
  };
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Una respuesta opcional que falla no puede tumbar la herramienta. */
async function optional(
  fetchImpl: typeof fetch,
  url: string,
): Promise<OpenMeteoResponse | null> {
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) return null;
    return (await response.json()) as OpenMeteoResponse;
  } catch {
    return null;
  }
}

export async function resolvePlace(
  fetchImpl: typeof fetch,
  args: { lat?: unknown; lon?: unknown; place?: unknown },
): Promise<Coordinates> {
  const lat = asNumber(args.lat);
  const lon = asNumber(args.lon);
  if (lat !== null && lon !== null) {
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new Error("Coordenadas fuera de rango (−90..90 lat, −180..180 lon)");
    }
    return { lat, lon, name: typeof args.place === "string" && args.place.trim() ? args.place.trim() : `${lat}, ${lon}` };
  }

  const place = typeof args.place === "string" ? args.place.trim() : "";
  if (!place) throw new Error("Indica `place` (nombre) o `lat` + `lon`");

  const url = `${GEOCODING_URL}?name=${encodeURIComponent(place)}&count=1&language=es&format=json`;
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`El buscador de lugares respondió ${response.status}`);
  const payload = (await response.json()) as {
    results?: { name?: string; latitude?: number; longitude?: number; country_code?: string }[];
  };
  const hit = payload.results?.[0];
  if (!hit || typeof hit.latitude !== "number" || typeof hit.longitude !== "number") {
    throw new Error(`No encuentro «${place}»; prueba con otro nombre o con coordenadas`);
  }
  const name = hit.country_code ? `${hit.name ?? place} (${hit.country_code})` : (hit.name ?? place);
  return { lat: hit.latitude, lon: hit.longitude, name };
}

export const weatherTools: McpTool[] = [
  {
    definition: {
      name: "weather.outlook",
      title: "Previsión y entorno",
      description:
        "Estado actual y próximas horas de un lugar: temperatura, humedad, viento, lluvia, índice de " +
        "secado de la ropa, nieve y cota, oleaje con bandera de baño y polen (Europa). Fuente: Open-Meteo. " +
        "Sirve para responder si se puede tender la ropa, bañarse o esquiar.",
      minTier: "free",
      inputSchema: {
        type: "object",
        properties: {
          place: { type: "string", description: "Nombre del lugar, p. ej. «Zaragoza» o «Baqueira»." },
          lat: { type: "number", description: "Latitud, si ya la conoces." },
          lon: { type: "number", description: "Longitud, si ya la conoces." },
        },
      },
    },
    run: async (args, context) => {
      const place = await resolvePlace(context.fetch, args);

      const current =
        "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,snow_depth,freezing_level_height";
      const forecastUrl =
        `${FORECAST_URL}?latitude=${place.lat}&longitude=${place.lon}&current=${current}` +
        `&hourly=precipitation_probability,precipitation&forecast_hours=${HOURS}&timezone=UTC`;

      const response = await context.fetch(forecastUrl, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Open-Meteo respondió ${response.status}`);
      const forecast = (await response.json()) as OpenMeteoResponse;
      const now = forecast.current;
      if (!now) throw new Error("Open-Meteo no devolvió el estado actual");

      const temperatureC = asNumber(now.temperature_2m) ?? 0;
      const humidityPercent = asNumber(now.relative_humidity_2m) ?? 0;
      const windKmh = asNumber(now.wind_speed_10m) ?? 0;
      const precipitationMm = asNumber(now.precipitation) ?? 0;
      const index = dryingIndex({ temperatureC, humidityPercent, windKmh, precipitationMm });

      const [marine, air] = await Promise.all([
        optional(
          context.fetch,
          `${MARINE_URL}?latitude=${place.lat}&longitude=${place.lon}` +
            `&current=wave_height,swell_wave_height,sea_surface_temperature&timezone=UTC`,
        ),
        optional(
          context.fetch,
          `${AIR_QUALITY_URL}?latitude=${place.lat}&longitude=${place.lon}` +
            `&current=grass_pollen,olive_pollen,birch_pollen,alder_pollen,ragweed_pollen&timezone=UTC`,
        ),
      ]);

      const waveHeightM = asNumber(marine?.current?.wave_height);
      const pollen = air?.current
        ? dominantPollen({
            grass_pollen: asNumber(air.current.grass_pollen),
            olive_pollen: asNumber(air.current.olive_pollen),
            birch_pollen: asNumber(air.current.birch_pollen),
            alder_pollen: asNumber(air.current.alder_pollen),
            ragweed_pollen: asNumber(air.current.ragweed_pollen),
          })
        : null;

      const hourlyTime = forecast.hourly?.time ?? [];
      const hourlyProbability = forecast.hourly?.precipitation_probability ?? [];
      const hourlyPrecip = forecast.hourly?.precipitation ?? [];
      const hours = hourlyTime.slice(0, HOURS).map((time, i) => ({
        time,
        precipitationProbability: asNumber(hourlyProbability[i]),
        precipitationMm: asNumber(hourlyPrecip[i]),
      }));

      return toolResult({
        source: "open-meteo.com",
        place,
        observedAt: now.time ?? null,
        now: {
          temperatureC,
          humidityPercent,
          windKmh,
          precipitationMm,
          precipitationProbability: hours[0]?.precipitationProbability ?? null,
        },
        drying: { index, verdict: dryingVerdict(index) },
        snow: {
          snowDepthCm: Math.round((asNumber(now.snow_depth) ?? 0) * 100),
          freezingLevelM: asNumber(now.freezing_level_height),
        },
        sea:
          waveHeightM === null
            ? { available: false, note: "Open-Meteo Marine no cubre este punto (tierra adentro)." }
            : {
                available: true,
                waveHeightM,
                swellHeightM: asNumber(marine?.current?.swell_wave_height),
                seaTemperatureC: asNumber(marine?.current?.sea_surface_temperature),
                // Deducted from wave height, not the lifeguard's flag.
                flag: seaFlag(waveHeightM),
                flagNote: "La bandera se deduce del oleaje; en playa manda la del socorrista.",
              },
        pollen:
          pollen === null
            ? { available: false, note: "CAMS sólo publica recuentos de polen en Europa." }
            : { available: true, ...pollen, unit: "granos/m³" },
        nextHours: hours,
      });
    },
  },
];
