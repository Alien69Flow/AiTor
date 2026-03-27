import { Suspense, lazy, useState, useCallback } from "react";
import { LiveTicker } from "./LiveTicker";
import { GlobeOverlay } from "./GlobeOverlay";
import { FeedPanel } from "./FeedPanel";
import { useUAPSightings } from "@/hooks/useUAPSightings";
import { useSpaceWeather } from "@/hooks/useSpaceWeather";
import { useEarthquakes } from "@/hooks/useEarthquakes";
import { useNasaEvents } from "@/hooks/useNasaEvents";
import { useCryptoPrices } from "@/hooks/useCryptoPrices";
import { Eye, EyeOff, ChevronDown, ChevronUp, Volume2, VolumeX } from "lucide-react";

// ⚠️ CAMBIO CRÍTICO: Importamos el motor compatible con Three.js
const ReactGlobe = lazy(() =>
  import("react-globe.gl").then((m) => ({ default: m.default }))
);

type LayerKey = "markets" | "uap" | "cryptozoo";

const TACTICAL_CATEGORIES = [
  { key: "finance", emoji: "💰", label: "Finance", color: "#FFD700" },
  { key: "intel", emoji: "🛸", label: "Intel/UAP", color: "#00FF41" },
  { key: "conflict", emoji: "💥", label: "Conflict", color: "#FF4444" },
  { key: "geopolitical", emoji: "🏛️", label: "Geopolitical", color: "#0088FF" },
  { key: "logistics", emoji: "📦", label: "Logistics", color: "#FF8844" },
  { key: "cryptozoology", emoji: "🦎", label: "Cryptozoo", color: "#FF00FF" },
  { key: "convergence", emoji: "✨", label: "Convergence", color: "#FFFFFF" },
];

const FLY_TO_REGIONS = [
  { label: "🌍", lat: 20, lon: 20, alt: 2.5 }, // Altura ajustada para react-globe
  { label: "🇺🇸", lat: 39, lon: -98, alt: 1.5 },
  { label: "🇪🇺", lat: 50, lon: 10, alt: 1.5 },
  { label: "🌏", lat: 35, lon: 105, alt: 1.8 },
  { label: "🇧🇷", lat: -15, lon: -55, alt: 1.8 },
  { label: " Desert", lat: 30, lon: 45, alt: 1.2 },
];

const LAYER_MAP: { key: LayerKey; label: string; color: string; emoji: string }[] = [
  { key: "markets", label: "Markets", color: "#FFD700", emoji: "💰" },
  { key: "uap", label: "Intel/UAP", color: "#00FF41", emoji: "🛸" },
  { key: "cryptozoo", label: "Cryptozoo", color: "#FF00FF", emoji: "🦎" },
];

const glass = "bg-black/50 backdrop-blur-xl border border-white/[0.06] rounded-lg";

export function GlobeDashboard() {
  const [selectedHotspot, setSelectedHotspot] = useState<any | null>(null);
  const { sightings } = useUAPSightings();
  const spaceWeather = useSpaceWeather();
  const { earthquakes } = useEarthquakes();
  const { events: nasaEvents } = useNasaEvents();
  const { prices: cryptoPrices } = useCryptoPrices();
  const [visibleLayers, setVisibleLayers] = useState<Set<LayerKey>>(new Set(["markets", "uap", "cryptozoo"]));
  const [consoleSections, setConsoleSections] = useState({ tension: true, noaa: true, legend: false, nav: false });
  const [audioEnabled, setAudioEnabled] = useState(true);

  const toggleLayer = (key: LayerKey) => {
    setVisibleLayers(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleSection = (key: keyof typeof consoleSections) => {
    setConsoleSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const kpColor = spaceWeather.kpIndex > 5 ? "#FF00FF" : spaceWeather.kpIndex > 4 ? "#FF4444" : "#00FF41";
  const kpActive = spaceWeather.kpIndex > 4;

  return (
    <div className="flex flex-col flex-1 min-h-0 relative bg-black">
      {/* Ticker Superior */}
      <div className="flex items-center gap-4 px-3 py-1 border-b border-white/[0.04] text-[10px] overflow-x-auto bg-black/90">
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
        {/* CONTENEDOR DEL GLOBO 3D */}
        <div className="absolute inset-0 z-0">
          <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center bg-black">
              <div className="text-[#00FF41]/50 text-sm font-mono animate-pulse uppercase tracking-tighter">
                Establishing Neural Link...
              </div>
            </div>
          }>
            <ReactGlobe
              globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
              bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
              backgroundColor="rgba(0,0,0,0)"
              pointsData={visibleLayers.has("uap") ? sightings : []}
              pointColor={() => "#00FF41"}
              pointAltitude={0.1}
              pointRadius={0.5}
            />
          </Suspense>
        </div>

        {/* OVERLAYS TÁCTICOS (Izquierda) */}
        <div className="absolute top-3 left-3 z-10 w-[220px] max-h-[calc(100%-40px)] overflow-y-auto space-y-2 no-scrollbar">
          {/* SECCIÓN: TENSIÓN GLOBAL */}
          <div className={glass}>
            <button onClick={() => toggleSection("tension")} className="w-full flex items-center justify-between px-3 py-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">⚡ Global Tension</span>
              {consoleSections.tension ? <ChevronUp className="w-3 h-3 text-white/20" /> : <ChevronDown className="w-3 h-3 text-white/20" />}
            </button>
            {consoleSections.tension && (
              <div className="px-3 pb-2 font-mono">
                <div className="text-xl font-bold" style={{ color: kpColor }}>Kp: {spaceWeather.kpIndex.toFixed(1)}</div>
                {kpActive && <div className="text-[8px] text-[#FF00FF] animate-pulse">[ALERT] GEOMAGNETIC STORM</div>}
              </div>
            )}
          </div>

          {/* SECCIÓN: LEYENDA Y CAPAS */}
          <div className={glass}>
            <button onClick={() => toggleSection("legend")} className="w-full flex items-center justify-between px-3 py-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">📡 Layers</span>
              {consoleSections.legend ? <ChevronUp className="w-3 h-3 text-white/20" /> : <ChevronDown className="w-3 h-3 text-white/20" />}
            </button>
            {consoleSections.legend && (
              <div className="px-3 pb-2 space-y-1">
                {LAYER_MAP.map(l => (
                  <button key={l.key} onClick={() => toggleLayer(l.key)} className="flex items-center gap-2 text-[9px] font-mono w-full">
                    {visibleLayers.has(l.key) ? <Eye className="w-3 h-3 text-white" /> : <EyeOff className="w-3 h-3 text-white/20" />}
                    <span style={{ color: visibleLayers.has(l.key) ? l.color : "#444" }}>{l.emoji} {l.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PANEL DERECHO: Feed de Datos */}
        <div className="absolute right-0 top-0 h-full z-10">
            <FeedPanel earthquakes={earthquakes} nasaEvents={nasaEvents} />
        </div>

        {/* HUD INFERIOR */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
            <div className={`${glass} px-3 py-1 text-[9px] font-mono text-[#00FF41]`}>
              SYSTEM STATUS: <span className="animate-pulse">ONLINE</span>
            </div>
        </div>
      </div>

      {/* Footer Status */}
      <div className="flex items-center justify-between px-4 py-1 border-t border-white/[0.04] text-[8px] bg-black/90 font-mono text-white/20">
        <div>TACTICAL INTERFACE V2.0</div>
        <div className="flex gap-3"><span>NASA ✓</span><span>NOAA ✓</span><span>OSINT ACTIVE</span></div>
      </div>
    </div>
  );
}
