import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { safeFetchJson } from "@/lib/connectors";

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

/** Where the events on screen actually came from. */
export type IntelMode = "backend" | "direct" | "none";

interface OsintState {
  events: IntelEvent[];
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  mode: IntelMode;
  sources: string[];
}

const KEYWORD_CATEGORY: { category: IntelCategory; words: RegExp }[] = [
  { category: "conflict", words: /\b(war|strike|strikes|missile|drone|shelling|offensive|ceasefire|troops|military|invasion|airstrike)\b/i },
  { category: "intel", words: /\b(uap|ufo|unidentified|satellite|spacecraft|orbit|surveillance|radar|anomaly|probe)\b/i },
  { category: "finance", words: /\b(market|markets|stocks|equit|oil price|brent|inflation|central bank|fed |rate cut|rate hike|crypto|bitcoin|currency|yields)\b/i },
  { category: "logistics", words: /\b(port|shipping|freight|tanker|pipeline|supply chain|rail|canal|harbour|harbor)\b/i },
  { category: "cryptozoo", words: /\b(species|fossil|expedition|deep sea|biology|zoolog|archaeolog|undiscovered)\b/i },
  { category: "geopolitical", words: /\b(sanction|sanctions|summit|election|treaty|diplomat|border|talks|coalition|parliament)\b/i },
];

const SEVERITY_ORDER: Record<IntelSeverity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function classify(text: string): IntelCategory {
  for (const entry of KEYWORD_CATEGORY) if (entry.words.test(text)) return entry.category;
  return "geopolitical";
}

function severityFromTone(tone: number | null, fallback: IntelSeverity = "MEDIUM"): IntelSeverity {
  if (tone === null) return fallback;
  if (tone <= -10) return "CRITICAL";
  if (tone <= -5) return "HIGH";
  if (tone < 0) return "MEDIUM";
  return "LOW";
}

/* ------------------------------------------------------------------ backend */

interface BackendPayload {
  events?: Partial<IntelEvent>[];
  error?: string;
}

async function fetchFromBackend(categories?: IntelCategory[], limit = 25): Promise<IntelEvent[]> {
  const { data, error } = await supabase.functions.invoke<BackendPayload>("osint-aggregator", {
    body: { categories, limit },
  });
  if (error) throw new Error(error.message);
  const rows = data?.events ?? [];
  const events = rows
    .filter((row) => row.title)
    .map<IntelEvent>((row, index) => ({
      id: row.id ?? `agg-${index}`,
      title: row.title as string,
      url: row.url ?? "",
      source: row.source ?? "Firecrawl",
      category: (row.category as IntelCategory) ?? classify(row.title as string),
      severity: (row.severity as IntelSeverity) ?? "MEDIUM",
      summary: row.summary,
      timestamp: row.timestamp ?? new Date().toISOString(),
    }));
  if (!events.length) throw new Error(data?.error || "aggregator returned no events");
  return events;
}

/* ------------------------------------------------- key-free direct feeds */

interface GdeltArticle {
  title?: string;
  url?: string;
  domain?: string;
  seendate?: string;
  tone?: string | number;
}

/**
 * GDELT allows one request every 5 seconds, so this is deliberately a SINGLE
 * broad query — four parallel thematic queries are throttled with HTTP 429 and
 * (on the error response) no CORS header, which the browser reports as a network
 * failure. Classification then happens locally on the headlines.
 */
const GDELT_QUERY =
  "(conflict OR strike OR missile OR sanctions OR election OR market OR inflation OR crypto OR UAP OR satellite)";

async function fetchGdelt(signal?: AbortSignal): Promise<IntelEvent[]> {
  const json = await safeFetchJson<{ articles?: GdeltArticle[] }>(
    "https://api.gdeltproject.org/api/v2/doc/doc" +
      `?query=${encodeURIComponent(GDELT_QUERY)}&mode=artlist&format=json&maxrecords=50&timespan=24h&sort=hybridrel`,
    { signal, timeoutMs: 14_000 },
  );

  return (json.articles ?? []).slice(0, 30).map<IntelEvent>((article, index) => {
    const tone = typeof article.tone === "string" ? Number(article.tone.split(",")[0]) : Number(article.tone);
    const title = (article.title ?? "").trim();
    const stamp = article.seendate ?? "";
    return {
      id: `gdelt-${index}`,
      title,
      url: article.url ?? "https://www.gdeltproject.org",
      source: article.domain ?? "GDELT",
      category: classify(title),
      severity: severityFromTone(Number.isFinite(tone) ? tone : null),
      timestamp:
        stamp.length >= 13
          ? new Date(
              `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(9, 11)}:${stamp.slice(11, 13)}:00Z`,
            ).toISOString()
          : new Date().toISOString(),
    };
  }).filter((event) => event.title.length > 8);
}

interface UsgsResponse {
  features?: { id: string; properties?: { mag?: number; place?: string; time?: number; url?: string } }[];
}

async function fetchQuakes(signal?: AbortSignal): Promise<IntelEvent[]> {
  const json = await safeFetchJson<UsgsResponse>(
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson",
    { signal, timeoutMs: 10_000 },
  );
  return (json.features ?? []).slice(0, 8).map<IntelEvent>((f) => {
    const mag = f.properties?.mag ?? 0;
    return {
      id: `usgs-${f.id}`,
      title: `M${mag.toFixed(1)} earthquake — ${f.properties?.place ?? "unknown location"}`,
      url: f.properties?.url ?? "https://earthquake.usgs.gov",
      source: "USGS",
      category: "conflict",
      severity: mag >= 6.5 ? "CRITICAL" : mag >= 5.5 ? "HIGH" : "MEDIUM",
      summary: `Depth/impact reported by USGS seismic network.`,
      timestamp: new Date(f.properties?.time ?? Date.now()).toISOString(),
    };
  });
}

interface EonetResponse {
  events?: { id: string; title?: string; categories?: { title?: string }[]; link?: string; geometry?: { date?: string }[] }[];
}

async function fetchNasa(signal?: AbortSignal): Promise<IntelEvent[]> {
  const json = await safeFetchJson<EonetResponse>("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=12", {
    signal,
    timeoutMs: 10_000,
  });
  return (json.events ?? []).slice(0, 8).map<IntelEvent>((event) => {
    const category = event.categories?.[0]?.title ?? "Natural event";
    return {
      id: `eonet-${event.id}`,
      title: `${category}: ${event.title ?? "tracked event"}`,
      url: event.link ?? "https://eonet.gsfc.nasa.gov",
      source: "NASA EONET",
      category: /wildfire|volcano|storm|drought/i.test(category) ? "logistics" : "intel",
      severity: /wildfire|volcano|severe storm/i.test(category) ? "HIGH" : "MEDIUM",
      summary: "Open natural event tracked by NASA EONET.",
      timestamp: new Date(event.geometry?.at(-1)?.date ?? Date.now()).toISOString(),
    };
  });
}

interface SwpcScales {
  [key: string]: { R?: { Scale?: string }; S?: { Scale?: string }; G?: { Scale?: string } };
}

async function fetchSpaceWeather(signal?: AbortSignal): Promise<IntelEvent[]> {
  const scales = await safeFetchJson<SwpcScales>("https://services.swpc.noaa.gov/products/noaa-scales.json", {
    signal,
    timeoutMs: 9_000,
  });
  const current = scales["0"] ?? {};
  const r = Number(current.R?.Scale ?? 0);
  const s = Number(current.S?.Scale ?? 0);
  const g = Number(current.G?.Scale ?? 0);
  if (!r && !s && !g) return [];

  const worst = Math.max(r, s, g);
  return [
    {
      id: "swpc-scales",
      title: `Space weather disturbance — R${r}/S${s}/G${g} (NOAA scales)`,
      url: "https://www.swpc.noaa.gov/products/noaa-scales-explanation",
      source: "NOAA SWPC",
      category: "convergence",
      severity: worst >= 3 ? "CRITICAL" : worst >= 2 ? "HIGH" : "MEDIUM",
      summary: "Radio blackout, solar radiation and geomagnetic storm scales currently in effect.",
      timestamp: new Date().toISOString(),
    },
  ];
}

/**
 * Every direct feed is independent: one failing endpoint never empties the feed.
 * All of them are key-free and answer the browser with CORS enabled.
 */
async function fetchDirect(signal: AbortSignal): Promise<{ events: IntelEvent[]; sources: string[] }> {
  const groups = await Promise.all([
    fetchGdelt(signal).catch(() => []),
    fetchQuakes(signal).catch(() => []),
    fetchNasa(signal).catch(() => []),
    fetchSpaceWeather(signal).catch(() => []),
  ]);
  const events = groups.flat();
  const sources = [...new Set(events.map((e) => e.source))];
  if (!events.length) throw new Error("no public feed answered");
  return { events, sources };
}

/* -------------------------------------------------------------------- hook */

export function useOsintIntel(refreshMs = 600_000, categories?: IntelCategory[]) {
  const [state, setState] = useState<OsintState>({
    events: [],
    isLoading: false,
    error: null,
    lastUpdate: null,
    mode: "none",
    sources: [],
  });
  const categoryKey = categories?.join(",") ?? "";
  const abortRef = useRef<AbortController | null>(null);

  const fetchIntel = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState((s) => ({ ...s, isLoading: true, error: null }));

    const wanted = categoryKey ? (categoryKey.split(",") as IntelCategory[]) : undefined;

    try {
      const events = await fetchFromBackend(wanted, 25);
      if (ctrl.signal.aborted) return;
      setState({
        events: sortEvents(events),
        isLoading: false,
        error: null,
        lastUpdate: new Date(),
        mode: "backend",
        sources: [...new Set(events.map((e) => e.source))],
      });
      return;
    } catch {
      // No aggregator (or no Firecrawl key server-side): fall back to the
      // public feeds the browser can read directly.
    }

    try {
      const { events, sources } = await fetchDirect(ctrl.signal);
      if (ctrl.signal.aborted) return;
      const filtered = wanted ? events.filter((e) => wanted.includes(e.category)) : events;
      setState({
        events: sortEvents(filtered.length ? filtered : events),
        isLoading: false,
        error: null,
        lastUpdate: new Date(),
        mode: "direct",
        sources,
      });
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : "No intel source answered",
        mode: s.events.length ? s.mode : "none",
      }));
    }
  }, [categoryKey]);

  useEffect(() => {
    void fetchIntel();
    const id = setInterval(() => void fetchIntel(), refreshMs);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [fetchIntel, refreshMs]);

  return { ...state, refresh: fetchIntel };
}

function sortEvents(events: IntelEvent[]): IntelEvent[] {
  return [...events]
    .sort((a, b) => {
      const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (bySeverity !== 0) return bySeverity;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    })
    .slice(0, 60);
}
