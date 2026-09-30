import { usePolledConnector } from "@/lib/connectors";
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
  ships?: Ship[];
}

export function useMarineTraffic(enabled = true, intervalMs = 180_000) {
  const connector = usePolledConnector<Ship[]>(
    async () => {
      const { data, error } = await supabase.functions.invoke<MarineTrafficResponse>(
        "marine-traffic",
        { body: {} },
      );

      if (error) {
        throw new Error(error.message || "Marine traffic provider unavailable");
      }
      if (!data) {
        throw new Error("Marine traffic provider returned no response");
      }

      const ships = data.ships ?? [];
      if (ships.some((ship) => ship.mmsi.startsWith("mock"))) {
        throw new Error("Marine provider returned synthetic data");
      }

      return ships.filter(
        (ship) =>
          Number.isFinite(ship.latitude) &&
          Number.isFinite(ship.longitude) &&
          typeof ship.mmsi === "string" &&
          ship.mmsi.length > 0,
      );
    },
    [],
    intervalMs,
    enabled,
  );

  return {
    ships: connector.data,
    isLoading: connector.loading,
    error: connector.error,
    lastUpdate: connector.lastUpdate,
    refresh: connector.refresh,
    count: connector.data.length,
  };
}
