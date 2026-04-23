import { useState, useEffect, useCallback } from "react";

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
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const publishableKey =
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!projectId || !publishableKey) {
        throw new Error("Backend not configured");
      }

      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/osint-aggregator`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: publishableKey,
          Authorization: `Bearer ${publishableKey}`,
        },
        body: JSON.stringify({ categories, limit: 5 }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || `Request failed with ${response.status}`);
      }

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
