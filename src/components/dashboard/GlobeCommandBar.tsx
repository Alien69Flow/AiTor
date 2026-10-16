import { useEffect, useState } from "react";
import { Radar, Activity, Layers, Satellite } from "lucide-react";
import { LedIndicator } from "./GlassPanels";
import type { LayerStatusMap } from "@/hooks/useUnifiedIntel";

interface GlobeCommandBarProps {
  /** Combined live signal count (quakes, NASA events, flights, ships, GDELT). */
  activeSignals: number;
  /** Per-connector status, used to report a real uplink state. */
  layerStatus: LayerStatusMap;
  /** Number of environmental layers currently enabled. */
  layersCount: number;
}

type UplinkState = "online" | "syncing" | "degraded";

const UPLINK_STYLE: Record<UplinkState, { label: string; color: string; className: string }> = {
  online: { label: "Uplink online", color: "#00FF41", className: "border-primary/35 bg-primary/10 text-primary" },
  syncing: { label: "Uplink sync", color: "#fbbf24", className: "border-amber-500/35 bg-amber-500/10 text-amber-300" },
  degraded: { label: "Uplink degraded", color: "#f87171", className: "border-destructive/40 bg-destructive/10 text-destructive" },
};

/** Locked-width monospace clock so the bar never reflows on each tick. */
function useUtcClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now.toISOString().slice(11, 19);
}

/**
 * Tactical bar above the globe. Shows the brand, the real uplink health derived
 * from the connector status, the live signal count and UTC time — no filler copy.
 */
export function GlobeCommandBar({ activeSignals, layerStatus, layersCount }: GlobeCommandBarProps) {
  const clock = useUtcClock();

  const statuses = Object.values(layerStatus);
  const errored = statuses.filter((status) => status.error).length;
  const loading = statuses.filter((status) => status.loading && !status.error).length;
  const uplink: UplinkState = errored > 0 ? "degraded" : loading > 0 ? "syncing" : "online";
  const uplinkStyle = UPLINK_STYLE[uplink];

  const chip = "flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em]";

  return (
    <header className="relative z-30 shrink-0 border-b border-primary/25 bg-card/80 backdrop-blur-xl">
      {/* Hairline accent so the bar reads as a terminal header */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

      <div className="flex h-11 items-center justify-between gap-2 px-3 md:px-5">
        {/* Identity */}
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-primary/35 bg-primary/10">
            <Radar className="h-3.5 w-3.5 text-primary" />
          </span>
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className="shrink-0 font-heading text-[11px] tracking-[0.2em] text-primary">AI&nbsp;TOR</span>
            <span aria-hidden className="shrink-0 text-[11px] text-primary/40">//</span>
            <h2 className="truncate font-heading text-[11px] uppercase tracking-[0.16em] text-foreground/90 md:text-xs">
              Global Strategic Command
            </h2>
          </div>
        </div>

        {/* Live telemetry */}
        <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
          <span className={`${chip} hidden sm:flex ${uplinkStyle.className}`}>
            <LedIndicator color={uplinkStyle.color} active={uplink !== "online"} size="xs" />
            {uplinkStyle.label}
          </span>

          <span className={`${chip} border-border/60 bg-muted/30 text-muted-foreground`}>
            <Activity className="h-3 w-3 text-primary" />
            {activeSignals.toLocaleString()}
            <span className="hidden md:inline">signals</span>
          </span>

          <span className={`${chip} hidden border-border/60 bg-muted/30 text-muted-foreground lg:flex`}>
            <Layers className="h-3 w-3 text-accent" />
            {layersCount}
            <span className="hidden xl:inline">layers</span>
          </span>

          <span className={`${chip} hidden border-border/50 bg-card/60 text-muted-foreground md:flex`}>
            <Satellite className="h-3 w-3 text-accent" />
            <time aria-hidden="true" className="tabular-nums tracking-normal">{clock}</time>
            <span className="hidden lg:inline">UTC</span>
          </span>

          <span className={`${chip} border-primary/35 bg-primary/10 text-primary`}>
            <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary shadow-[0_0_8px_#00FF41]" />
            <span className="hidden sm:inline">Mission</span> active
          </span>
        </div>
      </div>
    </header>
  );
}
