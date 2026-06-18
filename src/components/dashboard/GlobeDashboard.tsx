import { useState, useCallback, useRef } from "react";
import { LiveTicker } from "./LiveTicker";
import { GlobeOverlay } from "./GlobeOverlay";
import { GlobeScene, UnifiedHotspotData } from "../globe/GlobeScene";
import { TacticalConsole } from "./TacticalConsole";
import { LegendPanel, type LayerKey } from "./LegendPanel";
import { NavigatePanel } from "./NavigatePanel";
import { ChatFeedPanel } from "./ChatFeedPanel";
import { OsintTickerBar } from "./OsintTickerBar";
import { useUnifiedIntel } from "@/hooks/useUnifiedIntel";
import { Volume2, TrendingUp, Radio, Bell, Activity, Globe, Layers, Cpu, Wifi, CircleCheck as CheckCircle2 } from "lucide-react";
import { NavPill, LedIndicator, StatusBadge } from "./GlassPanels";

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
      {/* Crypto Ticker - Premium Header */}
      <div className="flex items-center gap-5 px-4 py-2 border-b border-slate-700/30 overflow-x-auto backdrop-blur-2xl bg-slate-950/70 no-scrollbar z-20">
        <div className="flex items-center gap-2 shrink-0">
          <Cpu className="w-4 h-4 text-amber-400" />
          <span className="text-[9px] uppercase tracking-wider text-slate-500 font-medium">
            Live Markets
          </span>
        </div>
        {cryptoPrices.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-2 shrink-0 px-2 py-1 rounded-lg bg-slate-800/30 border border-slate-700/20"
          >
            <span className="font-mono font-bold text-amber-400 text-[11px]">
              {c.symbol}
            </span>
            <span className="font-mono text-slate-300 text-[10px]">
              ${c.price.toLocaleString()}
            </span>
            <span
              className={`font-mono text-[9px] ${c.change24h >= 0 ? "text-emerald-400" : "text-red-400"}`}
            >
              {c.change24h >= 0 ? "+" : ""}
              {c.change24h.toFixed(1)}%
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

        {/* CENTER BOTTOM: Premium Nav Dock */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl backdrop-blur-2xl border border-slate-700/40 bg-slate-900/60 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <Volume2 className="w-4 h-4 text-slate-500 cursor-pointer hover:text-slate-300 transition-colors" />
            <div className="w-px h-5 bg-slate-700/40 mx-1" />
            <NavPill icon={TrendingUp} label="Markets" />
            <NavPill icon={Radio} label="Feed" active />
            <NavPill icon={Bell} label="Alerts" />
            <NavPill icon={Activity} label="Movers" />
            <NavPill icon={Globe} label="Tension" highlight={spaceWeather.kpIndex > 4 ? "#c084fc" : undefined} />
            <div className="w-px h-5 bg-slate-700/40 mx-1" />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/40 border border-slate-700/30">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[9px] text-slate-400 uppercase tracking-wider">Layers</span>
              <span className="text-xs font-mono font-bold text-cyan-400">
                {[
                  cloudsEnabled,
                  weatherEnabled,
                  firesEnabled,
                  aircraftEnabled,
                  marketsEnabled,
                ].filter(Boolean).length}
              </span>
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

      {/* Status Bar - Premium Footer */}
      <div className="flex items-center justify-between px-5 py-2 border-t border-slate-700/30 bg-slate-950/70 backdrop-blur-2xl z-30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Wifi className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[9px] text-slate-400 uppercase tracking-wider font-medium">
              Aerospace OSINT Interface
            </span>
          </div>
          <div className="text-[8px] text-slate-600 font-mono">v2.0.1</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-800/40 border border-slate-700/20">
            <LedIndicator color="#34d399" active size="xs" />
            <span className="text-[9px] text-slate-400 font-mono">NASA</span>
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-800/40 border border-slate-700/20">
            <LedIndicator color="#34d399" active size="xs" />
            <span className="text-[9px] text-slate-400 font-mono">USGS</span>
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-800/40 border border-slate-700/20">
            <LedIndicator color="#34d399" active size="xs" />
            <span className="text-[9px] text-slate-400 font-mono">NOAA</span>
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
