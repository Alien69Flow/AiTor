import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Flight {
  icao24: string;
  callsign: string;
  /** ICAO aircraft type designator, when supplied by the ADS-B source. */
  aircraftType?: string | null;
  /** ADS-B emitter category code (for example A1-A7), when supplied by the source. */
  aircraftCategory?: string | null;
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

  const inFlightRef = useRef(false);

  const fetchAirTraffic = useCallback(async () => {
    // Skip overlapping interval/manual refreshes; never let an older response
    // race a newer snapshot or create duplicate requests.
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      setError(null);

      const { data, error: fnError } = await supabase.functions.invoke<AirTrafficResponse>("air-traffic", {
        body: {},
      });
      if (fnError) throw new Error(fnError.message);
      if (!data || !Array.isArray(data.flights)) {
        throw new Error("Invalid air traffic response: expected flights array");
      }
      const valid = data.flights.filter((flight) =>
        Number.isFinite(flight.latitude) &&
        Number.isFinite(flight.longitude) &&
        flight.latitude >= -90 && flight.latitude <= 90 &&
        flight.longitude >= -180 && flight.longitude <= 180
      );
      if (valid.length === 0) throw new Error("Air traffic response contained no valid positions");
      setFlights(valid);
      setIsMockData(data.mock || false);
      const timestamp = new Date(data.timestamp);
      setLastUpdate(Number.isNaN(timestamp.getTime()) ? new Date() : timestamp);
    } catch (err) {
      console.error("Air traffic fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch air traffic");
      // Keep last known good flights and timestamp on failure.
    } finally {
      inFlightRef.current = false;
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
