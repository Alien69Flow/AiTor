import { Suspense, lazy, useState, useCallback } from "react";
import { LiveTicker } from "./LiveTicker";
import { GlobeOverlay } from "./GlobeOverlay";
import { FeedPanel } from "./FeedPanel";
import { useUAPSightings } from "@/hooks/useUAPSightings";
import type { HotspotData } from "@/components/globe/GlobeScene";
import { Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";

const CesiumGlobe = lazy(() =>
  import("@/components/globe/CesiumGlobe").then((m) => ({ default: m.CesiumGlobe }))
);

type LayerKey = "markets" | "uap" | "cryptozoo";

const TACTICAL_CATEGORIES = [
  { key: "finance", emoji: "💰", label: "Finance", color: "#FFD700" },
  { key: "intel", emoji: "🛸", label: "Intel/UAP", color: "#00FF41" },
  { key: "conflict", emoji: "💥", label: "Conflict", color: "#FF4444" },
  { key: "geopolitical", emoji: "🏛️", label: "Geopolitical", color: "#0088FF" },
  { key: "logistics", emoji: "📦", label: "Logistics", color: "#FF8844" },
  { key: "cryptozoology", emoji: "🦎", label: "Cryptozoo", color: "#FF00FF" },
  { key: "convergence", emoji: "✨", label: "Convergence", color: "#FFFFFF" },
];

const FLY_TO_REGIONS = [
  { label: "🌍 Overview", lat: 20, lon: 20, alt: 20000000 },
  { label: "🇺🇸 USA", lat: 39, lon: -98, alt: 6000000 },
  { label: "🇪🇺 Europe", lat: 50, lon: 10, alt: 6000000 },
  { label: "🌏 Asia", lat: 35, lon: 105, alt: 8000000 },
  { label: "🇧🇷 LATAM", lat: -15, lon: -55, alt: 8000000 },
  { label: "🏜️ Middle East", lat: 30, lon: 45, alt: 5000000 },
];

const LAYER_MAP: { key: LayerKey; label: string; color: string; emoji: string }[] = [
  { key: "markets", label: "Markets", color: "#FFD700", emoji: "💰" },
  { key: "uap", label: "Intel/UAP", color: "#00FF41", emoji: "🛸" },
  { key: "cryptozoo", label: "Cryptozoo", color: "#FF00FF", emoji: "🦎" },
];

export function GlobeDashboard() {
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotData | null>(null);
  const { sightings } = useUAPSightings();
  const [visibleLayers, setVisibleLayers] = useState<Set<LayerKey>>(new Set(["markets", "uap", "cryptozoo"]));
  const [flyTo, setFlyTo] = useState<{ lat: number; lon: number; alt: number } | null>(null);
  const [legendCollapsed, setLegendCollapsed] = useState(false);

  const handleHotspotClick = useCallback((data: HotspotData | null) => {
    setSelectedHotspot(data);
  }, []);

  const toggleLayer = (key: LayerKey) => {
    setVisibleLayers(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 relative" style={{ background: "#000000" }}>
      <LiveTicker />

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 relative min-w-0">
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center" style={{ background: "#000" }}>
                <div className="text-[#00FF41]/50 text-sm font-mono animate-pulse">Initializing Tactical Globe...</div>
              </div>
            }
          >
            <CesiumGlobe
              onHotspotClick={handleHotspotClick}
              sightings={sightings}
              visibleLayers={visibleLayers}
              flyTo={flyTo}
            />
          </Suspense>

          <GlobeOverlay
            selectedHotspot={selectedHotspot}
            onClose={() => setSelectedHotspot(null)}
          />

          {/* Unified Tactical Console — bottom left */}
          <div className="absolute bottom-3 left-3 z-10 w-[200px]">
            <div className="rounded-lg overflow-hidden"
              style={{
                background: "rgba(0,0,0,0.65)",
                backdropFilter: "blur(16px)",
                border: "0.5px solid rgba(255,255,255,0.08)",
              }}
            >
              {/* Header with collapse toggle */}
              <button
                onClick={() => setLegendCollapsed(!legendCollapsed)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
              >
                <span className="text-[9px] font-mono uppercase tracking-wider text-white/50">
                  ⚡ Tactical Console
                </span>
                {legendCollapsed ? (
                  <ChevronUp className="w-3 h-3 text-white/30" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-white/30" />
                )}
              </button>

              {!legendCollapsed && (
                <>
                  {/* Navigate section */}
                  <div className="px-3 py-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    <div className="text-[8px] font-mono uppercase tracking-wider text-white/40 mb-1.5">
                      🧭 Navigate
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {FLY_TO_REGIONS.map((r) => (
                        <button
                          key={r.label}
                          onClick={() => setFlyTo({ lat: r.lat, lon: r.lon, alt: r.alt })}
                          className="px-1.5 py-0.5 rounded text-[8px] font-mono text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Layer toggles */}
                  <div className="px-3 py-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    <div className="text-[8px] font-mono uppercase tracking-wider text-white/40 mb-1.5">
                      📡 Layers
                    </div>
                    {LAYER_MAP.map((l) => (
                      <button
                        key={l.key}
                        onClick={() => toggleLayer(l.key)}
                        className="flex items-center gap-1.5 w-full text-left px-1.5 py-1 rounded text-[9px] font-mono transition-colors hover:bg-white/5"
                        style={{ color: visibleLayers.has(l.key) ? l.color : "rgba(255,255,255,0.2)" }}
                      >
                        {visibleLayers.has(l.key) ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: visibleLayers.has(l.key) ? l.color : "#333" }}
                        />
                        <span>{l.emoji} {l.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Tactical legend */}
                  <div className="px-3 py-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    <div className="text-[8px] font-mono uppercase tracking-wider text-white/40 mb-1.5">
                      🎯 Categories
                    </div>
                    <div className="space-y-0.5">
                      {TACTICAL_CATEGORIES.map((c) => (
                        <div key={c.key} className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
                          <span className="text-[8px] font-mono" style={{ color: c.color + "99" }}>
                            {c.emoji} {c.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="px-3 py-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    <div className="text-[8px] font-mono text-white/25">
                      {sightings.length} reports loaded
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <FeedPanel />
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t text-[9px]"
        style={{ background: "rgba(0,0,0,0.8)", borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00FF41] animate-pulse" />
          <span className="text-white/30 font-mono">TACTICAL MODE • ONLINE</span>
        </div>
        <div className="flex items-center gap-4 text-white/20 font-mono">
          <span>Liveuamap</span>
          <span>Firecrawl</span>
          <span>OSINT</span>
        </div>
      </div>
    </div>
  );
}
