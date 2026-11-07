import { finiteReading } from "@/lib/surface-weather";
import { safeFetchJson, usePolledConnector } from "@/lib/connectors";

export interface SurfaceWeatherPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  pressureHpa: number | null;
  windSpeedMs: number | null;
  windDirectionDeg: number | null;
  temperatureC: number | null;
  humidityPercent: number | null;
  time: string;
}

/** Light surface grid — enough for wind barbs and isobar interpolation. */
const GRID: { id: string; name: string; lat: number; lon: number }[] = [
  { id: "mad", name: "Madrid", lat: 40.41, lon: -3.7 },
  { id: "zgz", name: "Zaragoza", lat: 41.65, lon: -0.88 },
  { id: "bcn", name: "Barcelona", lat: 41.39, lon: 2.17 },
  { id: "lis", name: "Lisboa", lat: 38.72, lon: -9.14 },
  { id: "par", name: "Paris", lat: 48.85, lon: 2.35 },
  { id: "lon", name: "London", lat: 51.5, lon: -0.13 },
  { id: "ber", name: "Berlin", lat: 52.52, lon: 13.4 },
  { id: "rom", name: "Roma", lat: 41.9, lon: 12.5 },
  { id: "ath", name: "Athens", lat: 37.98, lon: 23.73 },
  { id: "kyi", name: "Kyiv", lat: 50.45, lon: 30.52 },
  { id: "ist", name: "Istanbul", lat: 41.01, lon: 28.98 },
  { id: "cas", name: "Casablanca", lat: 33.57, lon: -7.59 },
  { id: "nyc", name: "New York", lat: 40.71, lon: -74.0 },
  { id: "mex", name: "Ciudad de Mexico", lat: 19.43, lon: -99.13 },
  { id: "bue", name: "Buenos Aires", lat: -34.6, lon: -58.38 },
  { id: "jnb", name: "Johannesburg", lat: -26.2, lon: 28.05 },
  { id: "dxb", name: "Dubai", lat: 25.2, lon: 55.27 },
  { id: "del", name: "Delhi", lat: 28.61, lon: 77.21 },
  { id: "bjs", name: "Beijing", lat: 39.9, lon: 116.4 },
  { id: "tyo", name: "Tokyo", lat: 35.68, lon: 139.69 },
  { id: "syd", name: "Sydney", lat: -33.87, lon: 151.21 },
  { id: "rio", name: "Rio de Janeiro", lat: -22.91, lon: -43.17 },
  { id: "sao", name: "São Paulo", lat: -23.55, lon: -46.63 },
  { id: "lag", name: "Lagos", lat: 6.52, lon: 3.38 },
  { id: "cai", name: "Cairo", lat: 30.04, lon: 31.24 },
  { id: "kin", name: "Kinshasa", lat: -4.33, lon: 15.31 },
  { id: "mum", name: "Mumbai", lat: 19.08, lon: 72.88 },
  { id: "dha", name: "Dhaka", lat: 23.81, lon: 90.41 },
  { id: "kar", name: "Karachi", lat: 24.86, lon: 67.01 },
  { id: "sha", name: "Shanghai", lat: 31.23, lon: 121.47 },
  { id: "jak", name: "Jakarta", lat: -6.21, lon: 106.85 },
  { id: "man", name: "Manila", lat: 14.6, lon: 120.98 },
  { id: "seo", name: "Seoul", lat: 37.57, lon: 126.98 },
  { id: "osa", name: "Osaka", lat: 34.69, lon: 135.5 },
  { id: "ban", name: "Bangkok", lat: 13.76, lon: 100.5 },
  { id: "la", name: "Los Angeles", lat: 34.05, lon: -118.24 },
  { id: "tor", name: "Toronto", lat: 43.65, lon: -79.38 },
  { id: "lim", name: "Lima", lat: -12.05, lon: -77.04 },
  { id: "mel", name: "Melbourne", lat: -37.81, lon: 144.96 },
  { id: "auk", name: "Auckland", lat: -36.85, lon: 174.76 },

];

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  current?: {
    time: string;
    surface_pressure?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    temperature_2m?: number;
    relative_humidity_2m?: number;
  };
}

/**
 * Open-Meteo surface vectors (pressure + wind) for a light global grid.
 * One batched request per poll — Open-Meteo accepts comma-separated coords.
 */
export function useSurfaceWeather(enabled: boolean, intervalMs = 900_000) {
  return usePolledConnector<SurfaceWeatherPoint[]>(
    async (signal) => {
      const lat = GRID.map((g) => g.lat).join(",");
      const lon = GRID.map((g) => g.lon).join(",");
      const url = `${OPEN_METEO}?latitude=${lat}&longitude=${lon}&timezone=UTC&wind_speed_unit=ms&current=surface_pressure,wind_speed_10m,wind_direction_10m,temperature_2m,relative_humidity_2m`;
      const json = await safeFetchJson<OpenMeteoResponse | OpenMeteoResponse[]>(url, {
        signal,
        timeoutMs: 9000,
      });
      const rows = Array.isArray(json) ? json : [json];
      return rows
        .map((row, i) => {
          const meta = GRID[i];
          if (!meta || !row.current) return null;
          return {
            id: meta.id,
            name: meta.name,
            lat: meta.lat,
            lon: meta.lon,
            pressureHpa: finiteReading(row.current.surface_pressure),
            windSpeedMs: finiteReading(row.current.wind_speed_10m),
            windDirectionDeg: finiteReading(row.current.wind_direction_10m),
            temperatureC: finiteReading(row.current.temperature_2m),
            humidityPercent: finiteReading(row.current.relative_humidity_2m),
            time: row.current.time ?? "",
          } satisfies SurfaceWeatherPoint;
        })
        .filter((p): p is SurfaceWeatherPoint => p !== null);
    },
    [],
    intervalMs,
    enabled,
  );
}
