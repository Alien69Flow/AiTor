import { useState, useCallback, useRef } from "react";
import { LiveTicker } from "./LiveTicker";
import { GlobeOverlay } from "./GlobeOverlay";
import { GlobeScene, UnifiedHotspotData } from "../globe/GlobeScene";
import { TacticalConsole } from "./TacticalConsole";
import { LegendPanel, type LayerKey } from "./LegendPanel";
import { NavigatePanel } from "./NavigatePanel";
import { MarketsTerminalMini } from "./MarketsTerminalMini";
import { ChatFeedPanel } from "./ChatFeedPanel";
import { OsintTickerBar } from "./OsintTickerBar";
import { useRealTimeData } from "@/hooks/useRealTimeData";
import { Volume2 } from "lucide-react";

export function GlobeDashboard() {
  const [selectedHotspot, setSelectedHotspot] = useState<UnifiedHotspotData | null>(null);
  const { earthquakes, nasaEvents, cryptoPrices, spaceWeather, counts } = useRealTimeData();
  const [visibleLayers, setVisibleLayers] = useState<Set<LayerKey>>(
    new Set(["finance", "intel", "conflict", "geopolitical", "logistics", "cryptozoo", "convergence"])
  );
  const globeNavRef = useRef<((lat: number, lng: number, alt: number) => void) | null>(null);

  const toggleLayer = useCallback((key: LayerKey) => {
    setVisibleLayers(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const handleNavigate = useCallback((lat: number, lng: number, altitude: number) => {
    globeNavRef.current?.(lat, lng, altitude);
  }, []);

  const handleGlobeReady = useCallback((navFn: (lat: number, lng: number, altitude: number) => void) => {
    globeNavRef.current = navFn;
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0 relative bg-black overflow-hidden">
      {/* Crypto Ticker Superior */}
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

      {/* Live Ticker */}
      <LiveTicker spaceWeather={spaceWeather} earthquakes={earthquakes} nasaEvents={nasaEvents} />

      {/* Main content area */}
      <div className="flex flex-1 min-h-0 relative">
        {/* GLOBE 3D — full background, pointer-events enabled */}
        <div className="absolute inset-0 z-0 pointer-events-auto">
          <GlobeScene
            onHotspotClick={setSelectedHotspot}
            onReady={handleGlobeReady}
          />
        </div>

        {/* OVERLAY: Tension badge + hotspot popup */}
        <GlobeOverlay
          selectedHotspot={selectedHotspot}
          onClose={() => setSelectedHotspot(null)}
          spaceWeather={spaceWeather}
          earthquakeCount={earthquakes.length}
          nasaEventCount={nasaEvents.length}
        />

        {/* LEFT PANELS — pointer-events-none wrapper, auto on each panel */}
        <div className="absolute top-3 left-3 z-30 space-y-2 pointer-events-none">
          <div className="pointer-events-auto">
            <TacticalConsole />
          </div>
          <div className="pointer-events-auto">
            <LegendPanel visibleLayers={visibleLayers} onToggleLayer={toggleLayer} counts={counts} />
          </div>
          <div className="pointer-events-auto">
            <NavigatePanel onNavigate={handleNavigate} />
          </div>
        </div>

        {/* CENTER BOTTOM: Nav menu + Audio */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-[20px] border border-white/[0.06] rounded-lg px-4 py-2 flex items-center gap-4">
            <Volume2 className="w-3.5 h-3.5 text-white/25 cursor-pointer hover:text-white/50" />
            {["Markets", "Feed", "Alerts", "Movers", "Global Tension"].map(item => (
              <span key={item} className="text-[9px] font-mono text-white/30 hover:text-white/60 cursor-pointer whitespace-nowrap">
                {item === "Markets" ? "🏦" : item === "Feed" ? "📰" : item === "Alerts" ? "🔔" : item === "Movers" ? "📈" : "🌐"} {item}
              </span>
            ))}
            <div className="flex items-center gap-1 ml-2 border-l border-white/[0.06] pl-3">
              <span className="text-[9px] font-mono text-white/30">⚡ Capa Tesla</span>
              <span className="text-[10px] font-mono font-bold text-[#FF00FF]">Kp: {spaceWeather.kpIndex.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Chat Feed — narrower, only panel area blocks events */}
        <div className="absolute right-0 top-0 h-full z-20 pointer-events-none hidden md:block">
          <div className="pointer-events-auto h-full">
            <ChatFeedPanel earthquakes={earthquakes} nasaEvents={nasaEvents} />
          </div>
        </div>
      </div>

      {/* OSINT Ticker Bar */}
      <OsintTickerBar earthquakes={earthquakes} nasaEvents={nasaEvents} />

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-1 border-t border-white/[0.04] text-[8px] bg-black/90 font-mono text-white/20 z-30">
        <div>TACTICAL · OSINT INTERFACE V2.0</div>
        <div className="flex gap-3"><span>NASA ✓</span><span>USGS ✓</span><span>NOAA ✓</span></div>
      </div>
    </div>
  );
}
