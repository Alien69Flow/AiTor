import { useState, useEffect, useCallback } from "react";

export interface NasaEvent {
  id: string;
  title: string;
  category: string;
  lat: number;
  lon: number;
  date: string;
  link: string;
}

const EONET_URL = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=30";

export function useNasaEvents(intervalMs = 600_000) {
  const [events, setEvents] = useState<NasaEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(EONET_URL);
      if (!res.ok) throw new Error("NASA EONET fetch failed");
      const json = await res.json();
      const parsed: NasaEvent[] = (json.events || [])
        .filter((e: any) => e.geometry?.length > 0)
        .map((e: any) => {
          const geo = e.geometry[e.geometry.length - 1];
          return {
            id: e.id,
            title: e.title,
            category: e.categories?.[0]?.title || "Unknown",
            lat: geo.coordinates?.[1] || 0,
            lon: geo.coordinates?.[0] || 0,
            date: geo.date || "",
            link: e.link || "",
          };
        });
      setEvents(parsed);
    } catch (e) {
      console.warn("NASA EONET fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, intervalMs);
    return () => clearInterval(id);
  }, [fetchData, intervalMs]);

  return { events, loading };
}
