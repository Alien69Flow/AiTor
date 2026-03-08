import { Suspense, lazy, useState, useCallback } from "react";
import { LiveTicker } from "./LiveTicker";
import { GlobeOverlay } from "./GlobeOverlay";
import { FeedPanel } from "./FeedPanel";
import { useUAPSightings } from "@/hooks/useUAPSightings";
import type { HotspotData } from "@/components/globe/GlobeScene";

const CesiumGlobe = lazy(() =>
  import("@/components/globe/CesiumGlobe").then((m) => ({ default: m.CesiumGlobe }))
);

export function GlobeDashboard() {
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotData | null>(null);
  const { sightings } = useUAPSightings();

  const handleHotspotClick = useCallback((data: HotspotData | null) => {
    setSelectedHotspot(data);
  }, []);

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
            <CesiumGlobe onHotspotClick={handleHotspotClick} sightings={sightings} />
          </Suspense>

          <GlobeOverlay
            selectedHotspot={selectedHotspot}
            onClose={() => setSelectedHotspot(null)}
          />

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
