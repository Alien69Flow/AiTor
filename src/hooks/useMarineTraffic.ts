import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  count: number;
  ships: Ship[];
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  mock?: boolean;
  timestamp: string;
}

export function useMarineTraffic() {
  const [ships, setShips] = useState<Ship[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isMockData, setIsMockData] = useState(false);

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
        setIsMockData(data.mock || false);
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
    isMockData,
    refresh: fetchMarineTraffic,
    count: ships.length,
  };
}
