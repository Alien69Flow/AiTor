import { useMemo } from "react";
import { useRealTimeData } from "./useRealTimeData";
import { useOsintIntel, type IntelEvent } from "./useOsintIntel";
import type { UnifiedHotspotData } from "@/components/globe/GlobeScene";

export interface TickerItem {
  tag: string;
  text: string;
  source: string;
  time: string;
  severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

/**
 * Unified intelligence layer.
 * Single source of truth combining environmental telemetry (USGS/NOAA/NASA),
 * market data (CoinGecko) and OSINT events (Firecrawl).
 */
export function useUnifiedIntel() {
  const realtime = useRealTimeData();
  const osint = useOsintIntel();

  // Correlate OSINT critical events with crypto volatility (>5% 24h)
  const correlations = useMemo(() => {
    const volatile = realtime.cryptoPrices.filter(
      (p) => Math.abs(p.change24h ?? 0) > 5
    );
    const criticalIntel = osint.events.filter(
      (e) => e.severity === "CRITICAL" || e.severity === "HIGH"
    );
    return criticalIntel.map((event) => ({
      event,
      marketImpact: volatile.map((v) => ({
        symbol: v.symbol,
        change24h: v.change24h,
        price: v.price,
      })),
    }));
  }, [realtime.cryptoPrices, osint.events]);

  // Geographic markers from environmental + OSINT (only when coords known)
  const eventMarkers = useMemo<UnifiedHotspotData[]>(() => {
    const markers: UnifiedHotspotData[] = [];

    realtime.earthquakes.slice(0, 50).forEach((q) => {
      markers.push({
        lat: q.lat,
        lon: q.lon,
        intensity: Math.min(1, (q.magnitude || 4) / 9),
        color: q.magnitude >= 6 ? "#ff4444" : q.magnitude >= 5 ? "#ff8844" : "#ffff00",
        name: q.place || "Earthquake",
        country: "USGS",
        marketVolume: `M${(q.magnitude || 0).toFixed(1)}`,
        trend: `${q.depth}km`,
        topTokens: [],
        type: "quake",
      });
    });

    realtime.nasaEvents.forEach((e) => {
      if (typeof e.lat === "number" && typeof e.lon === "number") {
        markers.push({
          lat: e.lat,
          lon: e.lon,
          intensity: 0.5,
          color: "#00ff41",
          name: e.title || e.category,
          country: "NASA EONET",
          marketVolume: e.category,
          trend: e.date || "",
          topTokens: [],
          type: "nasa",
        });
      }
    });

    realtime.sightings.slice(0, 60).forEach((s: any) => {
      if (typeof s.lat === "number" && typeof s.lon === "number") {
        markers.push({
          lat: s.lat,
          lon: s.lon,
          intensity: 0.4,
          color: "#ff00ff",
          name: s.location || s.type || "UAP",
          country: s.source || "UAP",
          marketVolume: s.severity || "LOW",
          trend: s.date_reported || "",
          topTokens: [],
          type: "geopolitical",
        });
      }
    });

    return markers;
  }, [realtime.earthquakes, realtime.nasaEvents, realtime.sightings]);

  // Unified ticker stream merging OSINT + environmental headlines
  const tickerItems = useMemo<TickerItem[]>(() => {
    const items: TickerItem[] = [];

    osint.events.slice(0, 8).forEach((e) => {
      items.push({
        tag: `[${e.severity}]`,
        text: e.title,
        source: `Source: ${e.source}`,
        time: new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        severity: e.severity,
      });
    });

    [...realtime.earthquakes].sort((a, b) => b.magnitude - a.magnitude).slice(0, 4).forEach((q) => {
      items.push({
        tag: "[ALERT]",
        text: `M${q.magnitude.toFixed(1)} earthquake — ${q.place}`,
        source: "Source: USGS",
        time: new Date(q.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        severity: q.magnitude >= 6 ? "CRITICAL" : q.magnitude >= 5 ? "HIGH" : "MEDIUM",
      });
    });

    realtime.nasaEvents.slice(0, 3).forEach((evt) => {
      items.push({
        tag: "[NASA]",
        text: `${evt.category}: ${evt.title}`,
        source: "Source: NASA EONET",
        time: evt.date ? new Date(evt.date).toLocaleDateString([], { month: "short", day: "numeric" }) : "Active",
        severity: "LOW",
      });
    });

    return items;
  }, [osint.events, realtime.earthquakes, realtime.nasaEvents]);

  // Unified events stream for feed panel
  const events: IntelEvent[] = useMemo(() => osint.events, [osint.events]);

  return {
    ...realtime,
    osint: osint.events,
    osintLoading: osint.isLoading,
    osintError: osint.error,
    refreshOsint: osint.refresh,
    correlations,
    events,
    eventMarkers,
    tickerItems,
  };
}
