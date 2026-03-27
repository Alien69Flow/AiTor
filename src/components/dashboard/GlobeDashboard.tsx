import { useState } from "react";
import { LiveTicker } from "./LiveTicker";
import { GlobeOverlay } from "./GlobeOverlay";
import { FeedPanel } from "./FeedPanel";
import { GlobeScene, UnifiedHotspotData } from "../globe/GlobeScene"; // Importación correcta
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

  return (
    <div className="flex flex-col flex-1 min-h-0 relative bg-black overflow-hidden">
      {/* 1. TICKER SUPERIOR (Precios Crypto) */}
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

      {/* 2. TICKER DE EVENTOS VIVOS */}
      <LiveTicker spaceWeather={spaceWeather} earthquakes={earthquakes} nasaEvents={nasaEvents} />

      <div className="flex flex-1 min-h-0 relative">
        {/* 3. MOTOR DEL GLOBO (GlobeScene unificado) */}
        <div className="absolute inset-0 z-0">
          <GlobeScene onHotspotClick={setSelectedHotspot} />
        </div>

        {/* 4. OVERLAY DE DATOS (Aparece al hacer click en un punto) */}
        <GlobeOverlay 
          selectedHotspot={selectedHotspot} 
          onClose={() => setSelectedHotspot(null)}
          spaceWeather={spaceWeather}
          earthquakeCount={earthquakes.length}
          nasaEventCount={nasaEvents.length}
        />

        {/* 5. CONTROLES TÁCTICOS (Izquierda) */}
        <div className="absolute top-3 left-3 z-30 w-[200px] space-y-2">
          {/* TENSIÓN GEOMAGNÉTICA */}
          <div className={glass}>
            <div className="px-3 py-2 flex items-center justify-between border-b border-white/5">
              <span className="text-[9px] font-mono text-white/40 uppercase tracking-tighter">Ionosphere</span>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: kpColor }} />
            </div>
            <div className="px-3 py-2 font-mono">
              <div className="text-lg font-bold" style={{ color: kpColor }}>Kp {spaceWeather.kpIndex.toFixed(1)}</div>
              <div className="text-[8px] text-white/30 uppercase leading-none">Status: {spaceWeather.solarStorm ? 'Storm Active' : 'Stable'}</div>
            </div>
          </div>

          {/* SELECTOR DE CAPAS */}
          <div className={glass}>
            <button 
              onClick={() => setConsoleSections(p => ({...p, legend: !p.legend}))}
              className="w-full flex items-center justify-between px-3 py-2 text-[9px] font-mono text-white/40 uppercase"
            >
              <span>Vision Layers</span>
              {consoleSections.legend ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {consoleSections.legend && (
              <div className="px-3 pb-2 space-y-2 border-t border-white/5 pt-2">
                {LAYER_MAP.map(l => (
                  <button key={l.key} onClick={() => toggleLayer(l.key)} className="flex items-center gap-2 text-[10px] font-mono w-full transition-all hover:bg-white/5 rounded">
                    {visibleLayers.has(l.key) ? <Eye className="w-3 h-3 text-[#00FF41]" /> : <EyeOff className="w-3 h-3 text-white/20" />}
                    <span style={{ color: visibleLayers.has(l.key) ? l.color : "#444" }}>{l.emoji} {l.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 6. PANEL DE FEED (Derecha) */}
        <div className="absolute right-0 top-0 h-full z-20">
          <FeedPanel earthquakes={earthquakes} nasaEvents={nasaEvents} />
        </div>

        {/* HUD INFERIOR */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1">
          <div className={`${glass} px-4 py-1 text-[10px] font-mono text-[#00FF41] tracking-[0.2em] shadow-[0_0_20px_rgba(0,255,65,0.15)]`}>
            SYSTEM STATUS: <span className="animate-pulse">DECRYPTING...</span>
          </div>
        </div>
      </div>

      {/* 7. FOOTER BAR */}
      <div className="flex items-center justify-between px-4 py-1 border-t border-white/[0.04] text-[8px] bg-black/90 font-mono text-white/20 z-30">
        <div className="flex gap-4">
          <span>LAT: 35.7° N</span>
          <span>LON: 51.4° E</span>
          <span>ALT: 400KM</span>
        </div>
        <div className="flex gap-3">
          <span className={spaceWeather.kpIndex > 4 ? "text-magenta-500 animate-pulse" : ""}>NOAA ACTIVE</span>
          <span>USGS LIVE</span>
          <span>OSINT LINKED</span>
        </div>
      </div>
    </div>
  );
}
