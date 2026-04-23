import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UAPSighting {
  id: string;
  location: string;
  lat: number | null;
  lon: number | null;
  description: string | null;
  type: string | null;
  severity: string | null;
  source: string | null;
  category: string | null;
  date_reported: string | null;
  created_at: string | null;
}

export function useUAPSightings() {
  const [sightings, setSightings] = useState<UAPSighting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSightings = async () => {
      try {
        const { data, error } = await supabase
          .from("uap_sightings")
          .select("*")
          .not("lat", "is", null)
          .not("lon", "is", null)
          .order("date_reported", { ascending: false });

        if (error) {
          // Table missing / RLS / 404 — silently degrade, globe keeps rendering
          console.warn("[useUAPSightings] table unavailable:", error.message);
        } else if (data) {
          setSightings(data as UAPSighting[]);
        }
      } catch (e) {
        console.warn("[useUAPSightings] fetch failed (non-fatal):", e);
      } finally {
        setLoading(false);
      }
    };

    fetchSightings();

    // Realtime subscription (wrapped — fails silently if table missing)
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel("uap-globe")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "uap_sightings" },
          (payload) => {
            if (payload.eventType === "INSERT") {
              const newRow = payload.new as UAPSighting;
              if (newRow.lat != null && newRow.lon != null) {
                setSightings((prev) => [newRow, ...prev]);
              }
            } else if (payload.eventType === "DELETE") {
              setSightings((prev) => prev.filter((s) => s.id !== (payload.old as any).id));
            }
          }
        )
        .subscribe();
    } catch (e) {
      console.warn("[useUAPSightings] realtime unavailable:", e);
    }

    return () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch {}
      }
    };
  }, []);

  return { sightings, loading };
}
