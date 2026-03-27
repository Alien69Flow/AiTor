import { useState } from "react";
import { LiveTicker } from "./LiveTicker";
import { GlobeOverlay } from "./GlobeOverlay";
import { FeedPanel } from "./FeedPanel";
import { GlobeScene, UnifiedHotspotData } from "../globe/GlobeScene"; // Importación directa
import { useUAPSightings } from "@/hooks/useUAPSightings";
import { useSpaceWeather } from "@/hooks/useSpaceWeather";
import { useEarthquakes } from "@/hooks/useEarthquakes";
import { useNasaEvents } from "@/hooks/useNasaEvents";
import { useCryptoPrices } from "@/hooks/useCryptoPrices";
import { Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";

type LayerKey = "markets" | "uap" | "cryptozoo";

const LAYER_MAP: { key: LayerKey; label: string; color: string; emoji: string }[] = [
  { key: "markets", label: "Markets", color: "#FFD700", emoji: "💰" },
  { key: "uap", label: "Intel/UAP", color: "#00FF41", emoji: "🛸" },
  { key: "cryptozoo", label: "Cryptozoo", color: "#FF00FF", emoji: "🦎" },
];

const glass = "bg-black/50 backdrop-blur-xl border border-white/[0.06] rounded-lg";

export function GlobeDashboard() {
  const [selectedHotspot, setSelectedHotspot] = useState<UnifiedHotspotData | null>(null);
  const { sightings } = useUAPSightings();
  const spaceWeather = useSpaceWeather();
  const { earthquakes } = useEarthquakes();
  const { events: nasaEvents } = useNasaEvents();
  const { prices: cryptoPrices } = useCryptoPrices();
  const [visibleLayers, setVisibleLayers] = useState<Set<LayerKey>>(new Set(["markets", "uap", "cryptozoo"]));
  const [consoleSections, setConsoleSections] = useState({ tension: true, legend: true });

  const toggleLayer = (key: LayerKey) => {
    setVisibleLayers(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const kpColor = spaceWeather.kpIndex > 5 ? "#FF00FF" : spaceWeather.kpIndex > 4 ? "#FF4444" : "#00FF41";
  const kpActive = spaceWeather.kpIndex > 4;

  return (
    <div className="flex flex-col flex-1 min-h-0 relative bg-black overflow-hidden">
      {/* Ticker Superior: Precios Crypto */}
      <div className="flex items-center gap-4 px-3 py-1 border-b border-white/[0.04] text-[10px] overflow-x-auto bg-black/90 no-scrollbar z-20">
        {cryptoPrices.map((c) => (
          <div key={c.id} className="flex items-center gap-1.5 shrink-0">
            <span className="font-mono font-bold text-[#FFD700]">{c.symbol}</span>
            <span className="font-mono text-white/60">${c.price.toLocaleString()}</span>
            <span className={`font-mono text-[9px] ${c.change24h >= 0 ? "text-[#00FF41]" : "text-[#FF4444]"}`}>
              {c.change24h >= 0 ? "+" : ""}{c.change24h.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      <LiveTicker spaceWeather={spaceWeather} earthquakes={earthquakes} nasaEvents={nasaEvents} />

      <div className="flex flex-1 min-h-0 relative">
        {/* MOTOR PRINCIPAL: GlobeScene (Aquí vive la lógica de 167 líneas) */}
        <div className="absolute inset-0 z-0">
          <GlobeScene onHotspotClick={setSelectedHotspot} />
        </div>

        {/* OVERLAY DE DATOS DETALLADOS */}
        {selectedHotspot && (
          <GlobeOverlay 
            selectedHotspot={selectedHotspot} 
            onClose={() => setSelectedHotspot(null)} 
          />
        )}

        {/* CONTROLES IZQUIERDA */}
        <div className="absolute top-3 left-3 z-30 w-[200px] space-y-2">
          <div className={glass}>
            <button onClick={() => setConsoleSections(s => ({...s, tension: !s.tension}))} className="w-full flex items-center justify-between px-3 py-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">⚡ Tension</span>
              {consoleSections.tension ? <ChevronUp className="w-3 h-3 text-white/20" /> : <ChevronDown className="w-3 h-3 text-white/20" />}
            </button>
            {consoleSections.tension && (
              <div className="px-3 pb-2 font-mono">
                <div className="text-xl font-bold" style={{ color: kpColor }}>Kp: {spaceWeather.kpIndex.toFixed(1)}</div>
                {kpActive && <div className="text-[8px] text-[#FF00FF] animate-pulse">GEOMAGNETIC STORM</div>}
              </div>
            )}
          </div>

          <div className={glass}>
            <button onClick={() => setConsoleSections(s => ({...s, legend: !s.legend}))} className="w-full flex items-center justify-between px-3 py-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">📡 Layers</span>
              {consoleSections.legend ? <ChevronUp className="w-3 h-3 text-white/20" /> : <ChevronDown className="w-3 h-3 text-white/20" />}
            </button>
            {consoleSections.legend && (
              <div className="px-3 pb-2 space-y-1">
                {LAYER_MAP.map(l => (
                  <button key={l.key} onClick={() => toggleLayer(l.key)} className="flex items-center gap-2 text-[9px] font-mono w-full">
                    {visibleLayers.has(l.key) ? <Eye className="w-3 h-3 text-[#00FF41]" /> : <EyeOff className="w-3 h-3 text-white/20" />}
                    <span style={{ color: visibleLayers.has(l.key) ? l.color : "#444" }}>{l.emoji} {l.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PANEL DERECHO: Feed */}
        <div className="absolute right-0 top-0 h-full z-20">
          <FeedPanel earthquakes={earthquakes} nasaEvents={nasaEvents} />
        </div>

        {/* HUD INFERIOR */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
          <div className={`${glass} px-4 py-1 text-[10px] font-mono text-[#00FF41] border-[#00FF41]/20 shadow-[0_0_15px_rgba(0,255,65,0.1)]`}>
            LINK STATUS: <span className="animate-pulse font-bold">ENCRYPTED</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-1 border-t border-white/[0.04] text-[8px] bg-black/90 font-mono text-white/20 z-30">
        <div>TACTICAL INTERFACE V2.0</div>
        <div className="flex gap-3"><span>NASA ✓</span><span>USGS ✓</span><span>NOAA ✓</span></div>
      </div>
    </div>
  );
}
