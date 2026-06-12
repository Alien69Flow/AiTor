import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { X, TrendingUp, TrendingDown, MapPin, TriangleAlert as AlertTriangle, Zap } from "lucide-react";
import type { HotspotData } from "@/components/globe/GlobeScene";
import type { SpaceWeather } from "@/hooks/useSpaceWeather";
import { fetchUapSightingsCount } from "@/lib/uap-sightings";

const TYPE_COLORS: Record<string, string> = {
  conflict: "#f87171",
  finance: "#fbbf24",
  tech: "#fbbf24",
  geopolitical: "#60a5fa",
};

interface GlobeOverlayProps {
  selectedHotspot?: HotspotData | null;
  onClose?: () => void;
  spaceWeather?: SpaceWeather;
  earthquakeCount?: number;
  nasaEventCount?: number;
}

export function GlobeOverlay({ selectedHotspot, onClose, spaceWeather, earthquakeCount = 0, nasaEventCount = 0 }: GlobeOverlayProps) {
  const kpContrib = spaceWeather?.kpIndex ? spaceWeather.kpIndex * 8 : 0;
  const stormContrib = spaceWeather?.solarStorm ? 25 : 0;
  const quakeContrib = Math.min(earthquakeCount * 0.1, 15);
  const nasaContrib = Math.min(nasaEventCount * 0.5, 10);
  const baseTension = Math.max(15, Math.min(100, kpContrib + stormContrib + quakeContrib + nasaContrib + 10));

  const [tensionLevel, setTensionLevel] = useState(baseTension);

  useEffect(() => {
    setTensionLevel(baseTension);
  }, [baseTension]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTensionLevel((prev) => {
        const delta = (Math.random() - 0.5) * 2;
        return Math.max(10, Math.min(100, prev + delta));
      });
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const tensionColor = tensionLevel > 70 ? "#ef4444" : tensionLevel > 40 ? "#fbbf24" : "#34d399";
  const tensionStatus = tensionLevel > 70 ? "CRITICAL" : tensionLevel > 40 ? "ELEVATED" : "NORMAL";
  const kpActive = (spaceWeather?.kpIndex || 0) > 4;

  return (
    <>
      {/* Global Tension Indicator (Floating Top Center) */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
        <div className="flex items-center gap-2.5 px-5 py-2 rounded-2xl bg-slate-950/60 backdrop-blur-2xl border border-slate-700/40 shadow-2xl shadow-blue-900/10">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: tensionColor, boxShadow: `0 0 8px ${tensionColor}80` }} />
          <span className="text-[9px] font-mono text-[#b4c5b0] uppercase tracking-wider">Tension</span>
          <span className="text-xs font-bold font-mono text-white/90" style={{ color: tensionColor }}>{Math.round(tensionLevel)}</span>
          <span className="text-[8px] font-mono uppercase" style={{ color: tensionColor }}>{tensionStatus}</span>
          {kpActive && (
            <span className="flex items-center gap-0.5 text-[8px] font-mono text-purple-400">
              <Zap className="w-2.5 h-2.5" /> Kp{spaceWeather?.kpIndex?.toFixed(0)}
            </span>
          )}
          {earthquakeCount > 0 && (
            <span className="text-[8px] font-mono text-red-400/60">{earthquakeCount}</span>
          )}
        </div>
      </div>

      {/* Detail Popup */}
      {selectedHotspot && <CountryPopup hotspot={selectedHotspot} onClose={onClose} />}
    </>
  );
}

function CountryPopup({ hotspot, onClose }: { hotspot: HotspotData; onClose?: () => void }) {
  const [uapCount, setUapCount] = useState(0);

  useEffect(() => {
    const fetchUAP = async () => {
      const count = await fetchUapSightingsCount();
      setUapCount(count);
    };
    fetchUAP();
  }, [hotspot]);

  const trendPositive = hotspot.trend.startsWith("+");
  const typeColor = TYPE_COLORS[hotspot.type] || "#fbbf24";

  return (
    <div className="absolute top-14 right-3 z-50 w-64 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="rounded-2xl overflow-hidden bg-slate-950/60 backdrop-blur-2xl border border-slate-700/40 shadow-2xl shadow-blue-900/10" style={{ borderColor: `${typeColor}33` }}>
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-700/25">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3" style={{ color: typeColor }} />
            <span className="text-xs font-bold text-white/90">{hotspot.name}</span>
            <span className="text-[9px] text-slate-500">{hotspot.country}</span>
          </div>
          <button onClick={onClose} className="p-0.5 hover:bg-slate-700/40 rounded-lg transition-colors">
            <X className="w-3 h-3 text-slate-400" />
          </button>
        </div>
        <div className="px-3.5 py-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-500 uppercase font-mono">Vol</span>
            <span className="text-xs font-mono font-bold text-white/90">{hotspot.marketVolume}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-500 uppercase font-mono">24h</span>
            <div className="flex items-center gap-1">
              {trendPositive ? <TrendingUp className="w-3 h-3 text-emerald-400" /> : <TrendingDown className="w-3 h-3 text-red-400" />}
              <span className={`text-xs font-mono font-bold ${trendPositive ? "text-emerald-400" : "text-red-400"}`}>{hotspot.trend}</span>
            </div>
          </div>
          <div className="flex gap-1 flex-wrap">
            {hotspot.topTokens.map((t) => (
              <Badge key={t} variant="outline" className="text-[8px] px-1 py-0 h-3.5 rounded-md bg-slate-800/30 text-slate-400 border-slate-600/30">{t}</Badge>
            ))}
          </div>
        </div>
        <div className="px-3.5 py-2 flex items-center justify-between border-t border-slate-700/25">
          <div className="flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5 text-emerald-400/50" />
            <span className="text-[8px] text-slate-500 font-mono">{uapCount} UAP Reports</span>
          </div>
          <Badge variant="outline" className="text-[7px] uppercase font-mono rounded-md" style={{ color: typeColor, borderColor: typeColor + "33" }}>{hotspot.type}</Badge>
        </div>
      </div>
    </div>
  );
}
