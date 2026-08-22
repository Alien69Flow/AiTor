import { useState, useCallback, useRef } from "react";
import { LiveTicker } from "./LiveTicker";
import { GlobeOverlay } from "./GlobeOverlay";
import type { UnifiedHotspotData } from "../globe/GlobeScene";
import { HybridGlobe } from "../globe/HybridGlobe";
import { LegendPanel, type LayerKey } from "./LegendPanel";
import { NavigatePanel } from "./NavigatePanel";
import { ChatFeedPanel } from "./ChatFeedPanel";
import { PricingModal } from "./PricingModal";
import { GlobeDiagnostics } from "./GlobeDiagnostics";
import { useUnifiedIntel } from "@/hooks/useUnifiedIntel";
import { useUAPSightings } from "@/hooks/useUAPSightings";
import { useTier } from "@/hooks/useTier";
import { useAirTraffic } from "@/hooks/useAirTraffic";
import { useMarineTraffic } from "@/hooks/useMarineTraffic";
import { useInternetOutages } from "@/hooks/useInternetOutages";
import { CONFLICT_ZONES } from "@/lib/geo-datasets";
import {
  DEFAULT_ACTIVE_LAYERS,
  TIER_LABEL,
  layerDef,
  type EnvLayerKey,
} from "@/lib/globe-layers";
import { Cpu, Wifi, CircleCheck as CheckCircle2, Compass, Layers, Wrench } from "lucide-react";
import { LedIndicator } from "./GlassPanels";

type MobilePanel = "legend" | "navigate" | "diagnostics" | null;

export function GlobeDashboard() {
  const [selectedHotspot, setSelectedHotspot] = useState<UnifiedHotspotData | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [paywallReason, setPaywallReason] = useState<string | null>(null);
  const {
    earthquakes,
    nasaEvents,
    cryptoPrices,
    spaceWeather,
    counts,
    eventMarkers,
    events: osintEvents,
  } = useUnifiedIntel();
  const { sightings } = useUAPSightings();
  const { tier, hasAccess } = useTier();
  
  // Air & Marine Traffic hooks
  const { flights, isLoading: airLoading, count: flightCount } = useAirTraffic();
  const { ships, isLoading: marineLoading, count: shipCount } = useMarineTraffic();
  const { outages } = useInternetOutages(true);

  const [visibleLayers, setVisibleLayers] = useState<Set<LayerKey>>(
    new Set(["finance", "intel", "conflict", "geopolitical", "logistics", "cryptozoo", "convergence"])
  );
  const [envLayers, setEnvLayers] = useState<Set<EnvLayerKey>>(
    new Set(DEFAULT_ACTIVE_LAYERS)
  );
  const globeNavRef = useRef<((lat: number, lng: number, alt: number) => void) | null>(null);

  const toggleLayer = useCallback((key: LayerKey) => {
    setVisibleLayers(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const toggleEnvLayer = useCallback((key: EnvLayerKey) => {
    const def = layerDef(key);
    if (def && !hasAccess(def.requiredTier)) {
      setPaywallReason(`La capa "${def.label}" requiere el plan ${TIER_LABEL[def.requiredTier]}.`);
      return;
    }
    setEnvLayers(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, [hasAccess]);

  const handleNavigate = useCallback((lat: number, lng: number, altitude: number) => {
    globeNavRef.current?.(lat, lng, altitude);
    setMobilePanel(null);
  }, []);

  const handleGlobeReady = useCallback((navFn: (lat: number, lng: number, altitude: number) => void) => {
    globeNavRef.current = navFn;
  }, []);

  const toggleMobilePanel = useCallback((panel: Exclude<MobilePanel, null>) => {
    setMobilePanel(prev => (prev === panel ? null : panel));
  }, []);

  const legend = (onClose?: () => void) => (
    <LegendPanel
      visibleLayers={visibleLayers}
      onToggleLayer={toggleLayer}
      counts={counts}
      envLayers={envLayers}
      onToggleEnvLayer={toggleEnvLayer}
      tier={tier}
      hasAccess={hasAccess}
      onClose={onClose}
      defaultCollapsed
    />
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 relative bg-black overflow-hidden">
      <h2 className="sr-only">Globo táctico en tiempo real: capas meteorológicas, OSINT y mercados</h2>
      {/* Primary crypto / market ticker */}
      <div className="flex items-center gap-3 md:gap-5 px-2 md:px-4 py-1.5 md:py-2 border-b border-slate-700/30 overflow-x-auto backdrop-blur-2xl bg-slate-950/70 no-scrollbar z-20">
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          <Cpu className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-400" />
          <span className="text-[8px] md:text-[9px] uppercase tracking-wider text-slate-500 font-medium hidden md:inline">
            Live Markets
          </span>
        </div>
        {cryptoPrices.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-1.5 md:gap-2 shrink-0 px-1.5 md:px-2 py-0.5 md:py-1 rounded-lg bg-slate-800/30 border border-slate-700/20"
          >
            <span className="font-mono font-bold text-amber-400 text-[10px] md:text-[11px]">{c.symbol}</span>
            <span className="font-mono text-slate-300 text-[9px] md:text-[10px]">${c.price.toLocaleString()}</span>
            <span className={`font-mono text-[8px] md:text-[9px] ${c.change24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {c.change24h >= 0 ? "+" : ""}{c.change24h.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      {/* Single OSINT event ticker (red LIVE indicator) */}
      <LiveTicker spaceWeather={spaceWeather} earthquakes={earthquakes} nasaEvents={nasaEvents} />

      {/* Main content area */}
      <div className="flex flex-1 min-h-0 relative">
        <div className="absolute inset-0 z-0 pointer-events-auto">
          <HybridGlobe
            layers={envLayers}
            visibleLayers={visibleLayers}
            onHotspotClick={setSelectedHotspot}
            onReady={handleGlobeReady}
            externalMarkers={eventMarkers}
            kpIndex={spaceWeather?.kpIndex ?? 0}
            earthquakes={earthquakes}
            nasaEvents={nasaEvents}
            sightings={sightings}
            flights={flights}
            ships={ships}
          />
        </div>

        <GlobeOverlay
          selectedHotspot={selectedHotspot}
          onClose={() => setSelectedHotspot(null)}
          spaceWeather={spaceWeather}
          earthquakeCount={earthquakes.length}
          nasaEventCount={nasaEvents.length}
          conflictCount={CONFLICT_ZONES.length}
          wildfireCount={nasaEvents.filter((e) => e.category.toLowerCase().includes("fire")).length}
          outageCount={outages.length}
          criticalIntelCount={osintEvents.filter((e) => e.severity === "CRITICAL").length}
        />

        {/* ============ MOBILE: corner buttons + bottom sheet ============ */}
        <div className="md:hidden">
          <div className="absolute top-2 left-2 z-30 flex flex-col gap-1.5 pointer-events-auto">
            {([
              { id: "legend" as const, Icon: Layers, label: "Legend and layers" },
              { id: "navigate" as const, Icon: Compass, label: "Navigate" },
              { id: "diagnostics" as const, Icon: Wrench, label: "Diagnostics" },
            ]).map(({ id, Icon, label }) => (
              <button
                key={id}
                onClick={() => toggleMobilePanel(id)}
                className={`flex items-center justify-center w-9 h-9 rounded-xl backdrop-blur-2xl border transition-all ${
                  mobilePanel === id
                    ? "bg-slate-800/70 border-cyan-400/50 shadow-[0_0_16px_rgba(34,211,238,0.3)]"
                    : "bg-slate-950/80 border-slate-700/40"
                }`}
                aria-label={label}
              >
                <Icon className="w-4 h-4 text-cyan-400" />
              </button>
            ))}
          </div>

          {mobilePanel && (
            <>
              <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setMobilePanel(null)} />
              <div className="fixed left-0 right-0 bottom-14 z-50 max-h-[72vh] overflow-y-auto legend-scroll rounded-t-2xl border-t border-slate-700/40 bg-slate-950/95 backdrop-blur-2xl p-3 pointer-events-auto animate-in slide-in-from-bottom duration-200">
                <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-600/60" />
                {mobilePanel === "legend" && legend(() => setMobilePanel(null))}
                {mobilePanel === "navigate" && (
                  <NavigatePanel onNavigate={handleNavigate} forceOpen onClose={() => setMobilePanel(null)} />
                )}
                {mobilePanel === "diagnostics" && (
                  <GlobeDiagnostics />
                )}
              </div>
            </>
          )}
        </div>

        {/* ============ DESKTOP: fixed left panels ============ */}
        <div className="hidden md:block absolute top-3 left-3 z-30 space-y-2.5 pointer-events-none">
          <div className="pointer-events-auto">{legend()}</div>
          <div className="pointer-events-auto"><NavigatePanel onNavigate={handleNavigate} /></div>
          <button
            onClick={() => setMobilePanel(mobilePanel === "diagnostics" ? null : "diagnostics")}
            className={`pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-xl backdrop-blur-2xl border transition-all text-xs ${
              mobilePanel === "diagnostics"
                ? "bg-slate-800/70 border-cyan-400/50"
                : "bg-slate-950/80 border-slate-700/40 hover:border-slate-600"
            }`}
          >
            <Wrench className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-300">Diagnostics</span>
          </button>
          {mobilePanel === "diagnostics" && (
            <div className="pointer-events-auto"><GlobeDiagnostics /></div>
          )}
        </div>

        {/* RIGHT PANEL: Chat Feed (desktop only) */}
        <div className="absolute right-0 top-0 h-full z-20 pointer-events-none hidden md:block">
          <div className="pointer-events-auto h-full">
            <ChatFeedPanel earthquakes={earthquakes} nasaEvents={nasaEvents} osintEvents={osintEvents} cryptoPrices={cryptoPrices} />
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-2 md:px-5 py-1.5 md:py-2 border-t border-slate-700/30 bg-slate-950/70 backdrop-blur-2xl z-30">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-1.5 md:gap-2">
            <Wifi className="w-3 md:w-3.5 h-3 md:h-3.5 text-slate-500" />
            <span className="text-[8px] md:text-[9px] text-slate-400 uppercase tracking-wider font-medium hidden md:inline">
              Aerospace OSINT Interface
            </span>
          </div>
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-slate-800/40 border border-slate-700/20">
            <Layers className="w-3 h-3 text-cyan-400" />
            <span className="text-[9px] font-mono font-bold text-cyan-400">{envLayers.size}</span>
          </div>
          <div className="text-[8px] text-slate-600 font-mono">v2.1.0</div>
        </div>
        <div className="flex items-center gap-1.5 md:gap-4">
          {["NASA", "USGS", "NOAA"].map((src) => (
            <div key={src} className="flex items-center gap-1 md:gap-2 px-1.5 md:px-2 py-0.5 md:py-1 rounded-lg bg-slate-800/40 border border-slate-700/20">
              <LedIndicator color="#34d399" active size="xs" />
              <span className="text-[8px] md:text-[9px] text-slate-400 font-mono">{src}</span>
              <CheckCircle2 className="w-2.5 h-2.5 md:w-3 md:h-3 text-emerald-400" />
            </div>
          ))}
        </div>
      </div>

      <PricingModal
        open={!!paywallReason}
        onClose={() => setPaywallReason(null)}
        reason={paywallReason ?? undefined}
        currentTier={tier}
      />
    </div>
  );
}
