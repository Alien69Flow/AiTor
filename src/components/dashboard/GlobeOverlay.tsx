import { useState, useEffect, useMemo } from "react";
import { X, MapPin, Zap, Crosshair, Activity, Flame, Radio, ChevronDown, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HotspotData } from "@/components/globe/GlobeScene";
import type { SpaceWeather } from "@/hooks/useSpaceWeather";
import { fetchUapSightingsCount } from "@/lib/uap-sightings";
import {
  GlassPanel,
  LedIndicator,
  StatusBadge,
  MetricCard,
  SectionTitle,
} from "./GlassPanels";

const TYPE_COLORS: Record<string, string> = {
  conflict: "#f87171",
  finance: "#fbbf24",
  tech: "#22d3ee",
  geopolitical: "#60a5fa",
};

interface GlobeOverlayProps {
  selectedHotspot?: HotspotData | null;
  onClose?: () => void;
  spaceWeather?: SpaceWeather;
  earthquakeCount?: number;
  nasaEventCount?: number;
  conflictCount?: number;
  wildfireCount?: number;
  outageCount?: number;
  criticalIntelCount?: number;
}

export function GlobeOverlay({
  selectedHotspot,
  onClose,
  spaceWeather,
  earthquakeCount = 0,
  nasaEventCount = 0,
  conflictCount = 0,
  wildfireCount = 0,
  outageCount = 0,
  criticalIntelCount = 0,
}: GlobeOverlayProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Weighted, fully data-driven tension score — no synthetic drift.
  const { tensionLevel, factors } = useMemo(() => {
    const kp = spaceWeather?.kpIndex ?? 0;
    const rows = [
      { key: "Conflict events", value: conflictCount, points: Math.min(conflictCount * 1.6, 32), Icon: Crosshair, color: "#f87171" },
      { key: "Critical intel", value: criticalIntelCount, points: Math.min(criticalIntelCount * 3, 18), Icon: Radio, color: "#fbbf24" },
      { key: "Seismic (M2.5+)", value: earthquakeCount, points: Math.min(earthquakeCount * 0.12, 14), Icon: Activity, color: "#fb923c" },
      { key: "Wildfires / hazards", value: wildfireCount || nasaEventCount, points: Math.min((wildfireCount || nasaEventCount) * 0.4, 12), Icon: Flame, color: "#f97316" },
      { key: `Geomagnetic Kp ${kp.toFixed(1)}`, value: Math.round(kp * 10) / 10, points: Math.min(kp * 2.4, 16) + (spaceWeather?.solarStorm ? 6 : 0), Icon: Zap, color: "#c084fc" },
      { key: "Internet outages", value: outageCount, points: Math.min(outageCount * 0.8, 8), Icon: Radio, color: "#dc2626" },
    ];
    const total = rows.reduce((sum, r) => sum + r.points, 0);
    return { tensionLevel: Math.max(5, Math.min(100, Math.round(total))), factors: rows };
  }, [spaceWeather, conflictCount, criticalIntelCount, earthquakeCount, wildfireCount, nasaEventCount, outageCount]);

  const tensionColor =
    tensionLevel > 70 ? "#f87171" : tensionLevel > 40 ? "#fbbf24" : "#34d399";
  const tensionStatus =
    tensionLevel > 70 ? "CRITICAL" : tensionLevel > 40 ? "ELEVATED" : "NOMINAL";
  const tensionVariant =
    tensionLevel > 70 ? "danger" : tensionLevel > 40 ? "warning" : "success";
  const kpActive = (spaceWeather?.kpIndex || 0) > 4;

  return (
    <>
      {/* Global Tension Indicator - Premium Badge */}
      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-10 flex w-auto max-w-[calc(100vw-96px)] flex-col items-center px-1">
        <button
          type="button"
          onClick={() => setShowBreakdown((v) => !v)}
          aria-label="Global tension breakdown"
          className="flex items-center gap-2 md:gap-3 px-3 md:px-5 py-1.5 md:py-2 rounded-2xl backdrop-blur-2xl border transition-all duration-500 justify-center"
          style={{
            background: "rgba(15, 23, 42, 0.7)",
            borderColor: `${tensionColor}40`,
            boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 24px ${tensionColor}20`,
          }}
        >
          <LedIndicator color={tensionColor} active pulse />
          <div className="hidden md:flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-slate-400" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
              Tension
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-lg md:text-xl font-bold font-mono"
              style={{ color: tensionColor }}
            >
              {Math.round(tensionLevel)}
            </span>
            <StatusBadge variant={tensionVariant}>{tensionStatus}</StatusBadge>
          </div>
          {kpActive && (
            <div className="flex items-center gap-1.5 px-1.5 md:px-2 py-0.5 md:py-1 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <Zap className="w-3 md:w-3.5 h-3 md:h-3.5 text-purple-400" />
              <span className="text-[8px] md:text-[9px] font-mono text-purple-400 font-medium">
                Kp {spaceWeather?.kpIndex?.toFixed(0)}
              </span>
            </div>
          )}
          {earthquakeCount > 0 && (
            <div className="flex items-center gap-1.5 px-1.5 md:px-2 py-0.5 md:py-1 rounded-lg bg-red-500/10 border border-red-500/20">
              <Activity className="w-3 md:w-3.5 h-3 md:h-3.5 text-red-400" />
              <span className="text-[8px] md:text-[9px] font-mono text-red-400 font-medium">
                {earthquakeCount}
              </span>
            </div>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showBreakdown ? "rotate-180" : ""}`}
          />
        </button>

        {showBreakdown && (
          <div className="mt-2 mx-auto w-full max-w-[340px] rounded-2xl border border-slate-700/40 bg-slate-950/90 backdrop-blur-2xl p-3 space-y-2 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-wider text-slate-500">Tension drivers</span>
              <span className="text-[9px] font-mono" style={{ color: tensionColor }}>
                {tensionLevel}/100
              </span>
            </div>
            {factors.map((f) => (
              <div key={f.key} className="flex items-center gap-2">
                <f.Icon className="w-3.5 h-3.5 shrink-0" style={{ color: f.color }} />
                <span className="text-[10px] text-slate-300 flex-1 truncate">{f.key}</span>
                <span className="text-[10px] font-mono text-slate-400">{f.value}</span>
                <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, (f.points / 32) * 100)}%`, backgroundColor: f.color }}
                  />
                </div>
              </div>
            ))}
            <div className="pt-1.5 border-t border-slate-700/30 flex items-center justify-between text-[8px] text-slate-500">
              <span>USGS · NOAA SWPC · NASA · IODA · OSINT</span>
              <span className="text-emerald-400">LIVE</span>
            </div>
          </div>
        )}
      </div>

      {/* Detail Popup */}
      {selectedHotspot && <CountryPopup hotspot={selectedHotspot} onClose={onClose} />}
    </>
  );
}

function CountryPopup({
  hotspot,
  onClose,
}: {
  hotspot: HotspotData;
  onClose?: () => void;
}) {
  const [uapCount, setUapCount] = useState(0);

  useEffect(() => {
    const fetchUAP = async () => {
      const count = await fetchUapSightingsCount();
      setUapCount(count);
    };
    fetchUAP();
  }, [hotspot]);

  const trendPositive = hotspot.trend.startsWith("+");
  const typeColor = TYPE_COLORS[hotspot.type] || "#fbbf24";

  return (
    <div className="absolute top-3 right-3 z-50 w-[min(340px,calc(100vw-24px))] animate-in fade-in slide-in-from-right-4 duration-300">
      <GlassPanel className="overflow-hidden rounded-sm" glowBorder glowColor={typeColor}>
        <div className="-mt-4 -mx-4">
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-slate-700/30"
            style={{
              background: `linear-gradient(135deg, ${typeColor}10 0%, transparent 100%)`,
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${typeColor}20 0%, ${typeColor}10 100%)`,
                  boxShadow: `0 0 16px ${typeColor}20`,
                }}
              >
                <MapPin className="w-4 h-4" style={{ color: typeColor }} />
              </div>
              <div>
                <div className="text-[12px] font-bold text-white/90">
                  {hotspot.name}
                </div>
                <div className="text-[9px] text-slate-500">{hotspot.country}</div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-sm"
              aria-label="Cerrar análisis"
            >
              <X className="w-4 h-4 text-slate-400" />
            </Button>
          </div>

          {/* Metrics */}
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <MetricCard id="Volume" value={hotspot.marketVolume} status="stable" />
              <MetricCard
                id="24h Change"
                value={hotspot.trend}
                status={trendPositive ? "stable" : "alert"}
              />
            </div>

            {/* Tokens */}
            {hotspot.topTokens.length > 0 && (
              <div>
                <SectionTitle>Top Assets</SectionTitle>
                <div className="flex flex-wrap gap-1.5">
                  {hotspot.topTokens.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-1 text-[9px] font-medium rounded-lg bg-slate-800/40 border border-slate-700/30 text-slate-300"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {hotspot.description && (
              <div className="border-t border-border/60 pt-3">
                <SectionTitle>Signal intelligence</SectionTitle>
                <p className="text-[10px] leading-relaxed text-slate-300/80 break-words">{hotspot.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-3 text-[9px] font-mono">
              <div className="min-w-0">
                <div className="text-muted-foreground uppercase">Source</div>
                <div className="text-primary truncate">{hotspot.source || hotspot.country}</div>
              </div>
              <div className="min-w-0">
                <div className="text-muted-foreground uppercase">Updated</div>
                <div className="text-foreground/80 truncate">{hotspot.timestamp || "LIVE"}</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 flex items-center justify-between border-t border-slate-700/25">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-primary/60" />
              <span className="text-[9px] text-slate-500 font-medium">
                {uapCount} UAP Sightings
              </span>
            </div>
            <StatusBadge variant="info" glow>
              {hotspot.type.toUpperCase()}
            </StatusBadge>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
