import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Flight {
  icao24: string;
  callsign: string;
  origin: string | null;
  destination: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Metros sobre el nivel del mar. */
  altitude: number;
  /** Metros por segundo. */
  velocity: number;
  heading: number;
  /** Código ICAO de tipo (p. ej. "A20N") si la fuente lo conoce. */
  aircraftType: string | null;
  /** Categoría de emisor ADS-B (A1..A7, B*, C*): elige la silueta. */
  aircraftCategory: string | null;
  timestamp: string;
}

interface AirTrafficResponse {
  count: number;
  flights: Flight[];
  bbox: { lamin: number; lamax: number; lomin: number; lomax: number };
  /** Fuente que respondió: "opensky" o "adsb.lol". `null` si ninguna lo hizo. */
  source: string | null;
  /** `true` cuando ninguna fuente aérea respondió: no hay vuelos inventados. */
  unavailable?: boolean;
  reason?: string | null;
  /** Marca de un despliegue antiguo que devolvía vuelos inventados. */
  mock?: boolean;
  timestamp: string;
}

export function useAirTraffic() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);

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
        // La función desplegada todavía puede contestar `mock: true` con vuelos
        // generados al azar; se descartan en vez de pintarlos como tráfico.
        const legacyMock = data.mock === true;
        setFlights(legacyMock ? [] : data.flights || []);
        setSource(legacyMock ? null : data.source ?? null);
        setUnavailable(legacyMock || (data.unavailable ?? false));
        setUnavailableReason(
          legacyMock
            ? "La función air-traffic desplegada aún sirve vuelos simulados; falta desplegarla"
            : data.reason ?? null,
        );
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
    source,
    /** Ninguna fuente real respondió: la capa está vacía, no simulada. */
    unavailable,
    unavailableReason,
    refresh: fetchAirTraffic,
    count: flights.length,
  };
}
