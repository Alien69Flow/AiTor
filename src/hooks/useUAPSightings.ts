import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchUapSightingsRows, isUapSightingsTableMissing, type UapSightingRow } from "@/lib/uap-sightings";

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
        const data = await fetchUapSightingsRows();
        setSightings(data as UAPSighting[]);
      } catch {
        setSightings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSightings();

    if (isUapSightingsTableMissing()) {
      return;
    }

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
              const newRow = payload.new as UapSightingRow;
              if (newRow.lat != null && newRow.lon != null) {
                setSightings((prev) => [newRow as UAPSighting, ...prev]);
              }
            } else if (payload.eventType === "DELETE") {
              setSightings((prev) => prev.filter((s) => s.id !== (payload.old as any).id));
            }
          }
        )
        .subscribe();
    } catch {
      channel = null;
    }

    return () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch {}
      }
    };
  }, []);

  return { sightings, loading };
}
