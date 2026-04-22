import { useState } from "react";
import { ChevronUp, ChevronDown, Eye, EyeOff, Cloud, CloudOff } from "lucide-react";

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

const glass = "bg-black/60 backdrop-blur-[20px] border border-white/[0.06] rounded-lg";

interface LegendPanelProps {
  visibleLayers: Set<LayerKey>;
  onToggleLayer: (key: LayerKey) => void;
  counts?: Record<LayerKey, number>;
  cloudsEnabled?: boolean;
  onToggleClouds?: () => void;
}

export function LegendPanel({ visibleLayers, onToggleLayer, counts, cloudsEnabled, onToggleClouds }: LegendPanelProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className={`${glass} w-[260px] overflow-hidden`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3 py-2">
        <span className="text-[9px] font-mono uppercase tracking-wider text-white/30">⚙ LEGEND & LAYERS</span>
        {open ? <ChevronUp className="w-3 h-3 text-white/20" /> : <ChevronDown className="w-3 h-3 text-white/20" />}
      </button>
      {open && (
        <div className="px-3 pb-3">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {LEGEND_CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => onToggleLayer(cat.key)}
                className="flex items-center gap-1.5 text-[9px] font-mono group"
              >
                {visibleLayers.has(cat.key)
                  ? <Eye className="w-3 h-3 text-[#00FF41]" />
                  : <EyeOff className="w-3 h-3 text-white/15" />
                }
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: visibleLayers.has(cat.key) ? cat.color : "#333" }}
                />
                <span style={{ color: visibleLayers.has(cat.key) ? cat.color : "#444" }}>
                  {cat.label}
                </span>
                {counts && counts[cat.key] > 0 && (
                  <span className="text-[7px] text-white/20 ml-auto">{counts[cat.key]}</span>
                )}
              </button>
            ))}
          </div>
          {onToggleClouds && (
            <div className="mt-2 pt-2 border-t border-white/[0.06]">
              <button
                onClick={onToggleClouds}
                className="w-full flex items-center justify-between text-[9px] font-mono group hover:bg-white/[0.03] rounded px-1 py-1 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  {cloudsEnabled
                    ? <Cloud className="w-3 h-3 text-[#00FFFF]" />
                    : <CloudOff className="w-3 h-3 text-white/20" />
                  }
                  <span style={{ color: cloudsEnabled ? "#00FFFF" : "#555" }}>
                    Meteosat Clouds
                  </span>
                </span>
                <span className="text-[7px] text-white/25 uppercase tracking-wider">
                  {cloudsEnabled ? "LIVE" : "OFF"}
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
