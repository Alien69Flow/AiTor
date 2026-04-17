import { useMemo } from "react";
import { useRealTimeData } from "./useRealTimeData";
import { useOsintIntel, type IntelEvent } from "./useOsintIntel";

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

  // Unified events stream for Globe markers / feeds
  const events: IntelEvent[] = useMemo(() => osint.events, [osint.events]);

  return {
    ...realtime,
    osint: osint.events,
    osintLoading: osint.isLoading,
    osintError: osint.error,
    refreshOsint: osint.refresh,
    correlations,
    events,
  };
}
