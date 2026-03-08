import { Suspense, lazy, useState, useCallback } from "react";
import { LiveTicker } from "./LiveTicker";
import { GlobeOverlay } from "./GlobeOverlay";
import { FeedPanel } from "./FeedPanel";
import type { HotspotData } from "@/components/globe/GlobeScene";

const GlobeScene = lazy(() =>
  import("@/components/globe/GlobeScene").then((m) => ({ default: m.GlobeScene }))
);

export function GlobeDashboard() {
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotData | null>(null);

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
            <GlobeScene onHotspotClick={handleHotspotClick} />
          </Suspense>

          <GlobeOverlay
            selectedHotspot={selectedHotspot}
            onClose={() => setSelectedHotspot(null)}
          />
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
