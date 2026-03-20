import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, X, TrendingUp, TrendingDown, MapPin, AlertTriangle } from "lucide-react";
import type { HotspotData } from "@/components/globe/GlobeScene";
import { supabase } from "@/integrations/supabase/client";

const TACTICAL_COLORS: Record<string, string> = {
  conflict: "#FF4444",
  finance: "#FFD700",
  tech: "#FFD700",
  geopolitical: "#0088FF",
};

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

  const tensionColor =
    tensionLevel > 70 ? "#FF4444" : tensionLevel > 40 ? "#FFD700" : "#00FF41";
  const tensionStatus = tensionLevel > 70 ? "CRITICAL" : tensionLevel > 40 ? "ELEVATED" : "NORMAL";

  return (
    <>
      {/* Global Tension — top center */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <div
          className="flex items-center gap-2 px-4 py-1.5 rounded-full"
          style={{
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(16px)",
            border: "0.5px solid rgba(255,255,255,0.08)",
          }}
        >
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: tensionColor }}
          />
          <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
            Global Tension
          </span>
          <span className="text-sm font-bold font-mono" style={{ color: tensionColor }}>
            {Math.round(tensionLevel)}
          </span>
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: tensionColor }}>
            {tensionStatus}
          </span>
          <HelpCircle className="w-3 h-3 text-white/15" />
        </div>
      </div>

      {/* Country Popup */}
      {selectedHotspot && (
        <CountryPopup hotspot={selectedHotspot} onClose={onClose} />
      )}
    </>
  );
}

function CountryPopup({ hotspot, onClose }: { hotspot: HotspotData; onClose?: () => void }) {
  const [uapCount, setUapCount] = useState(0);

  useEffect(() => {
    const fetchUAP = async () => {
      const { count } = await supabase
        .from("uap_sightings")
        .select("*", { count: "exact", head: true });
      setUapCount(count || 0);
    };
    fetchUAP();
  }, [hotspot]);

  const trendPositive = hotspot.trend.startsWith("+");
  const typeColor = TACTICAL_COLORS[hotspot.type] || "#FFD700";

  return (
    <div className="absolute top-16 right-4 z-20 w-72">
      <div
        className="rounded-lg overflow-hidden"
        style={{
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(20px)",
          border: `0.5px solid ${typeColor}33`,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5" style={{ color: typeColor }} />
            <div>
              <span className="text-xs font-bold text-white">{hotspot.name}</span>
              <span className="text-[10px] text-white/40 ml-1.5">{hotspot.country}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors">
            <X className="w-3.5 h-3.5 text-white/40" />
          </button>
        </div>

        {/* Market Data */}
        <div className="px-3 py-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/30 uppercase tracking-wider font-mono">Volume</span>
            <span className="text-sm font-mono font-bold text-white">{hotspot.marketVolume}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/30 uppercase tracking-wider font-mono">24h Trend</span>
            <div className="flex items-center gap-1">
              {trendPositive ? (
                <TrendingUp className="w-3 h-3 text-[#00FF41]" />
              ) : (
                <TrendingDown className="w-3 h-3 text-[#FF4444]" />
              )}
              <span className={`text-sm font-mono font-bold ${trendPositive ? "text-[#00FF41]" : "text-[#FF4444]"}`}>
                {hotspot.trend}
              </span>
            </div>
          </div>
          <div>
            <span className="text-[10px] text-white/30 uppercase tracking-wider font-mono block mb-1">Top Tokens</span>
            <div className="flex gap-1 flex-wrap">
              {hotspot.topTokens.map((t) => (
                <Badge key={t} variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-white/5 text-white/60 border-white/10">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* UAP Data */}
        <div className="px-3 py-2" style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-[#00FF41]/60" />
            <span className="text-[10px] text-white/30 font-mono">
              {uapCount} UAP reports in database
            </span>
          </div>
        </div>

        {/* Type badge */}
        <div className="px-3 pb-2">
          <Badge variant="outline" className="text-[9px] uppercase tracking-wider font-mono" style={{ color: typeColor, borderColor: typeColor + "44" }}>
            {hotspot.type} zone
          </Badge>
        </div>
      </div>
    </div>
  );
}
