import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/with-timeout";
import { countFabricatedIds, fetchAirTrafficDirect } from "@/lib/live-traffic";

/** Plazo de la función de tráfico aéreo: si no contesta, se conserva lo último. */
const REQUEST_TIMEOUT_MS = 25_000;

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
  /** La última lectura no es fresca: la capa sigue mostrando vuelos anteriores. */
  const [stale, setStale] = useState(false);

  const fetchAirTraffic = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fnError } = await withTimeout(
        supabase.functions.invoke<AirTrafficResponse>("air-traffic", { body: {} }),
        REQUEST_TIMEOUT_MS,
        "air-traffic",
      );

      if (fnError) {
        throw new Error(fnError.message);
      }

      const rows = data?.flights ?? [];
      // Dos generaciones de datos falsos: la que se marcaba con `mock: true` y
      // la que no lo hacía pero devolvía `icao24: "mock0000"`. Se detectan por
      // identificador, que es lo que no puede coincidir con un avión real.
      const fabricated = countFabricatedIds(rows.map((flight) => flight.icao24));
      const usable = !fnError && data && data.mock !== true && fabricated === 0 && rows.length > 0;

      if (usable) {
        setFlights(rows);
        setSource(data!.source ?? null);
        setUnavailable(false);
        setUnavailableReason(null);
        setLastUpdate(new Date(data!.timestamp));
        setStale(false);
        return;
      }

      // La función no trajo vuelos reales: se piden al proxy propio, que sí
      // llega a los feeds abiertos desde el servidor.
      const direct = await fetchAirTrafficDirect();
      const directRows = direct.flights ?? [];
      setFlights(directRows);
      setSource(direct.source ?? null);
      setUnavailable(direct.unavailable || directRows.length === 0);
      setUnavailableReason(
        direct.reason ??
          (fabricated > 0
            ? `La función air-traffic desplegada sirve ${fabricated} vuelos simulados; se usa el proxy real`
            : null),
      );
      if (direct.timestamp) setLastUpdate(new Date(direct.timestamp));
      setStale(false);
    } catch (err) {
      console.error("Air traffic fetch error:", err);
      // No se vacía la capa: se marca como no fresca y se conservan los vuelos
      // anteriores, que siguen siendo más útiles que un globo sin tráfico.
      setStale(true);
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
    /** La última lectura falló o llegó tarde; `flights` son las de antes. */
    stale,
    refresh: fetchAirTraffic,
    count: flights.length,
  };
}
