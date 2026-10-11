import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Ship {
  mmsi: string; name: string; type: string; latitude: number; longitude: number;
  speed: number; heading: number; destination: string; timestamp: string;
}

interface MarineTrafficResponse {
  available: boolean; source?: string; code?: string; error?: string;
  count: number; ships: Ship[];
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  timestamp: string;
}

export function useMarineTraffic(enabled = true, refreshMs = 180000) {
  const [ships, setShips] = useState<Ship[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [source, setSource] = useState<string | null>(null);

  const fetchMarineTraffic = useCallback(async () => {
    if (!enabled) {
      setShips([]); setIsLoading(false); setError(null); setSource(null); return;
    }
    try {
      setIsLoading(true); setError(null);
      const { data, error: fnError } =
        await supabase.functions.invoke<MarineTrafficResponse>("marine-traffic", { body: {} });
      if (fnError) throw new Error(fnError.message);
      if (!data) throw new Error("Marine AIS source returned no response");

      if (!data.available) {
        setShips([]); setSource(null);
        setLastUpdate(new Date(data.timestamp));
        setError(data.error || data.code || "Marine AIS source unavailable");
        return;
      }

      setShips(data.ships || []);
      setSource(data.source || "VesselFinder LiveData / AIS");
      setLastUpdate(new Date(data.timestamp));
    } catch (err) {
      console.error("Marine traffic fetch error:", err);
      setShips([]); setSource(null);
      setError(err instanceof Error ? err.message : "Failed to fetch marine AIS data");
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchMarineTraffic();
    if (!enabled) return;
    const interval = setInterval(fetchMarineTraffic, refreshMs);
    return () => clearInterval(interval);
  }, [enabled, refreshMs, fetchMarineTraffic]);

  return { ships, isLoading, error, lastUpdate, source, refresh: fetchMarineTraffic, count: ships.length };
}
