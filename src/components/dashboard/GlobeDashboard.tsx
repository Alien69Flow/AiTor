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
import { useUnifiedIntel } from "@/hooks/useUnifiedIntel";
import { Volume2 } from "lucide-react";

export function GlobeDashboard() {
  const [selectedHotspot, setSelectedHotspot] = useState<UnifiedHotspotData | null>(null);
  const {
    earthquakes,
    nasaEvents,
    cryptoPrices,
    spaceWeather,
    counts,
    eventMarkers,
    tickerItems,
    events: osintEvents,
  } = useUnifiedIntel();
  const [visibleLayers, setVisibleLayers] = useState<Set<LayerKey>>(
    new Set(["finance", "intel", "conflict", "geopolitical", "logistics", "cryptozoo", "convergence"])
  );
  const [cloudsEnabled, setCloudsEnabled] = useState(true);
  const [weatherEnabled, setWeatherEnabled] = useState(true);
  const [firesEnabled, setFiresEnabled] = useState(true);
  const [aircraftEnabled, setAircraftEnabled] = useState(true);
  const [marketsEnabled, setMarketsEnabled] = useState(true);
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
      {/* Crypto Ticker */}
      <div className="flex items-center gap-4 px-3 py-1 border-b border-slate-700/25 text-[10px] overflow-x-auto bg-slate-950/80 backdrop-blur-xl no-scrollbar z-20">
        {cryptoPrices.map((c) => (
          <div key={c.id} className="flex items-center gap-1.5 shrink-0">
            <span className="font-mono font-bold text-amber-400">{c.symbol}</span>
            <span className="font-mono text-slate-400">${c.price.toLocaleString()}</span>
            <span className={`font-mono text-[9px] ${c.change24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {c.change24h >= 0 ? "+" : ""}{c.change24h.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      {/* Live Ticker */}
      <LiveTicker spaceWeather={spaceWeather} earthquakes={earthquakes} nasaEvents={nasaEvents} />

      {/* Main content area */}
      <div className="flex flex-1 min-h-0 relative">
        {/* GLOBE 3D */}
        <div className="absolute inset-0 z-0 pointer-events-auto">
          <GlobeScene
            onHotspotClick={setSelectedHotspot}
            onReady={handleGlobeReady}
            externalMarkers={eventMarkers}
            cloudsEnabled={cloudsEnabled}
            weatherEnabled={weatherEnabled}
            firesEnabled={firesEnabled}
            aircraftEnabled={aircraftEnabled}
            marketsEnabled={marketsEnabled}
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

        {/* LEFT PANELS */}
        <div className="absolute top-3 left-3 z-30 space-y-2.5 pointer-events-none">
          <div className="pointer-events-auto">
            <TacticalConsole />
          </div>
          <div className="pointer-events-auto">
            <LegendPanel
              visibleLayers={visibleLayers}
              onToggleLayer={toggleLayer}
              counts={counts}
              cloudsEnabled={cloudsEnabled}
              onToggleClouds={() => setCloudsEnabled(v => !v)}
              weatherEnabled={weatherEnabled}
              onToggleWeather={() => setWeatherEnabled(v => !v)}
              firesEnabled={firesEnabled}
              onToggleFires={() => setFiresEnabled(v => !v)}
              aircraftEnabled={aircraftEnabled}
              onToggleAircraft={() => setAircraftEnabled(v => !v)}
              marketsEnabled={marketsEnabled}
              onToggleMarkets={() => setMarketsEnabled(v => !v)}
            />
          </div>
          <div className="pointer-events-auto">
            <NavigatePanel onNavigate={handleNavigate} />
          </div>
        </div>

        {/* CENTER BOTTOM: Nav menu + Audio */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/40 rounded-2xl px-4 py-2 flex items-center gap-4">
            <Volume2 className="w-3.5 h-3.5 text-slate-500 cursor-pointer hover:text-slate-300" />
            {["Markets", "Feed", "Alerts", "Movers", "Global Tension"].map(item => (
              <span key={item} className="text-[9px] font-mono text-slate-500 hover:text-slate-300 cursor-pointer whitespace-nowrap transition-colors">
                {item === "Markets" ? "🏦" : item === "Feed" ? "📰" : item === "Alerts" ? "🔔" : item === "Movers" ? "📈" : "🌐"} {item}
              </span>
            ))}
            <div className="flex items-center gap-1.5 ml-2 border-l border-slate-700/30 pl-3">
              <span className="text-[9px] font-mono text-slate-500">Tesla Layer</span>
              <span className="text-[10px] font-mono font-bold text-purple-400">Kp: {spaceWeather.kpIndex.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Chat Feed */}
        <div className="absolute right-0 top-0 h-full z-20 pointer-events-none hidden md:block">
          <div className="pointer-events-auto h-full">
            <ChatFeedPanel earthquakes={earthquakes} nasaEvents={nasaEvents} osintEvents={osintEvents} />
          </div>
        </div>
      </div>

      {/* OSINT Ticker Bar */}
      <OsintTickerBar tickerItems={tickerItems} earthquakes={earthquakes} nasaEvents={nasaEvents} />

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-1 border-t border-slate-700/25 text-[8px] bg-slate-950/80 backdrop-blur-xl font-mono text-slate-600 z-30">
        <div className="text-slate-500">AEROSPACE · OSINT INTERFACE V2.0</div>
        <div className="flex gap-3">
          <span className="text-emerald-400">NASA ✓</span>
          <span className="text-emerald-400">USGS ✓</span>
          <span className="text-emerald-400">NOAA ✓</span>
        </div>
      </div>
    </div>
  );
}
