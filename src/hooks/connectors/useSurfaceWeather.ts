import { safeFetchJson, usePolledConnector } from "@/lib/connectors";

export interface SurfaceWeatherPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  pressureHpa: number;
  windSpeedMs: number;
  windDirectionDeg: number;
  temperatureC: number;
  humidityPercent: number;
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
      const url = `${OPEN_METEO}?latitude=${lat}&longitude=${lon}&current=surface_pressure,wind_speed_10m,wind_direction_10m,temperature_2m,relative_humidity_2m`;
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
            pressureHpa: row.current.surface_pressure ?? 0,
            windSpeedMs: row.current.wind_speed_10m ?? 0,
            windDirectionDeg: row.current.wind_direction_10m ?? 0,
            temperatureC: row.current.temperature_2m ?? 0,
            humidityPercent: row.current.relative_humidity_2m ?? 0,
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
