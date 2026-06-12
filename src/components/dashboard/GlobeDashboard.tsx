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
    <div className="flex flex-col flex-1 min-h-0 bg-black overflow-hidden">
      {/* Crypto Ticker */}
      <div className="flex items-center gap-4 px-3 py-1 border-b border-slate-700/25 text-[10px] overflow-x-auto bg-slate-950/80 backdrop-blur-xl no-scrollbar z-20 shrink-0">
        {cryptoPrices.map((c) => (
          <div key={c.id} className="flex items-center gap-1.5 shrink-0">
            <span className="font-mono font-bold text-amber-400">{c.symbol}</span>
            <span className="font-mono text-[#b4c5b0]">${c.price.toLocaleString()}</span>
            <span className={`font-mono text-[9px] ${c.change24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {c.change24h >= 0 ? "+" : ""}{c.change24h.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      {/* Live Ticker */}
      <div className="shrink-0">
        <LiveTicker spaceWeather={spaceWeather} earthquakes={earthquakes} nasaEvents={nasaEvents} />
      </div>

      {/* 3-Column HUD Layout — this row must fill remaining height */}
      <div className="flex flex-1 min-h-0 relative">
        {/* LEFT SIDEBAR — 265px fixed, above globe */}
        <div className="hidden lg:flex w-[265px] shrink-0 flex-col gap-2 p-2 overflow-y-auto no-scrollbar z-20">
          <TacticalConsole />
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
          <NavigatePanel onNavigate={handleNavigate} />
        </div>

        {/* CENTER COLUMN — Globe canvas fills this entirely */}
        <div className="flex-1 min-w-0 relative">
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

          {/* Tension badge — centered over globe only */}
          <GlobeOverlay
            selectedHotspot={selectedHotspot}
            onClose={() => setSelectedHotspot(null)}
            spaceWeather={spaceWeather}
            earthquakeCount={earthquakes.length}
            nasaEventCount={nasaEvents.length}
          />

          {/* Floating Markets Terminal Widget */}
          <div className="absolute bottom-4 right-4 z-20">
            <MarketsTerminalMini />
          </div>
        </div>

        {/* RIGHT SIDEBAR — 280px fixed, above globe */}
        <div className="hidden md:flex w-[280px] shrink-0 flex-col z-20">
          <ChatFeedPanel earthquakes={earthquakes} nasaEvents={nasaEvents} osintEvents={osintEvents} />
        </div>
      </div>

      {/* OSINT Ticker Bar */}
      <div className="shrink-0">
        <OsintTickerBar tickerItems={tickerItems} earthquakes={earthquakes} nasaEvents={nasaEvents} />
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-1 border-t border-slate-700/25 text-[8px] bg-slate-950/80 backdrop-blur-xl font-mono text-slate-600 z-30 shrink-0">
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
