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
import { Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";

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

const glassStyle = {
  background: "rgba(0,0,0,0.45)",
  backdropFilter: "blur(20px)",
  border: "0.5px solid rgba(255,255,255,0.06)",
};

export function GlobeDashboard() {
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotData | null>(null);
  const { sightings } = useUAPSightings();
  const spaceWeather = useSpaceWeather();
  const { earthquakes } = useEarthquakes();
  const { events: nasaEvents } = useNasaEvents();
  const { prices: cryptoPrices } = useCryptoPrices();
  const [visibleLayers, setVisibleLayers] = useState<Set<LayerKey>>(new Set(["markets", "uap", "cryptozoo"]));
  const [flyTo, setFlyTo] = useState<{ lat: number; lon: number; alt: number } | null>(null);
  const [legendCollapsed, setLegendCollapsed] = useState(false);

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

  return (
    <div className="flex flex-col flex-1 min-h-0 relative" style={{ background: "#000000" }}>
      {/* Crypto ticker bar */}
      <div className="flex items-center gap-3 px-3 py-1 border-b text-[9px] overflow-x-auto"
        style={{ background: "rgba(0,0,0,0.85)", borderColor: "rgba(255,255,255,0.04)" }}
      >
        {cryptoPrices.map((c) => (
          <div key={c.id} className="flex items-center gap-1.5 shrink-0">
            <span className="font-mono font-bold text-[#FFD700]">{c.symbol}</span>
            <span className="font-mono text-white/70">${c.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            <span className={`font-mono text-[8px] ${c.change24h >= 0 ? "text-[#00FF41]" : "text-[#FF4444]"}`}>
              {c.change24h >= 0 ? "+" : ""}{c.change24h.toFixed(1)}%
            </span>
            <a href="#" className="text-[7px] text-white/15 hover:text-white/40 transition-colors font-mono uppercase">Trade</a>
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

          {/* Tactical Console */}
          <div className="absolute bottom-3 left-3 z-10 w-[160px]">
            <div className="rounded-lg overflow-hidden" style={glassStyle}>
              <button
                onClick={() => setLegendCollapsed(!legendCollapsed)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-white/5 transition-colors"
              >
                <span className="text-[8px] font-mono uppercase tracking-wider text-white/35">⚡ Console</span>
                {legendCollapsed ? <ChevronUp className="w-2.5 h-2.5 text-white/20" /> : <ChevronDown className="w-2.5 h-2.5 text-white/20" />}
              </button>

              {!legendCollapsed && (
                <>
                  {/* Navigate */}
                  <div className="px-2.5 py-1.5 border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                    <div className="text-[7px] font-mono uppercase tracking-wider text-white/25 mb-1">🧭 Navigate</div>
                    <div className="flex gap-0.5 flex-wrap">
                      {FLY_TO_REGIONS.map((r) => (
                        <button key={r.label} onClick={() => setFlyTo({ lat: r.lat, lon: r.lon, alt: r.alt })}
                          className="px-1 py-0.5 rounded text-[10px] hover:bg-white/10 transition-colors" title={r.label}>
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Layers */}
                  <div className="px-2.5 py-1.5 border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                    {LAYER_MAP.map((l) => (
                      <button key={l.key} onClick={() => toggleLayer(l.key)}
                        className="flex items-center gap-1 w-full text-left px-1 py-0.5 rounded text-[8px] font-mono transition-colors hover:bg-white/5"
                        style={{ color: visibleLayers.has(l.key) ? l.color : "rgba(255,255,255,0.15)" }}>
                        {visibleLayers.has(l.key) ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: visibleLayers.has(l.key) ? l.color : "#333" }} />
                        <span>{l.emoji} {l.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Real-time counters */}
                  <div className="px-2.5 py-1.5 border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between text-[7px] font-mono">
                        <span className="text-[#FF4444]/60">💥 Quakes 24h</span>
                        <span className="text-[#FF4444] font-bold">{earthquakes.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-[7px] font-mono">
                        <span className="text-[#FFDD00]/60">⚠️ NASA Events</span>
                        <span className="text-[#FFDD00] font-bold">{nasaEvents.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-[7px] font-mono">
                        <span className="text-[#00FF41]/60">🛸 UAP Reports</span>
                        <span className="text-[#00FF41] font-bold">{sightings.length}</span>
                      </div>
                    </div>
                  </div>

                  {/* Categories */}
                  <div className="px-2.5 py-1.5 border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                    <div className="grid grid-cols-2 gap-x-1 gap-y-0">
                      {TACTICAL_CATEGORIES.map((c) => (
                        <div key={c.key} className="flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full" style={{ background: c.color }} />
                          <span className="text-[7px] font-mono" style={{ color: c.color + "66" }}>{c.emoji} {c.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* NOAA / Kp */}
                  <div className="px-2.5 py-1 border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[7px] font-mono text-white/20">
                        Kp: <span style={{ color: spaceWeather.kpIndex > 4 ? "#FF00FF" : "#00FF41" }}>{spaceWeather.kpIndex.toFixed(1)}</span>
                      </span>
                      <span className="text-[7px] font-mono text-white/15">{sightings.length} reports</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <FeedPanel earthquakes={earthquakes} nasaEvents={nasaEvents} />
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1 border-t text-[8px]"
        style={{ background: "rgba(0,0,0,0.85)", borderColor: "rgba(255,255,255,0.04)" }}>
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
