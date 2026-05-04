import { useState } from "react";
import { ChevronUp, ChevronDown, Cloud, CloudOff, Activity, Satellite, Radio, CloudRain } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export type LayerKey = "finance" | "intel" | "conflict" | "geopolitical" | "logistics" | "cryptozoo" | "convergence";

export interface LegendCategory {
  key: LayerKey;
  label: string;
  color: string;
  emoji: string;
}

export const LEGEND_CATEGORIES: LegendCategory[] = [
  { key: "finance", label: "Finance/Tech", color: "#FFD700", emoji: "💰" },
  { key: "intel", label: "Intel/UAP", color: "#00FF41", emoji: "🛸" },
  { key: "conflict", label: "Conflict", color: "#FF4444", emoji: "💥" },
  { key: "geopolitical", label: "Geopolitical", color: "#0088FF", emoji: "🏛️" },
  { key: "logistics", label: "Logistics", color: "#FF8844", emoji: "📦" },
  { key: "cryptozoo", label: "Cryptozoology", color: "#FF00FF", emoji: "🦎" },
  { key: "convergence", label: "Convergence", color: "#FFFFFF", emoji: "✨" },
];

const glass = "bg-black/70 backdrop-blur-[20px] border border-white/[0.08] rounded-md font-mono";

const DATA_SOURCES = [
  { key: "usgs", label: "USGS Quakes", color: "#ffff00", Icon: Activity },
  { key: "nasa", label: "NASA EONET", color: "#00ff41", Icon: Satellite },
  { key: "noaa", label: "NOAA Kp Index", color: "#FF00FF", Icon: Radio },
  { key: "owm", label: "OpenWeather Precip.", color: "#00FFFF", Icon: CloudRain },
] as const;

interface LegendPanelProps {
  visibleLayers: Set<LayerKey>;
  onToggleLayer: (key: LayerKey) => void;
  counts?: Record<LayerKey, number>;
  cloudsEnabled?: boolean;
  onToggleClouds?: () => void;
  weatherEnabled?: boolean;
  onToggleWeather?: () => void;
}

export function LegendPanel({ visibleLayers, onToggleLayer, counts, cloudsEnabled, onToggleClouds, weatherEnabled, onToggleWeather }: LegendPanelProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className={`${glass} w-[280px] overflow-hidden`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
        <span className="text-[10px] uppercase tracking-[0.15em] text-white/50">▣ LEGEND & LAYERS</span>
        {open ? <ChevronUp className="w-3 h-3 text-white/30" /> : <ChevronDown className="w-3 h-3 text-white/30" />}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-2 space-y-3">
          {/* Categories */}
          <div>
            <div className="text-[8px] uppercase tracking-wider text-white/25 mb-1.5">Categories</div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            {LEGEND_CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => onToggleLayer(cat.key)}
                className="flex items-center gap-1.5 text-[9px] hover:bg-white/[0.04] rounded px-1 py-0.5 transition-colors"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0 transition-all"
                  style={{
                    background: visibleLayers.has(cat.key) ? cat.color : "#222",
                    boxShadow: visibleLayers.has(cat.key) ? `0 0 6px ${cat.color}` : "none",
                  }}
                />
                <span
                  className="truncate"
                  style={{ color: visibleLayers.has(cat.key) ? cat.color : "#444" }}
                >
                  {cat.label}
                </span>
                {counts && counts[cat.key] > 0 && (
                  <span className="text-[7px] text-white/30 ml-auto">{counts[cat.key]}</span>
                )}
              </button>
            ))}
            </div>
          </div>

          {/* Live Data Sources */}
          <div className="border-t border-white/[0.06] pt-2">
            <div className="text-[8px] uppercase tracking-wider text-white/25 mb-1.5">Live Data Sources</div>
            <div className="space-y-1">
              {DATA_SOURCES.map(src => {
                const isOwm = src.key === "owm";
                const enabled = isOwm ? !!weatherEnabled : true;
                return (
                  <div key={src.key} className="flex items-center justify-between gap-2 px-1 py-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <src.Icon className="w-3 h-3 shrink-0" style={{ color: enabled ? src.color : "#444" }} />
                      <span className="text-[9px] truncate" style={{ color: enabled ? src.color : "#555" }}>
                        {src.label}
                      </span>
                    </div>
                    {isOwm && onToggleWeather ? (
                      <Switch
                        checked={!!weatherEnabled}
                        onCheckedChange={onToggleWeather}
                        className="scale-[0.6] origin-right data-[state=checked]:bg-[#00FFFF]/60"
                      />
                    ) : (
                      <span className="text-[7px] uppercase tracking-wider text-[#00FF41]/70">●LIVE</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {onToggleClouds && (
            <div className="border-t border-white/[0.06] pt-2">
              <button
                onClick={onToggleClouds}
                className="w-full flex items-center justify-between text-[9px] hover:bg-white/[0.04] rounded px-1 py-1 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  {cloudsEnabled
                    ? <Cloud className="w-3 h-3 text-[#00FFFF]" />
                    : <CloudOff className="w-3 h-3 text-white/25" />
                  }
                  <span style={{ color: cloudsEnabled ? "#00FFFF" : "#555" }}>
                    Meteosat Clouds
                  </span>
                </span>
                <Switch
                  checked={!!cloudsEnabled}
                  onCheckedChange={onToggleClouds}
                  className="scale-[0.6] origin-right data-[state=checked]:bg-[#00FFFF]/60"
                />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
