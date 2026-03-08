import { Suspense, lazy, useState, useCallback } from "react";
import { LiveTicker } from "./LiveTicker";
import { GlobeOverlay } from "./GlobeOverlay";
import { FeedPanel } from "./FeedPanel";
import { useUAPSightings } from "@/hooks/useUAPSightings";
import type { HotspotData } from "@/components/globe/GlobeScene";
import { Eye, EyeOff, MapPin } from "lucide-react";

const CesiumGlobe = lazy(() =>
  import("@/components/globe/CesiumGlobe").then((m) => ({ default: m.CesiumGlobe }))
);

type LayerKey = "markets" | "uap" | "cryptozoo";

const LAYERS: { key: LayerKey; label: string; color: string; emoji: string }[] = [
  { key: "markets", label: "Markets", color: "#00ff41", emoji: "💹" },
  { key: "uap", label: "UAP/UFO", color: "#00ffff", emoji: "🛸" },
  { key: "cryptozoo", label: "Cryptozoo", color: "#ff8800", emoji: "🦎" },
];

const FLY_TO_REGIONS = [
  { label: "🌍 Overview", lat: 20, lon: 20, alt: 20000000 },
  { label: "🇺🇸 USA", lat: 39, lon: -98, alt: 6000000 },
  { label: "🇪🇺 Europe", lat: 50, lon: 10, alt: 6000000 },
  { label: "🌏 Asia", lat: 35, lon: 105, alt: 8000000 },
  { label: "🇧🇷 LATAM", lat: -15, lon: -55, alt: 8000000 },
  { label: "🏜️ Middle East", lat: 30, lon: 45, alt: 5000000 },
];

export function GlobeDashboard() {
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotData | null>(null);
  const { sightings } = useUAPSightings();
  const [visibleLayers, setVisibleLayers] = useState<Set<LayerKey>>(new Set(["markets", "uap", "cryptozoo"]));
  const [flyTo, setFlyTo] = useState<{ lat: number; lon: number; alt: number } | null>(null);

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

  const handleFlyTo = (region: typeof FLY_TO_REGIONS[0]) => {
    setFlyTo({ lat: region.lat, lon: region.lon, alt: region.alt });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      <LiveTicker />

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 relative min-w-0">
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-primary/50 text-sm font-mono animate-pulse">Loading Globe...</div>
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

          {/* Layer toggles */}
          <div className="absolute top-3 left-3 bg-card/80 backdrop-blur border border-border/30 rounded-lg p-2 z-10 space-y-1">
            <div className="text-[9px] text-muted-foreground/70 font-heading uppercase tracking-wider mb-1.5">Layers</div>
            {LAYERS.map((l) => (
              <button
                key={l.key}
                onClick={() => toggleLayer(l.key)}
                className={`flex items-center gap-1.5 w-full text-left px-1.5 py-1 rounded text-[10px] font-mono transition-colors ${
                  visibleLayers.has(l.key) ? "text-foreground/90 bg-muted/20" : "text-muted-foreground/30"
                }`}
              >
                {visibleLayers.has(l.key) ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span className="w-2 h-2 rounded-full" style={{ background: visibleLayers.has(l.key) ? l.color : "#555" }} />
                <span>{l.emoji} {l.label}</span>
              </button>
            ))}
          </div>

          {/* Fly-to navigation */}
          <div className="absolute top-3 right-3 bg-card/80 backdrop-blur border border-border/30 rounded-lg p-2 z-10">
            <div className="text-[9px] text-muted-foreground/70 font-heading uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Navigate
            </div>
            <div className="flex flex-wrap gap-1">
              {FLY_TO_REGIONS.map((r) => (
                <button
                  key={r.label}
                  onClick={() => handleFlyTo(r)}
                  className="px-1.5 py-0.5 rounded text-[9px] font-mono text-muted-foreground/60 hover:text-foreground hover:bg-muted/20 transition-colors"
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="absolute bottom-3 left-3 bg-card/80 backdrop-blur border border-border/30 rounded p-2 text-[10px] font-mono space-y-1 z-10">
            <div className="text-muted-foreground/70 font-semibold mb-1">SIGHTINGS</div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: "#00ffff" }} />
              <span className="text-muted-foreground">UAP</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: "#aa44ff" }} />
              <span className="text-muted-foreground">UFO Historical</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: "#ff8800" }} />
              <span className="text-muted-foreground">Cryptozoology</span>
            </div>
            <div className="text-muted-foreground/50 mt-1">{sightings.length} reports loaded</div>
          </div>
        </div>

        <FeedPanel />
      </div>

      <div className="flex items-center justify-between px-4 py-1.5 bg-card/60 border-t border-border/20 text-[9px]">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
          <span className="text-muted-foreground/50 font-mono">Connected</span>
        </div>
        <div className="flex items-center gap-4 text-muted-foreground/40">
          <span>Discord</span>
          <span>𝕏 Twitter</span>
          <span>Docs</span>
        </div>
      </div>
    </div>
  );
}
