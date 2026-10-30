import { safeFetchJson, usePolledConnector } from "@/lib/connectors";
import { SUPABASE_URL } from "@/integrations/supabase/client";

export interface FireDetection {
  id: string;
  lat: number;
  lon: number;
  brightness: number;
  confidence: string;
  acquired: string;
  satellite: string;
  /**
   * De dónde sale la detección. FIRMS cuando hay clave de mapa; si no la hay,
   * el respaldo son los incendios abiertos de EONET, y el globo lo dice en vez
   * de atribuir a FIRMS un punto que no ha medido.
   */
  source?: string;
}

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
