import { usePolledConnector, safeFetchJson } from "@/lib/connectors";

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  "https://wkdtvrxavkhbifjtvvdw.supabase.co";

export interface Ship {
  mmsi: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  destination: string;
  timestamp: string;
}

interface MarineTrafficResponse {
  ships?: Ship[];
  error?: string;
}

export function useMarineTraffic(enabled = true, intervalMs = 180_000) {
  return usePolledConnector<Ship[]>(
    async (signal) => {
      const response = await safeFetchJson<MarineTrafficResponse>(
        `${SUPABASE_URL}/functions/v1/marine-traffic`,
        { signal, timeoutMs: 12_000 },
      );

      if (response.error) {
        throw new Error(response.error);
      }

      return (response.ships ?? []).filter(
        (ship) =>
          Number.isFinite(ship.latitude) &&
          Number.isFinite(ship.longitude) &&
          typeof ship.mmsi === "string",
      );
    },
    [],
    intervalMs,
    enabled,
  );
}
