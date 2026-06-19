import { useState, useCallback, useRef } from "react";
import { LiveTicker } from "./LiveTicker";
import { GlobeOverlay } from "./GlobeOverlay";
import { GlobeScene, UnifiedHotspotData } from "../globe/GlobeScene";
import { TacticalConsole } from "./TacticalConsole";
import { LegendPanel, type LayerKey } from "./LegendPanel";
import { NavigatePanel } from "./NavigatePanel";
import { ChatFeedPanel } from "./ChatFeedPanel";
import { useUnifiedIntel } from "@/hooks/useUnifiedIntel";
import {
  Crosshair,
  Layers,
  Compass,
  Radio,
  CircleCheck as CheckCircle2,
  Wifi,
} from "lucide-react";
import { LedIndicator } from "./GlassPanels";
import { GlobePanelRail, type RailItem } from "./GlobePanelRail";
import { MobileGlobeBar, type MobileBarItem } from "./MobileGlobeBar";

export function GlobeDashboard() {
  const [selectedHotspot, setSelectedHotspot] = useState<UnifiedHotspotData | null>(null);
  const {
    earthquakes,
    nasaEvents,
    spaceWeather,
    counts,
    eventMarkers,
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

  // Panel content shared between desktop rail and mobile sheet
  const tacticalPanel = <TacticalConsole />;
  const legendPanel = (
    <LegendPanel
      visibleLayers={visibleLayers}
      onToggleLayer={toggleLayer}
      counts={counts}
      cloudsEnabled={cloudsEnabled}
      onToggleClouds={() => setCloudsEnabled((v) => !v)}
      weatherEnabled={weatherEnabled}
      onToggleWeather={() => setWeatherEnabled((v) => !v)}
      firesEnabled={firesEnabled}
      onToggleFires={() => setFiresEnabled((v) => !v)}
      aircraftEnabled={aircraftEnabled}
      onToggleAircraft={() => setAircraftEnabled((v) => !v)}
      marketsEnabled={marketsEnabled}
      onToggleMarkets={() => setMarketsEnabled((v) => !v)}
    />
  );
  const navigatePanel = <NavigatePanel onNavigate={handleNavigate} />;
  const feedPanel = (
    <ChatFeedPanel
      earthquakes={earthquakes}
      nasaEvents={nasaEvents}
      osintEvents={osintEvents}
    />
  );

  const leftRailItems: RailItem[] = [
    { id: "tactical", icon: Crosshair, label: "Tactical", content: tacticalPanel },
    { id: "legend", icon: Layers, label: "Legend", content: legendPanel },
    { id: "navigate", icon: Compass, label: "Navigate", content: navigatePanel },
  ];
  const rightRailItems: RailItem[] = [
    { id: "feed", icon: Radio, label: "Feed", content: feedPanel },
  ];
  const mobileItems: MobileBarItem[] = [
    { id: "tactical", icon: Crosshair, label: "Tactical", content: tacticalPanel },
    { id: "legend", icon: Layers, label: "Legend", content: legendPanel },
    { id: "navigate", icon: Compass, label: "Navigate", content: navigatePanel },
    { id: "feed", icon: Radio, label: "Feed", content: feedPanel },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0 relative bg-black overflow-hidden">
      {/* Single slim ticker — replaces the stacked crypto + live + OSINT bars */}
      <LiveTicker
        spaceWeather={spaceWeather}
        earthquakes={earthquakes}
        nasaEvents={nasaEvents}
      />

      {/* Stage — globe gets the full remaining canvas; rails float on top */}
      <div className="flex flex-1 min-h-0 relative">
        {/* GLOBE 3D — always centered, never resized by panels */}
        <div className="absolute inset-0 z-0">
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

        {/* Hotspot popup overlay */}
        <GlobeOverlay
          selectedHotspot={selectedHotspot}
          onClose={() => setSelectedHotspot(null)}
          spaceWeather={spaceWeather}
          earthquakeCount={earthquakes.length}
          nasaEventCount={nasaEvents.length}
        />

        {/* Desktop rails (md+) */}
        <div className="hidden md:block">
          <GlobePanelRail items={leftRailItems} side="left" panelWidth={300} />
          <GlobePanelRail items={rightRailItems} side="right" panelWidth={300} />
        </div>

        {/* Mobile bottom bar (<md) */}
        <MobileGlobeBar items={mobileItems} />

        {/* Desktop status dock (compact, integrated) */}
        <div className="hidden md:flex absolute bottom-3 left-1/2 -translate-x-1/2 z-30 items-center gap-3 px-4 py-2 rounded-2xl bg-slate-950/70 backdrop-blur-2xl border border-slate-700/40 shadow-[0_8px_32px_rgba(0,0,0,0.45)]">
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[9px] text-slate-400 uppercase tracking-wider font-medium">
              Aerospace OSINT
            </span>
          </div>
          <span className="w-px h-4 bg-slate-700/40" />
          {(["NASA", "USGS", "NOAA"] as const).map((label) => (
            <div key={label} className="flex items-center gap-1.5">
              <LedIndicator color="#34d399" active size="xs" />
              <span className="text-[9px] text-slate-400 font-mono">{label}</span>
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
