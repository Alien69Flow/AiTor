import { safeFetchJson, usePolledConnector } from "@/lib/connectors";

export interface FireDetection {
  id: string;
  lat: number;
  lon: number;
  brightness: number;
  confidence: string;
  acquired: string;
  satellite: string;
}

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  "https://wkdtvrxavkhbifjtvvdw.supabase.co";

/**
 * NASA FIRMS (VIIRS) active fire detections, proxied server-side so the
 * FIRMS map key never reaches the bundle. Defaults to Spain (ESP).
 */
export function useFirmsFires(enabled: boolean, country = "ESP", intervalMs = 1_800_000) {
  return usePolledConnector<FireDetection[]>(
    async (signal) => {
      const json = await safeFetchJson<{ fires?: FireDetection[]; error?: string }>(
        `${SUPABASE_URL}/functions/v1/globe-feeds?feed=firms&country=${encodeURIComponent(country)}`,
        { signal, timeoutMs: 12000 },
      );
      if (json.error) throw new Error(json.error);
      return json.fires ?? [];
    },
    [],
    intervalMs,
    enabled,
  );
}
