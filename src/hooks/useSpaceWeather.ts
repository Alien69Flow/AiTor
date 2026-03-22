import { useState, useEffect, useCallback } from "react";

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
      // Direct fetch to NOAA (CORS-friendly public API)
      const [kpRes, scalesRes] = await Promise.all([
        fetch("https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"),
        fetch("https://services.swpc.noaa.gov/products/noaa-scales.json"),
      ]);

      let kpIndex = 0;
      if (kpRes.ok) {
        const raw = await kpRes.json();
        if (Array.isArray(raw) && raw.length > 1) {
          const latest = raw[raw.length - 1];
          kpIndex = parseFloat(latest[1]) || 0;
        }
      }

      let solarStorm = false;
      let stormLevel = "none";
      let radioBlackout = "none";
      let geomagneticStorm = "none";

      if (scalesRes.ok) {
        const scalesData = await scalesRes.json();
        if (scalesData?.["0"]) {
          const current = scalesData["0"];
          const rScale = current.R?.Scale || "0";
          const sScale = current.S?.Scale || "0";
          const gScale = current.G?.Scale || "0";
          radioBlackout = rScale !== "0" ? `R${rScale}` : "none";
          stormLevel = sScale !== "0" ? `S${sScale}` : "none";
          geomagneticStorm = gScale !== "0" ? `G${gScale}` : "none";
          solarStorm = parseInt(rScale) >= 1 || parseInt(sScale) >= 1 || parseInt(gScale) >= 1;
        }
      }

      setData({
        kpIndex,
        solarStorm,
        stormLevel,
        radioBlackout,
        geomagneticStorm,
        timestamp: new Date().toISOString(),
      });
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
