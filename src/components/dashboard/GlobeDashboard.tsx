import { useState, useCallback, useRef } from "react";
import { LiveTicker } from "./LiveTicker";
import { MarketTicker } from "./MarketTicker";
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
import { DEFAULT_ACTIVE_LAYERS, TIER_LABEL, layerDef, type EnvLayerKey } from "@/lib/globe-layers";
import { Wifi, CircleCheck as CheckCircle2, Compass, Layers, Wrench, Radar, Database, PanelRightClose } from "lucide-react";
import { LedIndicator } from "./GlassPanels";
import { Button } from "@/components/ui/button";

type MobilePanel = "legend" | "navigate" | "diagnostics" | null;

export function GlobeDashboard() {
  const [selectedHotspot, setSelectedHotspot] = useState<UnifiedHotspotData | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [feedOpen, setFeedOpen] = useState(true);
  const [paywallReason, setPaywallReason] = useState<string | null>(null);
  const [visibleLayers, setVisibleLayers] = useState<Set<LayerKey>>(new Set(["finance", "intel", "conflict", "geopolitical", "logistics", "cryptozoo", "convergence"]));
  const [envLayers, setEnvLayers] = useState<Set<EnvLayerKey>>(new Set(DEFAULT_ACTIVE_LAYERS));

  const intel = useUnifiedIntel(envLayers);
  const { sightings } = useUAPSightings();
  const { tier, hasAccess } = useTier();
  const { flights } = useAirTraffic();
  const { ships } = useMarineTraffic();
  const { outages } = useInternetOutages(true);
  const allFlights = intel.aviation.length > flights.length ? intel.aviation : flights;
  const globeNavRef = useRef<((lat: number, lng: number, alt: number) => void) | null>(null);

  const toggleLayer = useCallback((key: LayerKey) => setVisibleLayers((previous) => {
    const next = new Set(previous);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  }), []);

  const toggleEnvLayer = useCallback((key: EnvLayerKey) => {
    const definition = layerDef(key);
    if (definition && !hasAccess(definition.requiredTier)) {
      setPaywallReason(`La capa "${definition.label}" requiere el plan ${TIER_LABEL[definition.requiredTier]}.`);
      return;
    }
    setEnvLayers((previous) => {
      const next = new Set(previous);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, [hasAccess]);

  const handleNavigate = useCallback((lat: number, lng: number, altitude: number) => {
    globeNavRef.current?.(lat, lng, altitude);
    setMobilePanel(null);
  }, []);

  const legend = (onClose?: () => void, collapsed = true) => (
    <LegendPanel visibleLayers={visibleLayers} onToggleLayer={toggleLayer} counts={intel.counts}
      envLayers={envLayers} onToggleEnvLayer={toggleEnvLayer} tier={tier} hasAccess={hasAccess}
      onClose={onClose} defaultCollapsed={collapsed} layerStatus={intel.layerStatus} />
  );

  const activeSignals = intel.earthquakes.length + intel.nasaEvents.length + allFlights.length + ships.length + intel.gdeltEvents.length;

  return (
    <section className="flex flex-1 min-h-0 flex-col overflow-hidden bg-background font-mono" aria-label="Global strategic command">
      <h2 className="sr-only">Globo táctico en tiempo real: capas meteorológicas, OSINT y mercados</h2>

      <header className="z-30 flex h-12 shrink-0 items-center justify-between border-b border-primary/25 bg-card/75 px-3 backdrop-blur-xl md:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <LedIndicator color="#69af00" active pulse size="sm" />
          <Radar className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <div className="truncate text-[11px] font-bold uppercase text-foreground md:text-sm">AI Tor <span className="text-accent">//</span> Global Strategic Command</div>
            <div className="hidden text-[8px] uppercase text-muted-foreground sm:block">Hyper-spectral intelligence · Cesium link stable</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[8px] uppercase md:gap-4">
          <span className="hidden text-muted-foreground md:inline">{activeSignals.toLocaleString()} signals</span>
          <span className="border border-primary/30 bg-primary/10 px-2 py-1 text-primary">Mission active</span>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <div className="absolute inset-0 z-0">
          <HybridGlobe layers={envLayers} onHotspotClick={setSelectedHotspot}
            onReady={(navigate) => { globeNavRef.current = navigate; }} externalMarkers={intel.eventMarkers}
            kpIndex={intel.spaceWeather?.kpIndex ?? 0} earthquakes={intel.earthquakes} nasaEvents={intel.nasaEvents}
            sightings={sightings} flights={allFlights} ships={ships} satellites={intel.satellites}
            rainTileUrl={intel.rainTileUrl} surfaceWeather={intel.surfaceWeather} fires={intel.fires}
            auroraCells={intel.auroraMesh.cells} cables={intel.cables} bitcoinNodes={intel.bitcoinNodes}
            gdeltEvents={intel.gdeltEvents} />
        </div>

        <GlobeOverlay selectedHotspot={selectedHotspot} onClose={() => setSelectedHotspot(null)}
          spaceWeather={intel.spaceWeather} earthquakeCount={intel.earthquakes.length}
          nasaEventCount={intel.nasaEvents.length} conflictCount={CONFLICT_ZONES.length}
          wildfireCount={intel.fires.length} outageCount={outages.length}
          criticalIntelCount={intel.osint.filter((event) => event.severity === "CRITICAL").length} />

        <aside className="pointer-events-none absolute inset-y-0 left-0 z-30 hidden w-[300px] border-r border-primary/20 bg-background/45 p-3 backdrop-blur-sm md:block">
          <div className="pointer-events-auto space-y-2">{legend(undefined, false)}<NavigatePanel onNavigate={handleNavigate} />
            <Button variant="outline" size="sm" onClick={() => setMobilePanel(mobilePanel === "diagnostics" ? null : "diagnostics")}
              className="h-8 rounded-sm border-border/70 bg-card/75 text-[10px] uppercase text-muted-foreground">
              <Wrench className="h-3.5 w-3.5 text-primary" /> Diagnostics
            </Button>
            {mobilePanel === "diagnostics" && <GlobeDiagnostics />}
          </div>
        </aside>

        {!selectedHotspot && feedOpen && (
          <aside className="pointer-events-auto absolute inset-y-0 right-0 z-20 hidden w-[320px] border-l border-primary/20 bg-background/45 backdrop-blur-sm lg:block">
            <div className="flex h-10 items-center justify-between border-b border-border/60 px-3">
              <div className="flex items-center gap-2 text-[9px] uppercase text-primary"><Database className="h-3.5 w-3.5" /> Tactical telemetry</div>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm" onClick={() => setFeedOpen(false)} aria-label="Cerrar telemetría"><PanelRightClose /></Button>
            </div>
            <div className="h-[calc(100%-2.5rem)]"><ChatFeedPanel earthquakes={intel.earthquakes} nasaEvents={intel.nasaEvents} osintEvents={intel.osint} cryptoPrices={intel.cryptoPrices} /></div>
          </aside>
        )}
        {!selectedHotspot && !feedOpen && <Button variant="outline" size="icon" onClick={() => setFeedOpen(true)} className="absolute right-3 top-3 z-30 hidden h-9 w-9 rounded-sm border-primary/30 bg-card/80 lg:inline-flex" aria-label="Abrir telemetría"><Database /></Button>}

        <div className="absolute left-2 top-2 z-30 flex flex-col gap-1.5 md:hidden">
          {([{ id: "legend" as const, Icon: Layers, label: "Capas" }, { id: "navigate" as const, Icon: Compass, label: "Navegar" }, { id: "diagnostics" as const, Icon: Wrench, label: "Diagnóstico" }]).map(({ id, Icon, label }) => (
            <Button key={id} variant="outline" size="icon" onClick={() => setMobilePanel(mobilePanel === id ? null : id)} aria-label={label}
              className="h-9 w-9 rounded-sm border-primary/30 bg-card/85"><Icon className="text-primary" /></Button>
          ))}
        </div>
        {mobilePanel && <div className="fixed inset-x-0 bottom-14 z-50 max-h-[70vh] overflow-y-auto border-t border-primary/30 bg-background/95 p-3 backdrop-blur-xl md:hidden">
          {mobilePanel === "legend" && legend(() => setMobilePanel(null), false)}
          {mobilePanel === "navigate" && <NavigatePanel onNavigate={handleNavigate} forceOpen onClose={() => setMobilePanel(null)} />}
          {mobilePanel === "diagnostics" && <GlobeDiagnostics />}
        </div>}
      </div>

      <div className="z-30 shrink-0">
        <MarketTicker prices={intel.cryptoPrices} />
        <LiveTicker spaceWeather={intel.spaceWeather} earthquakes={intel.earthquakes} nasaEvents={intel.nasaEvents} />
        <div className="flex h-7 items-center justify-between border-t border-border/60 bg-card/90 px-3 text-[8px] uppercase text-muted-foreground md:px-5">
          <div className="flex items-center gap-3"><Wifi className="h-3 w-3 text-primary" /><span className="hidden sm:inline">Aerospace OSINT interface</span><span>{envLayers.size} layers</span></div>
          <div className="flex items-center gap-3">{["NASA", "USGS", "NOAA", "GDELT"].map((source) => <span key={source} className="flex items-center gap-1"><CheckCircle2 className="h-2.5 w-2.5 text-primary" />{source}</span>)}</div>
        </div>
      </div>

      <PricingModal open={!!paywallReason} onClose={() => setPaywallReason(null)} reason={paywallReason ?? undefined} currentTier={tier} />
    </section>
  );
}
