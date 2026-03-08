import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function SolarSystemTab() {
  const [loading, setLoading] = useState(true);

  return (
    <div className="relative w-full h-full flex-1">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-background">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="w-16 h-16 rounded-full" />
            <span className="text-xs font-heading text-primary neon-text-green tracking-wider uppercase animate-pulse">
              Loading NASA Eyes...
            </span>
          </div>
        </div>
      )}
      <iframe
        src="https://eyes.nasa.gov/apps/solar-system/#/home"
        className="w-full h-full border-0"
        style={{ minHeight: "calc(100vh - 60px)" }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
        allowFullScreen
        onLoad={() => setLoading(false)}
        title="NASA Eyes - Solar System"
      />
    </div>
  );
}
