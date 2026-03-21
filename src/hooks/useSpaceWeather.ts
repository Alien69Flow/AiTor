import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SpaceWeather {
  kpIndex: number;
  solarStorm: boolean;
  stormLevel: string;
  radioBlackout: string;
  geomagneticStorm: string;
  timestamp: string;
}

const DEFAULT: SpaceWeather = {
  kpIndex: 0,
  solarStorm: false,
  stormLevel: "none",
  radioBlackout: "none",
  geomagneticStorm: "none",
  timestamp: "",
};

export function useSpaceWeather(intervalMs = 120_000) {
  const [data, setData] = useState<SpaceWeather>(DEFAULT);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const { data: result, error } = await supabase.functions.invoke("noaa-space-weather");
      if (error) throw error;
      if (result) setData(result as SpaceWeather);
    } catch (e) {
      console.warn("Space weather fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, intervalMs);
    return () => clearInterval(id);
  }, [fetchData, intervalMs]);

  return { ...data, loading };
}
