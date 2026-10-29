import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/with-timeout";

/** Plazo de la función de tráfico marítimo: si no contesta, se conserva lo último. */
const REQUEST_TIMEOUT_MS = 25_000;

export interface Ship {
  mmsi: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  /** Nudos, tal como los reporta el AIS. */
  speed: number;
  heading: number;
  destination: string | null;
  timestamp: string;
}

interface MarineTrafficResponse {
  count: number;
  ships: Ship[];
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  /** Fuente que respondió: "vesselfinder" o "digitraffic". */
  source: string | null;
  /** Cobertura real de esa fuente (Digitraffic solo cubre el Báltico). */
  coverage: string | null;
  /** `true` cuando ninguna fuente AIS respondió: no hay barcos inventados. */
  unavailable?: boolean;
  reason?: string | null;
  /** Marca de un despliegue antiguo que devolvía barcos inventados. */
  mock?: boolean;
  timestamp: string;
}

export function useMarineTraffic() {
  const [ships, setShips] = useState<Ship[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);
  /** La última lectura no es fresca: la capa sigue mostrando barcos anteriores. */
  const [stale, setStale] = useState(false);

  const fetchMarineTraffic = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fnError } = await withTimeout(
        supabase.functions.invoke<MarineTrafficResponse>("marine-traffic", { body: {} }),
        REQUEST_TIMEOUT_MS,
        "marine-traffic",
      );

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data) {
        // Hasta que se despliegue la función nueva, la versión en producción
        // sigue contestando `mock: true` con 40 barcos generados al azar. Esos
        // barcos no se dibujan: una capa inventada se lee como AIS real.
        const legacyMock = data.mock === true;
        setShips(legacyMock ? [] : data.ships || []);
        setSource(legacyMock ? null : data.source ?? null);
        setCoverage(legacyMock ? null : data.coverage ?? null);
        setUnavailable(legacyMock || (data.unavailable ?? false));
        setUnavailableReason(
          legacyMock
            ? "La función marine-traffic desplegada aún sirve barcos simulados; falta desplegarla"
            : data.reason ?? null,
        );
        setLastUpdate(new Date(data.timestamp));
        setStale(false);
      }
    } catch (err) {
      console.error("Marine traffic fetch error:", err);
      // No se vacía la capa: se marca como no fresca y se conservan los barcos
      // anteriores, que siguen siendo más útiles que un globo sin AIS.
      setStale(true);
      setError(err instanceof Error ? err.message : "Failed to fetch marine traffic");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarineTraffic();
    
    // Refresh every 3 minutes
    const interval = setInterval(fetchMarineTraffic, 180000);
    return () => clearInterval(interval);
  }, [fetchMarineTraffic]);

  return {
    ships,
    isLoading,
    error,
    lastUpdate,
    source,
    coverage,
    /** Ninguna fuente AIS real respondió: la capa está vacía, no simulada. */
    unavailable,
    unavailableReason,
    /** La última lectura falló o llegó tarde; `ships` son las de antes. */
    stale,
    refresh: fetchMarineTraffic,
    count: ships.length,
  };
}
