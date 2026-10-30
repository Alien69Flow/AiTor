import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/with-timeout";
import { countFabricatedIds, fetchMarineTrafficDirect } from "@/lib/live-traffic";

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

      const rows = data?.ships ?? [];
      // La función desplegada devuelve barcos generados al azar **sin** marcar
      // `mock: true`: se reconocen por el MMSI, que en las filas inventadas
      // empieza por «mock» y en el AIS real es siempre numérico.
      const fabricated = countFabricatedIds(rows.map((ship) => ship.mmsi));
      const usable = !fnError && data && data.mock !== true && fabricated === 0 && rows.length > 0;

      if (usable) {
        setShips(rows);
        setSource(data!.source ?? null);
        setCoverage(data!.coverage ?? null);
        setUnavailable(false);
        setUnavailableReason(null);
        setLastUpdate(new Date(data!.timestamp));
        setStale(false);
        return;
      }

      // Sin barcos reales de la función, se piden al proxy propio (Digitraffic,
      // AIS abierto del Báltico: la cobertura se declara, no se extrapola).
      const direct = await fetchMarineTrafficDirect();
      const directRows = direct.ships ?? [];
      setShips(directRows);
      setSource(direct.source ?? null);
      setCoverage(direct.coverage ?? null);
      setUnavailable(direct.unavailable || directRows.length === 0);
      setUnavailableReason(
        direct.reason ??
          (fabricated > 0
            ? `La función marine-traffic desplegada sirve ${fabricated} barcos simulados; se usa el proxy real`
            : null),
      );
      if (direct.timestamp) setLastUpdate(new Date(direct.timestamp));
      setStale(false);
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
