import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type IntelCategory =
  | "finance"
  | "intel"
  | "conflict"
  | "geopolitical"
  | "logistics"
  | "cryptozoo"
  | "convergence";

export type IntelSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface IntelEvent {
  id: string;
  title: string;
  url: string;
  source: string;
  category: IntelCategory;
  severity: IntelSeverity;
  summary?: string;
  timestamp: string;
}

interface OsintState {
  events: IntelEvent[];
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
}

export function useOsintIntel(refreshMs = 600_000, categories?: IntelCategory[]) {
  const [state, setState] = useState<OsintState>({
    events: [],
    isLoading: false,
    error: null,
    lastUpdate: null,
  });

  const fetchIntel = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const { data, error } = await supabase.functions.invoke("osint-aggregator", {
        body: { categories, limit: 5 },
      });
      if (error) throw error;
      setState({
        events: data?.events || [],
        isLoading: false,
        error: null,
        lastUpdate: new Date(),
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }));
    }
  }, [categories]);

  useEffect(() => {
    fetchIntel();
    const id = setInterval(fetchIntel, refreshMs);
    return () => clearInterval(id);
  }, [fetchIntel, refreshMs]);

  return { ...state, refresh: fetchIntel };
}
