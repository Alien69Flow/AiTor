import { useState, useEffect, useCallback } from "react";

export interface Earthquake {
  id: string;
  lat: number;
  lon: number;
  magnitude: number;
  place: string;
  time: number;
  depth: number;
  url: string;
}

const USGS_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";

export function useEarthquakes(intervalMs = 300_000) {
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(USGS_URL);
      if (!res.ok) throw new Error("USGS fetch failed");
      const json = await res.json();
      const quakes: Earthquake[] = (json.features || []).map((f: any) => ({
        id: f.id,
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
        magnitude: f.properties.mag || 0,
        place: f.properties.place || "Unknown",
        time: f.properties.time,
        depth: f.geometry.coordinates[2] || 0,
        url: f.properties.url || "",
      }));
      setEarthquakes(quakes);
    } catch (e) {
      console.warn("USGS earthquake fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, intervalMs);
    return () => clearInterval(id);
  }, [fetchData, intervalMs]);

  return { earthquakes, loading };
}
