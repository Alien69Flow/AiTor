import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Flight {
  icao24: string;
  callsign: string;
  origin: string | null;
  destination: string | null;
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  heading: number;
  timestamp: string;
}

interface AirTrafficResponse {
  count: number;
  flights: Flight[];
  bbox: { lamin: string; lamax: string; lomin: string; lomax: string };
  mock?: boolean;
  timestamp: string;
}

export function useAirTraffic() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isMockData, setIsMockData] = useState(false);

  const fetchAirTraffic = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fnError } = await supabase.functions.invoke<AirTrafficResponse>("air-traffic", {
        body: {},
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data) {
        setFlights(data.flights || []);
        setIsMockData(data.mock || false);
        setLastUpdate(new Date(data.timestamp));
      }
    } catch (err) {
      console.error("Air traffic fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch air traffic");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAirTraffic();
    
    // Refresh every 2 minutes
    const interval = setInterval(fetchAirTraffic, 120000);
    return () => clearInterval(interval);
  }, [fetchAirTraffic]);

  return {
    flights,
    isLoading,
    error,
    lastUpdate,
    isMockData,
    refresh: fetchAirTraffic,
    count: flights.length,
  };
}
