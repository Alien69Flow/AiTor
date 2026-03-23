import { Suspense, lazy, useState, useCallback } from "react";
import { LiveTicker } from "./LiveTicker";
import { GlobeOverlay } from "./GlobeOverlay";
import { FeedPanel } from "./FeedPanel";
import { useUAPSightings } from "@/hooks/useUAPSightings";
import { useSpaceWeather } from "@/hooks/useSpaceWeather";
import { useEarthquakes } from "@/hooks/useEarthquakes";
import { useNasaEvents } from "@/hooks/useNasaEvents";
import { useCryptoPrices } from "@/hooks/useCryptoPrices";
import type { HotspotData } from "@/components/globe/GlobeScene";
import { Eye, EyeOff, ChevronDown, ChevronUp, Volume2, VolumeX } from "lucide-react";

const CesiumGlobe = lazy(() =>
  import("@/components/globe/CesiumGlobe").then((m) => ({ default: m.CesiumGlobe }))
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
  { label: "🌍", lat: 20, lon: 20, alt: 20000000 },
  { label: "🇺🇸", lat: 39, lon: -98, alt: 6000000 },
  { label: "🇪🇺", lat: 50, lon: 10, alt: 6000000 },
  { label: "🌏", lat: 35, lon: 105, alt: 8000000 },
  { label: "🇧🇷", lat: -15, lon: -55, alt: 8000000 },
  { label: "🏜️", lat: 30, lon: 45, alt: 5000000 },
];

const LAYER_MAP: { key: LayerKey; label: string; color: string; emoji: string }[] = [
  { key: "markets", label: "Markets", color: "#FFD700", emoji: "💰" },
  { key: "uap", label: "Intel/UAP", color: "#00FF41", emoji: "🛸" },
  { key: "cryptozoo", label: "Cryptozoo", color: "#FF00FF", emoji: "🦎" },
];

const glass = "bg-black/50 backdrop-blur-xl border border-white/[0.06] rounded-lg";

export function GlobeDashboard() {
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotData | null>(null);
  const { sightings } = useUAPSightings();
  const spaceWeather = useSpaceWeather();
  const { earthquakes } = useEarthquakes();
  const { events: nasaEvents } = useNasaEvents();
  const { prices: cryptoPrices } = useCryptoPrices();
  const [visibleLayers, setVisibleLayers] = useState<Set<LayerKey>>(new Set(["markets", "uap", "cryptozoo"]));
  const [flyTo, setFlyTo] = useState<{ lat: number; lon: number; alt: number } | null>(null);
  const [consoleSections, setConsoleSections] = useState({ tension: true, noaa: true, legend: false, nav: false });
  const [audioEnabled, setAudioEnabled] = useState(true);

  const handleHotspotClick = useCallback((data: HotspotData | null) => {
    setSelectedHotspot(data);
  }, []);

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
    <div className="flex flex-col flex-1 min-h-0 relative" style={{ background: "#000000" }}>
      {/* Crypto ticker bar */}
      <div className="flex items-center gap-4 px-3 py-1 border-b border-white/[0.04] text-[10px] overflow-x-auto"
        style={{ background: "rgba(0,0,0,0.9)" }}>
        {cryptoPrices.map((c) => (
          <div key={c.id} className="flex items-center gap-1.5 shrink-0">
            <span className="font-mono font-bold text-[#FFD700]">{c.symbol}</span>
            <span className="font-mono text-white/60">${c.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            <span className={`font-mono text-[9px] ${c.change24h >= 0 ? "text-[#00FF41]" : "text-[#FF4444]"}`}>
              {c.change24h >= 0 ? "+" : ""}{c.change24h.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      <LiveTicker spaceWeather={spaceWeather} earthquakes={earthquakes} nasaEvents={nasaEvents} />

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 relative min-w-0">
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center" style={{ background: "#000" }}>
                <div className="text-[#00FF41]/50 text-sm font-mono animate-pulse">Initializing Tactical Globe...</div>
              </div>
            }
          >
            <CesiumGlobe
              onHotspotClick={handleHotspotClick}
              sightings={sightings}
              visibleLayers={visibleLayers}
              flyTo={flyTo}
              kpIndex={spaceWeather.kpIndex}
              earthquakes={earthquakes}
              nasaEvents={nasaEvents}
            />
          </Suspense>

          <GlobeOverlay
            selectedHotspot={selectedHotspot}
            onClose={() => setSelectedHotspot(null)}
            spaceWeather={spaceWeather}
            earthquakeCount={earthquakes.length}
            nasaEventCount={nasaEvents.length}
          />

          {/* ═══════ LEFT PANEL: Tactical Overview & Console ═══════ */}
          <div className="absolute top-3 left-3 z-10 w-[220px] max-h-[calc(100%-80px)] overflow-y-auto space-y-2 scrollbar-none">

            {/* GLOBAL TENSION */}
            <div className={glass}>
              <button onClick={() => toggleSection("tension")}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors">
                <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">⚡ Global Tension</span>
                {consoleSections.tension ? <ChevronUp className="w-3 h-3 text-white/20" /> : <ChevronDown className="w-3 h-3 text-white/20" />}
              </button>
              {consoleSections.tension && (
                <div className="px-3 pb-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold font-mono" style={{ color: kpColor }}>
                      Kp: {spaceWeather.kpIndex.toFixed(1)}
                    </span>
                    {kpActive && (
                      <span className="text-[9px] font-mono uppercase tracking-wider text-[#FF00FF] animate-pulse">
                        [ALERT] TESLA CONVERGENCE
                      </span>
                    )}
                  </div>
                  {spaceWeather.solarStorm && (
                    <div className="mt-1 text-[9px] font-mono text-[#FF4444]">
                      ⚡ SOLAR RADIATION ACTIVE
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* NOAA SPACE WEATHER */}
            <div className={glass}>
              <button onClick={() => toggleSection("noaa")}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors">
                <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">🌐 NOAA Space Weather</span>
                {consoleSections.noaa ? <ChevronUp className="w-3 h-3 text-white/20" /> : <ChevronDown className="w-3 h-3 text-white/20" />}
              </button>
              {consoleSections.noaa && (
                <div className="px-3 pb-2 space-y-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[8px] font-mono text-white/25 uppercase">Realtime Indices</div>
                      <div className="text-sm font-mono font-bold" style={{ color: kpColor }}>
                        {spaceWeather.kpIndex.toFixed(1)} | <span className="text-[#0088FF]">ᵟ{(spaceWeather.kpIndex * 3.26).toFixed(0)}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[8px] font-mono text-white/25 uppercase">Reactive Indices</div>
                      <div className="text-sm font-mono font-bold text-white/70">
                        {spaceWeather.radioBlackout} | <span className="text-[#FFD700]">{spaceWeather.stormLevel}</span>
                      </div>
                    </div>
                  </div>
                  {/* Mini chart placeholder */}
                  <div className="h-12 w-full rounded bg-white/[0.03] border border-white/[0.04] flex items-end px-1 pb-1 gap-px">
                    {Array.from({ length: 20 }, (_, i) => {
                      const h = 8 + Math.sin(i * 0.5 + spaceWeather.kpIndex) * 15 + Math.random() * 10;
                      return <div key={i} className="flex-1 rounded-sm" style={{ height: `${Math.max(2, h)}%`, background: i > 15 ? "#FF444488" : "#00FF4144" }} />;
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* LEGEND & LAYERS */}
            <div className={glass}>
              <button onClick={() => toggleSection("legend")}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors">
                <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">📡 Legend & Layers</span>
                {consoleSections.legend ? <ChevronUp className="w-3 h-3 text-white/20" /> : <ChevronDown className="w-3 h-3 text-white/20" />}
              </button>
              {consoleSections.legend && (
                <div className="px-3 pb-2 space-y-2">
                  {/* Toggleable layers */}
                  <div className="space-y-0.5">
                    {LAYER_MAP.map((l) => (
                      <button key={l.key} onClick={() => toggleLayer(l.key)}
                        className="flex items-center gap-1.5 w-full text-left px-1 py-0.5 rounded text-[9px] font-mono transition-colors hover:bg-white/5"
                        style={{ color: visibleLayers.has(l.key) ? l.color : "rgba(255,255,255,0.15)" }}>
                        {visibleLayers.has(l.key) ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        <span className="w-2 h-2 rounded-full" style={{ background: visibleLayers.has(l.key) ? l.color : "#333" }} />
                        <span>{l.emoji} {l.label}</span>
                      </button>
                    ))}
                  </div>
                  {/* Categories grid */}
                  <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 pt-1 border-t border-white/[0.04]">
                    {TACTICAL_CATEGORIES.map((c) => (
                      <div key={c.key} className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
                        <span className="text-[8px] font-mono" style={{ color: c.color + "88" }}>{c.emoji} {c.label}</span>
                      </div>
                    ))}
                  </div>
                  {/* Counters */}
                  <div className="space-y-0.5 pt-1 border-t border-white/[0.04]">
                    <div className="flex justify-between text-[8px] font-mono">
                      <span className="text-[#FF4444]/60">💥 Quakes 24h</span>
                      <span className="text-[#FF4444] font-bold">{earthquakes.length}</span>
                    </div>
                    <div className="flex justify-between text-[8px] font-mono">
                      <span className="text-[#FFDD00]/60">⚠️ NASA Events</span>
                      <span className="text-[#FFDD00] font-bold">{nasaEvents.length}</span>
                    </div>
                    <div className="flex justify-between text-[8px] font-mono">
                      <span className="text-[#00FF41]/60">🛸 UAP Reports</span>
                      <span className="text-[#00FF41] font-bold">{sightings.length}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* NAVIGATE */}
            <div className={glass}>
              <button onClick={() => toggleSection("nav")}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors">
                <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">🧭 Navigate</span>
                {consoleSections.nav ? <ChevronUp className="w-3 h-3 text-white/20" /> : <ChevronDown className="w-3 h-3 text-white/20" />}
              </button>
              {consoleSections.nav && (
                <div className="px-3 pb-2">
                  <div className="flex gap-1 flex-wrap">
                    {FLY_TO_REGIONS.map((r) => (
                      <button key={r.label} onClick={() => setFlyTo({ lat: r.lat, lon: r.lon, alt: r.alt })}
                        className="px-2 py-1 rounded text-sm hover:bg-white/10 transition-colors" title={r.label}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══════ BOTTOM BAR: Audio + Ozone indicator ═══════ */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
            <button onClick={() => setAudioEnabled(!audioEnabled)}
              className={`${glass} px-2 py-1 flex items-center gap-1 text-[9px] font-mono text-white/30 hover:text-white/60 transition-colors`}>
              {audioEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
            </button>
            <div className={`${glass} px-3 py-1 text-[9px] font-mono`}>
              <span className="text-white/25">Ozone Layer: </span>
              <span className="text-[#00FF41] font-bold">[ONLINE]</span>
            </div>
          </div>
        </div>

        <FeedPanel earthquakes={earthquakes} nasaEvents={nasaEvents} />
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1 border-t border-white/[0.04] text-[8px]"
        style={{ background: "rgba(0,0,0,0.9)" }}>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00FF41] animate-pulse" />
          <span className="text-white/25 font-mono">TACTICAL • ONLINE</span>
        </div>
        <div className="flex items-center gap-3 text-white/15 font-mono">
          <span>NOAA ✓</span>
          <span>USGS ✓</span>
          <span>NASA ✓</span>
          <span>OSINT</span>
        </div>
      </div>
    </div>
  );
}
