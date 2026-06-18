import { useState, useEffect } from "react";
import { X, TrendingUp, TrendingDown, MapPin, TriangleAlert as AlertTriangle, Zap, Crosshair, Activity } from "lucide-react";
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
}

export function GlobeOverlay({
  selectedHotspot,
  onClose,
  spaceWeather,
  earthquakeCount = 0,
  nasaEventCount = 0,
}: GlobeOverlayProps) {
  const kpContrib = spaceWeather?.kpIndex ? spaceWeather.kpIndex * 8 : 0;
  const stormContrib = spaceWeather?.solarStorm ? 25 : 0;
  const quakeContrib = Math.min(earthquakeCount * 0.1, 15);
  const nasaContrib = Math.min(nasaEventCount * 0.5, 10);
  const baseTension = Math.max(
    15,
    Math.min(100, kpContrib + stormContrib + quakeContrib + nasaContrib + 10)
  );

  const [tensionLevel, setTensionLevel] = useState(baseTension);

  useEffect(() => {
    setTensionLevel(baseTension);
  }, [baseTension]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTensionLevel((prev) => {
        const delta = (Math.random() - 0.5) * 2;
        return Math.max(10, Math.min(100, prev + delta));
      });
    }, 8000);
    return () => clearInterval(interval);
  }, []);

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
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
        <div
          className="flex items-center gap-3 px-5 py-2 rounded-2xl backdrop-blur-2xl border transition-all duration-500"
          style={{
            background: "rgba(15, 23, 42, 0.7)",
            borderColor: `${tensionColor}40`,
            boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 24px ${tensionColor}20`,
          }}
        >
          <LedIndicator color={tensionColor} active pulse />
          <div className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-slate-400" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
              Tension
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-xl font-bold font-mono"
              style={{ color: tensionColor }}
            >
              {Math.round(tensionLevel)}
            </span>
            <StatusBadge variant={tensionVariant}>{tensionStatus}</StatusBadge>
          </div>
          {kpActive && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[9px] font-mono text-purple-400 font-medium">
                Kp {spaceWeather?.kpIndex?.toFixed(0)}
              </span>
            </div>
          )}
          {earthquakeCount > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20">
              <Activity className="w-3.5 h-3.5 text-red-400" />
              <span className="text-[9px] font-mono text-red-400 font-medium">
                {earthquakeCount}
              </span>
            </div>
          )}
        </div>
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
    <div className="absolute top-16 right-4 z-50 w-72 animate-in fade-in slide-in-from-right-4 duration-300">
      <GlassPanel className="overflow-hidden" glowBorder glowColor={typeColor}>
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
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-700/40 transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
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
          </div>

          {/* Footer */}
          <div className="px-4 py-3 flex items-center justify-between border-t border-slate-700/25">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-emerald-400/60" />
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
