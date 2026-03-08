import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, X, TrendingUp, TrendingDown, MapPin, AlertTriangle } from "lucide-react";
import type { HotspotData } from "@/components/globe/GlobeScene";
import { supabase } from "@/integrations/supabase/client";

interface GlobeOverlayProps {
  selectedHotspot?: HotspotData | null;
  onClose?: () => void;
}

export function GlobeOverlay({ selectedHotspot, onClose }: GlobeOverlayProps) {
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
      {/* Global Tension indicator */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-card/70 backdrop-blur-md border border-border/30">
          <span className={`w-2 h-2 rounded-full ${tensionLevel > 70 ? "bg-destructive" : tensionLevel > 40 ? "bg-primary" : "bg-secondary"} animate-pulse`} />
          <span className="text-[10px] font-heading text-muted-foreground/70 uppercase tracking-wider">Global Tension</span>
          <span className={`text-sm font-bold font-mono ${tensionColor}`}>{Math.round(tensionLevel)}</span>
          <span className={`text-[10px] font-heading uppercase tracking-wider ${tensionColor}`}>{tensionStatus}</span>
          <HelpCircle className="w-3 h-3 text-muted-foreground/30" />
        </div>
      </div>

      {/* Country Popup */}
      {selectedHotspot && (
        <CountryPopup hotspot={selectedHotspot} onClose={onClose} />
      )}

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

      {/* Legend */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <div className="flex items-center gap-4 px-4 py-2 rounded-full bg-card/70 backdrop-blur-md border border-border/30">
          {[
            { label: "All", color: "bg-foreground/80", active: true },
            { label: "Conflict", color: "bg-destructive" },
            { label: "Finance", color: "bg-primary" },
            { label: "Tech", color: "bg-secondary" },
            { label: "Geopolitical", color: "bg-primary/70" },
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

function CountryPopup({ hotspot, onClose }: { hotspot: HotspotData; onClose?: () => void }) {
  const [uapCount, setUapCount] = useState(0);

  useEffect(() => {
    // Fetch nearby UAP sightings count
    const fetchUAP = async () => {
      const { count } = await supabase
        .from("uap_sightings")
        .select("*", { count: "exact", head: true });
      setUapCount(count || 0);
    };
    fetchUAP();
  }, [hotspot]);

  const trendPositive = hotspot.trend.startsWith("+");
  const typeColors: Record<string, string> = {
    conflict: "border-destructive/50 bg-destructive/5",
    finance: "border-primary/50 bg-primary/5",
    tech: "border-secondary/50 bg-secondary/5",
    geopolitical: "border-primary/30 bg-primary/5",
  };

  return (
    <div className="absolute top-16 right-4 z-20 w-72">
      <div className={`bg-card/90 backdrop-blur-xl border rounded-lg overflow-hidden ${typeColors[hotspot.type] || "border-border/30"}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/20">
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            <div>
              <span className="text-xs font-bold text-foreground">{hotspot.name}</span>
              <span className="text-[10px] text-muted-foreground ml-1.5">{hotspot.country}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted/30 rounded transition-colors">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Market Data */}
        <div className="px-3 py-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Market Volume</span>
            <span className="text-sm font-mono font-bold text-foreground">{hotspot.marketVolume}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">24h Trend</span>
            <div className="flex items-center gap-1">
              {trendPositive ? (
                <TrendingUp className="w-3 h-3 text-secondary" />
              ) : (
                <TrendingDown className="w-3 h-3 text-destructive" />
              )}
              <span className={`text-sm font-mono font-bold ${trendPositive ? "text-secondary" : "text-destructive"}`}>
                {hotspot.trend}
              </span>
            </div>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Top Tokens</span>
            <div className="flex gap-1 flex-wrap">
              {hotspot.topTokens.map((t) => (
                <Badge key={t} variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-muted/20 text-foreground/80 border-border/30">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* UAP Data */}
        <div className="px-3 py-2 border-t border-border/20">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-primary/60" />
            <span className="text-[10px] text-muted-foreground">
              {uapCount} UAP reports in database
            </span>
          </div>
        </div>

        {/* Type badge */}
        <div className="px-3 pb-2">
          <Badge variant="outline" className="text-[9px] uppercase tracking-wider">
            {hotspot.type} zone
          </Badge>
        </div>
      </div>
    </div>
  );
}
