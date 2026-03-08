import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { HelpCircle } from "lucide-react";

export function GlobeOverlay() {
  const [tensionLevel, setTensionLevel] = useState(53);

  useEffect(() => {
    const interval = setInterval(() => {
      setTensionLevel((prev) => {
        const delta = (Math.random() - 0.5) * 4;
        return Math.max(10, Math.min(100, prev + delta));
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const tensionStatus = tensionLevel > 70 ? "CRITICAL" : tensionLevel > 40 ? "ELEVATED" : "NORMAL";
  const tensionColor =
    tensionLevel > 70 ? "text-destructive" : tensionLevel > 40 ? "text-primary" : "text-secondary";

  return (
    <>
      {/* Global Tension indicator - centered top */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-card/70 backdrop-blur-md border border-border/30">
          <span className={`w-2 h-2 rounded-full ${tensionLevel > 70 ? "bg-destructive" : tensionLevel > 40 ? "bg-primary" : "bg-secondary"} animate-pulse`} />
          <span className="text-[10px] font-heading text-muted-foreground/70 uppercase tracking-wider">Global Tension</span>
          <span className={`text-sm font-bold font-mono ${tensionColor}`}>{Math.round(tensionLevel)}</span>
          <span className={`text-[10px] font-heading uppercase tracking-wider ${tensionColor}`}>{tensionStatus}</span>
          <HelpCircle className="w-3 h-3 text-muted-foreground/30" />
        </div>
      </div>

      {/* Market Volume - bottom left */}
      <div className="absolute bottom-16 left-4 z-10">
        <div className="bg-card/70 backdrop-blur-md border border-border/30 rounded-lg px-3 py-2">
          <span className="text-[9px] font-heading text-muted-foreground/50 uppercase tracking-wider block mb-1">Market Volume</span>
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 bg-muted/30 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-secondary to-destructive rounded-full" style={{ width: "35%" }} />
            </div>
          </div>
          <div className="flex justify-between text-[8px] text-muted-foreground/40 mt-0.5">
            <span>$0</span>
            <span>$50M</span>
          </div>
        </div>
      </div>

      {/* Legend - bottom center */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <div className="flex items-center gap-4 px-4 py-2 rounded-full bg-card/70 backdrop-blur-md border border-border/30">
          {[
            { label: "All", color: "bg-foreground/80", active: true },
            { label: "ISR", color: "bg-destructive" },
            { label: "VIP", color: "bg-primary" },
            { label: "Bomber", color: "bg-destructive/70" },
            { label: "Command", color: "bg-destructive/50" },
            { label: "Tanker", color: "bg-primary/70" },
            { label: "Transport", color: "bg-primary/50" },
            { label: "Fighter", color: "bg-secondary" },
          ].map((item) => (
            <button
              key={item.label}
              className={`flex items-center gap-1.5 text-[10px] ${
                item.active
                  ? "bg-muted/40 px-2.5 py-0.5 rounded-full text-foreground/90"
                  : "text-muted-foreground/60 hover:text-foreground/80"
              } transition-colors`}
            >
              <span className={`w-2 h-2 rounded-full ${item.color}`} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
