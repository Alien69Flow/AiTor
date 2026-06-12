import { useState } from "react";
import { ChevronUp, ChevronDown, Cloud, Activity, Satellite, Radio, CloudRain, Flame, Plane, TrendingUp, Wind } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export type LayerKey = "finance" | "intel" | "conflict" | "geopolitical" | "logistics" | "cryptozoo" | "convergence";

export interface LegendCategory {
  key: LayerKey;
  label: string;
  color: string;
  emoji: string;
}

export const LEGEND_CATEGORIES: LegendCategory[] = [
  { key: "finance", label: "Finance/Tech", color: "#fbbf24", emoji: "💰" },
  { key: "intel", label: "Intel/UAP", color: "#34d399", emoji: "🛸" },
  { key: "conflict", label: "Conflict", color: "#f87171", emoji: "💥" },
  { key: "geopolitical", label: "Geopolitical", color: "#60a5fa", emoji: "🏛️" },
  { key: "logistics", label: "Logistics", color: "#fb923c", emoji: "📦" },
  { key: "cryptozoo", label: "Cryptozoology", color: "#c084fc", emoji: "🦎" },
  { key: "convergence", label: "Convergence", color: "#e2e8f0", emoji: "✨" },
];

const glass = "bg-slate-950/40 backdrop-blur-[24px] border border-slate-700/50 rounded-2xl font-mono shadow-2xl shadow-blue-900/10";

const DATA_SOURCES = [
  { key: "usgs", label: "USGS Quakes", color: "#fbbf24", Icon: Activity },
  { key: "nasa", label: "NASA EONET", color: "#34d399", Icon: Satellite },
  { key: "noaa", label: "NOAA Kp Index", color: "#c084fc", Icon: Radio },
  { key: "owm", label: "OpenWeather Precip.", color: "#22d3ee", Icon: CloudRain },
] as const;

interface LegendPanelProps {
  visibleLayers: Set<LayerKey>;
  onToggleLayer: (key: LayerKey) => void;
  counts?: Record<LayerKey, number>;
  cloudsEnabled?: boolean;
  onToggleClouds?: () => void;
  weatherEnabled?: boolean;
  onToggleWeather?: () => void;
  firesEnabled?: boolean;
  onToggleFires?: () => void;
  aircraftEnabled?: boolean;
  onToggleAircraft?: () => void;
  marketsEnabled?: boolean;
  onToggleMarkets?: () => void;
}

export function LegendPanel({
  visibleLayers, onToggleLayer, counts,
  cloudsEnabled, onToggleClouds,
  weatherEnabled, onToggleWeather,
  firesEnabled, onToggleFires,
  aircraftEnabled, onToggleAircraft,
  marketsEnabled, onToggleMarkets,
}: LegendPanelProps) {
  const [open, setOpen] = useState(true);

  const overlayToggles: Array<{ key: string; label: string; color: string; Icon: any; enabled: boolean; onToggle?: () => void }> = [
    { key: "atm",   label: "Atmosphere (OWM)",   color: "#22d3ee", Icon: Wind,       enabled: !!weatherEnabled,  onToggle: onToggleWeather },
    { key: "clds",  label: "Clouds (GIBS)",      color: "#7dd3fc", Icon: Cloud,      enabled: !!cloudsEnabled,   onToggle: onToggleClouds },
    { key: "fire",  label: "Wildfires (EONET)",   color: "#fb923c", Icon: Flame,      enabled: !!firesEnabled,    onToggle: onToggleFires },
    { key: "air",   label: "Traffic (OpenSky)",   color: "#e2e8f0", Icon: Plane,      enabled: !!aircraftEnabled, onToggle: onToggleAircraft },
    { key: "mkts",  label: "Markets (Poly)",      color: "#fbbf24", Icon: TrendingUp, enabled: !!marketsEnabled,  onToggle: onToggleMarkets },
  ];

  return (
    <div className={`${glass} w-[280px] overflow-hidden`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-2.5 border-b border-slate-700/30">
        <span className="text-[10px] uppercase tracking-[0.12em] text-[#b4c5b0] font-medium">Legend & Layers</span>
        {open ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
      </button>
      {open && (
        <div className="px-3.5 pb-3.5 pt-2.5 space-y-3">
          {/* Categories — glass micro-cards grid */}
          <div>
            <div className="text-[8px] uppercase tracking-wider text-slate-500 mb-2">Categories</div>
            <div className="grid grid-cols-2 gap-1.5">
            {LEGEND_CATEGORIES.map(cat => {
              const active = visibleLayers.has(cat.key);
              return (
                <button
                  key={cat.key}
                  onClick={() => onToggleLayer(cat.key)}
                  className={`flex items-center gap-2 text-[9px] px-2 py-1.5 rounded-xl border transition-all duration-200 ${
                    active
                      ? 'bg-slate-800/40 border-slate-600/40 text-slate-200'
                      : 'bg-slate-900/20 border-slate-700/20 text-slate-600 hover:border-slate-600/30'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0 transition-all duration-200"
                    style={{
                      background: active ? cat.color : '#334155',
                      boxShadow: active ? `0 0 8px ${cat.color}80, 0 0 16px ${cat.color}40` : 'none',
                    }}
                  />
                  <span className="truncate">{cat.label}</span>
                  {counts && counts[cat.key] > 0 && (
                    <span className="text-[7px] text-slate-500 ml-auto font-mono">{counts[cat.key]}</span>
                  )}
                </button>
              );
            })}
            </div>
          </div>

          {/* Live Data Sources */}
          <div className="border-t border-slate-700/25 pt-2.5">
            <div className="text-[8px] uppercase tracking-wider text-slate-500 mb-2">Live Data Sources</div>
            <div className="space-y-1.5">
              {DATA_SOURCES.map(src => {
                const isOwm = src.key === "owm";
                const enabled = isOwm ? !!weatherEnabled : true;
                return (
                  <div key={src.key} className="flex items-center justify-between gap-2 px-2 py-1.5 bg-slate-800/20 border border-slate-700/20 rounded-xl">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <src.Icon className="w-3 h-3 shrink-0" style={{ color: enabled ? src.color : "#475569" }} />
                      <span className="text-[9px] truncate" style={{ color: enabled ? 'rgba(255,255,255,0.8)' : '#475569' }}>
                        {src.label}
                      </span>
                    </div>
                    {isOwm && onToggleWeather ? (
                      <Switch
                        checked={!!weatherEnabled}
                        onCheckedChange={onToggleWeather}
                        className="scale-[0.6] origin-right data-[state=checked]:bg-sky-500/50"
                      />
                    ) : (
                      <span className="text-[7px] uppercase tracking-wider text-emerald-400/70 font-mono">LIVE</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Overlay toggles */}
          <div className="border-t border-slate-700/25 pt-2.5">
            <div className="text-[8px] uppercase tracking-wider text-slate-500 mb-2">Overlay Layers</div>
            <div className="space-y-1.5">
              {overlayToggles.map(t => (
                <div key={t.key} className="flex items-center justify-between gap-2 px-2 py-1.5 bg-slate-800/20 border border-slate-700/20 rounded-xl">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <t.Icon className="w-3 h-3 shrink-0" style={{ color: t.enabled ? t.color : "#475569" }} />
                    <span className="text-[9px] truncate" style={{ color: t.enabled ? 'rgba(255,255,255,0.8)' : '#475569' }}>
                      {t.label}
                    </span>
                  </span>
                  <Switch
                    checked={t.enabled}
                    onCheckedChange={() => t.onToggle?.()}
                    disabled={!t.onToggle}
                    className="scale-[0.6] origin-right data-[state=checked]:bg-sky-500/50"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
