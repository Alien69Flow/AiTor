import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, X, TrendingUp, TrendingDown, MapPin, AlertTriangle, Zap } from "lucide-react";
import type { HotspotData } from "@/components/globe/GlobeScene";
import { supabase } from "@/integrations/supabase/client";
import type { SpaceWeather } from "@/hooks/useSpaceWeather";

const TACTICAL_COLORS: Record<string, string> = {
  conflict: "#FF4444",
  finance: "#FFD700",
  tech: "#FFD700",
  geopolitical: "#0088FF",
};

const glassStyle = {
  background: "rgba(0,0,0,0.5)",
  backdropFilter: "blur(20px)",
  border: "0.5px solid rgba(255,255,255,0.06)",
};

interface GlobeOverlayProps {
  selectedHotspot?: HotspotData | null;
  onClose?: () => void;
  spaceWeather?: SpaceWeather;
}

export function GlobeOverlay({ selectedHotspot, onClose, spaceWeather }: GlobeOverlayProps) {
  // Dynamic tension based on NOAA data
  const baseTension = spaceWeather?.solarStorm ? 65 : spaceWeather?.kpIndex ? Math.max(20, spaceWeather.kpIndex * 10) : 35;

  const [tensionLevel, setTensionLevel] = useState(baseTension);

  useEffect(() => {
    setTensionLevel(baseTension);
  }, [baseTension]);

  // Small random fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      setTensionLevel((prev) => {
        const delta = (Math.random() - 0.5) * 2;
        return Math.max(10, Math.min(100, prev + delta));
      });
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const tensionColor =
    tensionLevel > 70 ? "#FF4444" : tensionLevel > 40 ? "#FFD700" : "#00FF41";
  const tensionStatus = tensionLevel > 70 ? "CRITICAL" : tensionLevel > 40 ? "ELEVATED" : "NORMAL";

  const kpActive = (spaceWeather?.kpIndex || 0) > 4;

  return (
    <>
      {/* Global Tension — top center */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full" style={glassStyle}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: tensionColor }} />
          <span className="text-[9px] font-mono text-white/30 uppercase tracking-wider">
            Tension
          </span>
          <span className="text-xs font-bold font-mono" style={{ color: tensionColor }}>
            {Math.round(tensionLevel)}
          </span>
          <span className="text-[8px] font-mono uppercase" style={{ color: tensionColor }}>
            {tensionStatus}
          </span>
          {kpActive && (
            <span className="flex items-center gap-0.5 text-[8px] font-mono text-[#FF00FF]">
              <Zap className="w-2.5 h-2.5" /> Kp{spaceWeather?.kpIndex?.toFixed(0)}
            </span>
          )}
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
    <div className="absolute top-14 right-3 z-20 w-64">
      <div className="rounded-lg overflow-hidden" style={{ ...glassStyle, border: `0.5px solid ${typeColor}22` }}>
        <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3" style={{ color: typeColor }} />
            <span className="text-xs font-bold text-white">{hotspot.name}</span>
            <span className="text-[9px] text-white/30">{hotspot.country}</span>
          </div>
          <button onClick={onClose} className="p-0.5 hover:bg-white/10 rounded transition-colors">
            <X className="w-3 h-3 text-white/30" />
          </button>
        </div>

        <div className="px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-white/25 uppercase font-mono">Vol</span>
            <span className="text-xs font-mono font-bold text-white">{hotspot.marketVolume}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-white/25 uppercase font-mono">24h</span>
            <div className="flex items-center gap-1">
              {trendPositive ? <TrendingUp className="w-3 h-3 text-[#00FF41]" /> : <TrendingDown className="w-3 h-3 text-[#FF4444]" />}
              <span className={`text-xs font-mono font-bold ${trendPositive ? "text-[#00FF41]" : "text-[#FF4444]"}`}>
                {hotspot.trend}
              </span>
            </div>
          </div>
          <div className="flex gap-1 flex-wrap">
            {hotspot.topTokens.map((t) => (
              <Badge key={t} variant="outline" className="text-[8px] px-1 py-0 h-3.5 bg-white/5 text-white/50 border-white/8">
                {t}
              </Badge>
            ))}
          </div>
        </div>

        <div className="px-3 py-1.5 flex items-center justify-between" style={{ borderTop: "0.5px solid rgba(255,255,255,0.04)" }}>
          <div className="flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5 text-[#00FF41]/50" />
            <span className="text-[8px] text-white/20 font-mono">{uapCount} UAP</span>
          </div>
          <Badge variant="outline" className="text-[7px] uppercase font-mono" style={{ color: typeColor, borderColor: typeColor + "33" }}>
            {hotspot.type}
          </Badge>
        </div>
      </div>
    </div>
  );
}
