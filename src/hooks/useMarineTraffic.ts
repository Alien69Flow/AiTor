import { useState, useEffect, useCallback, useRef } from "react";
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

  const inFlightRef = useRef(false);

  const fetchMarineTraffic = useCallback(async () => {
    // Avoid overlapping refreshes from the interval and manual refresh action.
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      setError(null);

      const { data, error: fnError } = await supabase.functions.invoke<MarineTrafficResponse>("marine-traffic", {
        body: {},
      });
      if (fnError) throw new Error(fnError.message);
      if (!data || !Array.isArray(data.ships)) {
        throw new Error("Invalid marine traffic response: expected ships array");
      }
      const valid = data.ships.filter((ship) =>
        Number.isFinite(ship.latitude) &&
        Number.isFinite(ship.longitude) &&
        ship.latitude >= -90 && ship.latitude <= 90 &&
        ship.longitude >= -180 && ship.longitude <= 180
      );
      if (valid.length === 0) throw new Error("Marine traffic response contained no valid positions");
      setShips(valid);
      setIsMockData(data.mock || false);
      const timestamp = new Date(data.timestamp);
      setLastUpdate(Number.isNaN(timestamp.getTime()) ? new Date() : timestamp);
    } catch (err) {
      console.error("Marine traffic fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch marine traffic");
      // Keep last known good ships and timestamp on failure.
    } finally {
      inFlightRef.current = false;
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
