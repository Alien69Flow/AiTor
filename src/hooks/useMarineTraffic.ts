import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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

  const fetchMarineTraffic = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fnError } = await supabase.functions.invoke<MarineTrafficResponse>("marine-traffic", {
        body: {},
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data) {
        setShips(data.ships || []);
        setSource(data.source ?? null);
        setCoverage(data.coverage ?? null);
        setUnavailable(data.unavailable ?? false);
        setUnavailableReason(data.reason ?? null);
        setLastUpdate(new Date(data.timestamp));
      }
    } catch (err) {
      console.error("Marine traffic fetch error:", err);
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
    refresh: fetchMarineTraffic,
    count: ships.length,
  };
}
