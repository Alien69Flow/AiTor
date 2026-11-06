import { useCallback, useEffect, useState } from "react";
import BBOXES from "@/integrations/worldmonitor/shared/country-bboxes.json";

export interface OutageEvent {
  code: string;
  name: string;
  events: number;
  score: number;
  lat: number;
  lon: number;
}

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  "https://wkdtvrxavkhbifjtvvdw.supabase.co";
const KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  "";

function centroid(code: string): [number, number] | null {
  const box = (BBOXES as Record<string, number[]>)[code];
  if (!box || box.length !== 4) return null;
  // [minLat, minLon, maxLat, maxLon]
  return [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
}

export function useInternetOutages(enabled = true) {
  const [outages, setOutages] = useState<OutageEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchOutages = useCallback(async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/globe-feeds?feed=outages`, {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
      });
      const json = await res.json();
      const mapped: OutageEvent[] = (json?.outages ?? [])
        .map((o: any) => {
          const c = centroid(o.code);
          return c ? { ...o, lat: c[0], lon: c[1] } : null;
        })
        .filter(Boolean);
      setOutages(mapped);
      setError(json?.error ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "outage feed unavailable");
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    fetchOutages();
    const id = setInterval(fetchOutages, 900_000);
    return () => clearInterval(id);
  }, [enabled, fetchOutages]);

  return { outages, error, refresh: fetchOutages };
}