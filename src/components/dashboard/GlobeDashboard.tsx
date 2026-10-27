import { useState, useCallback, useMemo, useRef } from "react";
import { LiveTicker } from "./LiveTicker";
import { MarketTicker } from "./MarketTicker";
import { GlobeOverlay } from "./GlobeOverlay";
import type { UnifiedHotspotData } from "../globe/GlobeScene";
import { HybridGlobe } from "../globe/HybridGlobe";
import { GlobeScaleHud, type ViewScale } from "../globe/GlobeScaleHud";
import { LegendPanel, type LayerKey } from "./LegendPanel";
import { NavigatePanel } from "./NavigatePanel";
import { ChatFeedPanel } from "./ChatFeedPanel";
import { PricingModal } from "./PricingModal";
import { GlobeDiagnostics } from "./GlobeDiagnostics";
import { useUnifiedIntel } from "@/hooks/useUnifiedIntel";
import { cameraCoverage, placedCameras } from "@/lib/live-camera-places";
import { useUAPSightings } from "@/hooks/useUAPSightings";
import { useTier } from "@/hooks/useTier";
import { useAirTraffic } from "@/hooks/useAirTraffic";
import { useMarineTraffic } from "@/hooks/useMarineTraffic";
import { useInternetOutages } from "@/hooks/useInternetOutages";
import { CONFLICT_ZONES } from "@/lib/geo-datasets";
import { DEFAULT_ACTIVE_LAYERS, TIER_LABEL, layerDef, type EnvLayerKey } from "@/lib/globe-layers";
import { Wifi, CircleCheck as CheckCircle2, Compass, Layers, Wrench, Database, PanelRightClose, PanelLeftClose, PanelLeftOpen, TriangleAlert } from "lucide-react";
import { GlobeCommandBar } from "./GlobeCommandBar";
import { CosmicZoom } from "../globe/CosmicZoom";
import { Button } from "@/components/ui/button";

type MobilePanel = "legend" | "navigate" | "diagnostics" | "feed" | null;

interface GlobeDashboardProps {
  /**
   * Abre una cámara del Alien en su pestaña. El globo las sitúa y este callback
   * es el que cruza de módulo; sin él los marcadores siguen ahí, pero no
   * llevan a ninguna parte.
   */
  onOpenCamera?: (cameraId: string) => void;
}

export function GlobeDashboard({ onOpenCamera }: GlobeDashboardProps = {}) {
  const [selectedHotspot, setSelectedHotspot] = useState<UnifiedHotspotData | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [feedOpen, setFeedOpen] = useState(true);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [paywallReason, setPaywallReason] = useState<string | null>(null);
  const [visibleLayers, setVisibleLayers] = useState<Set<LayerKey>>(new Set(["finance", "intel", "conflict", "geopolitical", "logistics", "cryptozoo", "convergence"]));
  const [envLayers, setEnvLayers] = useState<Set<EnvLayerKey>>(new Set(DEFAULT_ACTIVE_LAYERS));

  const intel = useUnifiedIntel(envLayers);
  const { sightings } = useUAPSightings();
  const { tier, hasAccess } = useTier();
  const airTraffic = useAirTraffic();
  const marineTraffic = useMarineTraffic();
  const { flights } = airTraffic;
  const { ships } = marineTraffic;
  const { outages } = useInternetOutages(true);
  // Inventario fijo (la lista de cámaras está curada en el repositorio): se
  // calcula una vez y se reutiliza, porque cada entrada de aquí acaba siendo
  // una entidad del globo cuando la capa está encendida.
  const camerasOnGlobe = useMemo(() => placedCameras(), []);
  const cameraStats = useMemo(() => cameraCoverage(), []);
  const allFlights = intel.aviation.length > flights.length ? intel.aviation : flights;
  // The warning must describe what is actually on the globe: the air layer is
  // served by ADSB.lol and only the proxy reports `unavailable`, so the chips
  // only appear when the globe really has nothing to draw. No feed invents rows
  // any more, so this replaced the old "SIMULADO" badge: an empty layer is
  // reported as missing coverage, never as simulated traffic.
  const flightsUnavailable = allFlights.length === 0 && airTraffic.unavailable;
  const shipsUnavailable = ships.length === 0 && marineTraffic.unavailable;
  const globeNavRef = useRef<((lat: number, lng: number, alt: number) => void) | null>(null);
  // null = globe view; a number = log10(metres) the cosmic zoom opened at.
  const [cosmicScale, setCosmicScale] = useState<number | null>(null);
  /** Escala real de la cámara (metros por píxel), para la barra de escala. */
  const [viewScale, setViewScale] = useState<ViewScale | null>(null);
  /** Pasos de zoom que expone el globo, para los botones de la barra de escala. */
  const zoomControlsRef = useRef<{ zoomIn: () => void; zoomOut: () => void } | null>(null);

  /** Zooming out past the globe hands the view over to the cosmic zoom. */
  const handleZoomFar = useCallback((altitudeMetres: number) => {
    setCosmicScale((current) => current ?? Math.log10(Math.max(altitudeMetres, 1)));
  }, []);

  /** Coming back from the cosmic zoom drops the globe camera inside the threshold,
   *  otherwise the next camera nudge would immediately re-open the overlay. */
  const exitCosmicZoom = useCallback(() => {
    setCosmicScale(null);
    globeNavRef.current?.(20, 20, 2.5);
  }, []);

  const toggleLayer = useCallback((key: LayerKey) => setVisibleLayers((previous) => {
    const next = new Set(previous);
    if (next.has(key)) next.delete(key);
    else next.add(key);
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
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, [hasAccess]);

  const handleNavigate = useCallback((lat: number, lng: number, altitude: number) => {
    globeNavRef.current?.(lat, lng, altitude);
    setMobilePanel(null);
    setControlsOpen(false);
  }, []);

  const legend = (onClose?: () => void, collapsed = true) => (
    <LegendPanel visibleLayers={visibleLayers} onToggleLayer={toggleLayer} counts={intel.counts}
      envLayers={envLayers} onToggleEnvLayer={toggleEnvLayer} tier={tier} hasAccess={hasAccess}
      onClose={onClose} defaultCollapsed={collapsed} layerStatus={intel.layerStatus} />
  );

  const activeSignals = intel.earthquakes.length + intel.nasaEvents.length + allFlights.length + ships.length + intel.gdeltEvents.length;

  const feed = <ChatFeedPanel earthquakes={intel.earthquakes} nasaEvents={intel.nasaEvents} osintEvents={intel.osint} cryptoPrices={intel.cryptoPrices} />;

  return (
    <section className="flex flex-1 min-h-0 flex-col overflow-hidden bg-background font-mono" aria-label="Global strategic command">
      <h2 className="sr-only">Globo táctico en tiempo real: capas meteorológicas, OSINT y mercados</h2>

      <GlobeCommandBar activeSignals={activeSignals} layerStatus={intel.layerStatus} layersCount={envLayers.size} />

      {/* LIVE MARKETS — must stay anchored at the TOP of the globe view.
          Do not move this into the bottom group with the alerts bar. */}
      <div className="z-30 shrink-0"><MarketTicker prices={intel.cryptoPrices} /></div>

      <div className="relative flex min-h-0 flex-1">
        <div className="absolute inset-0 z-0">
          <HybridGlobe layers={envLayers} onHotspotClick={setSelectedHotspot} onZoomFar={handleZoomFar}
            onViewScale={setViewScale}
            onZoomControls={(controls) => { zoomControlsRef.current = controls; }}
            onReady={(navigate) => { globeNavRef.current = navigate; }} externalMarkers={intel.eventMarkers}
            kpIndex={intel.spaceWeather?.kpIndex ?? 0} earthquakes={intel.earthquakes} nasaEvents={intel.nasaEvents}
            sightings={sightings} flights={allFlights} ships={ships} satellites={intel.satellites}
            rainTileUrl={intel.rainTileUrl} surfaceWeather={intel.surfaceWeather} fires={intel.fires}
            auroraCells={intel.auroraMesh.cells} cables={intel.cables} bitcoinNodes={intel.bitcoinNodes}
            gdeltEvents={intel.gdeltEvents} iss={intel.iss} ionosphere={intel.ionosphere}
            vanAllen={intel.vanAllen} solarWind={intel.solarWind}
            cameras={camerasOnGlobe} onCameraClick={onOpenCamera} />
        </div>

        {cosmicScale !== null && <CosmicZoom initialScale={cosmicScale} onExit={exitCosmicZoom} />}

        {/* Barra de escala real: cuánto mide lo que se ve y cuánto queda por
            acercar. Se oculta con el zoom cósmico, que trae su propia escala. */}
        {cosmicScale === null && viewScale && (
          <GlobeScaleHud
            scale={viewScale}
            onZoomIn={() => zoomControlsRef.current?.zoomIn()}
            onZoomOut={() => zoomControlsRef.current?.zoomOut()}
            className="absolute bottom-2 left-2 z-20 md:bottom-3 md:left-[3.25rem]"
          />
        )}

        <GlobeOverlay selectedHotspot={selectedHotspot} onClose={() => setSelectedHotspot(null)}
          spaceWeather={intel.spaceWeather} earthquakeCount={intel.earthquakes.length}
          nasaEventCount={intel.nasaEvents.length} conflictCount={CONFLICT_ZONES.length}
          wildfireCount={intel.fires.length} outageCount={outages.length}
          criticalIntelCount={intel.osint.filter((event) => event.severity === "CRITICAL").length} />

        {/* Desktop: collapsible control rail so the globe stays visible */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-30 hidden md:flex">
          {controlsOpen ? (
            <aside className="pointer-events-auto w-[280px] overflow-y-auto border-r border-primary/20 bg-background/70 p-2.5 backdrop-blur-md">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-wider text-primary">Mission controls</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm" onClick={() => setControlsOpen(false)} aria-label="Ocultar controles"><PanelLeftClose /></Button>
              </div>
              <div className="space-y-2">
                {legend(undefined, false)}
                <NavigatePanel onNavigate={handleNavigate} />
                <Button variant="outline" size="sm" onClick={() => setMobilePanel(mobilePanel === "diagnostics" ? null : "diagnostics")}
                  className="h-8 w-full rounded-sm border-border/70 bg-card/75 text-[10px] uppercase text-muted-foreground">
                  <Wrench className="h-3.5 w-3.5 text-primary" /> Diagnostics
                </Button>
                {mobilePanel === "diagnostics" && <GlobeDiagnostics />}
              </div>
            </aside>
          ) : (
            <div className="pointer-events-auto flex flex-col gap-1.5 p-2">
              <Button variant="outline" size="icon" onClick={() => setControlsOpen(true)} aria-label="Abrir controles"
                className="h-9 w-9 rounded-sm border-primary/30 bg-card/85"><PanelLeftOpen className="text-primary" /></Button>
              <Button variant="outline" size="icon" onClick={() => setControlsOpen(true)} aria-label="Capas"
                className="h-9 w-9 rounded-sm border-primary/30 bg-card/85"><Layers className="text-primary" /></Button>
              <Button variant="outline" size="icon" onClick={() => setControlsOpen(true)} aria-label="Navegar"
                className="h-9 w-9 rounded-sm border-primary/30 bg-card/85"><Compass className="text-primary" /></Button>
            </div>
          )}
        </div>

        {!selectedHotspot && feedOpen && (
          <aside className="pointer-events-auto absolute inset-y-0 right-0 z-20 hidden w-[300px] border-l border-primary/20 bg-background/60 backdrop-blur-md md:block">
            <div className="flex h-9 items-center justify-between border-b border-border/60 px-3">
              <div className="flex items-center gap-2 text-[9px] uppercase text-primary"><Database className="h-3.5 w-3.5" /> Tactical telemetry</div>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm" onClick={() => setFeedOpen(false)} aria-label="Cerrar telemetría"><PanelRightClose /></Button>
            </div>
            <div className="h-[calc(100%-2.25rem)]">{feed}</div>
          </aside>
        )}
        {!selectedHotspot && !feedOpen && <Button variant="outline" size="icon" onClick={() => setFeedOpen(true)} className="absolute right-2 top-2 z-30 hidden h-9 w-9 rounded-sm border-primary/30 bg-card/85 md:inline-flex" aria-label="Abrir telemetría"><Database className="text-primary" /></Button>}

        {/* Mobile controls */}
        <div className="absolute left-2 top-2 z-30 flex flex-col gap-1.5 md:hidden">
          {([{ id: "legend" as const, Icon: Layers, label: "Capas" }, { id: "navigate" as const, Icon: Compass, label: "Navegar" }, { id: "feed" as const, Icon: Database, label: "Feed" }, { id: "diagnostics" as const, Icon: Wrench, label: "Diagnóstico" }]).map(({ id, Icon, label }) => (
            <Button key={id} variant="outline" size="icon" onClick={() => setMobilePanel(mobilePanel === id ? null : id)} aria-label={label}
              className="h-8 w-8 rounded-sm border-primary/30 bg-card/85"><Icon className="text-primary" /></Button>
          ))}
        </div>
        {mobilePanel && <div className="fixed inset-x-0 bottom-14 z-50 max-h-[62vh] overflow-y-auto border-t border-primary/30 bg-background/95 p-3 backdrop-blur-xl md:hidden">
          {mobilePanel === "legend" && legend(() => setMobilePanel(null), false)}
          {mobilePanel === "navigate" && <NavigatePanel onNavigate={handleNavigate} forceOpen onClose={() => setMobilePanel(null)} />}
          {mobilePanel === "feed" && <div className="h-[52vh]">{feed}</div>}
          {mobilePanel === "diagnostics" && <GlobeDiagnostics />}
        </div>}
      </div>

      {/* LIVE ALERTS / events (fires, earthquakes, news) — must stay at the BOTTOM.
          Keep it separate from the LIVE MARKETS bar above. */}
      <div className="z-30 shrink-0">
        <LiveTicker spaceWeather={intel.spaceWeather} earthquakes={intel.earthquakes} nasaEvents={intel.nasaEvents} />
        <div className="flex h-6 items-center justify-between border-t border-border/60 bg-card/90 px-3 text-[8px] uppercase text-muted-foreground md:px-5">
          <div className="flex items-center gap-3"><Wifi className="h-3 w-3 text-primary" /><span className="hidden sm:inline">Aerospace OSINT interface</span><span>{envLayers.size} layers</span>
            {/* Cuántas cámaras del Alien están en el mapa: las de órbita, Marte o
                «Global» no tienen sede terrena, y decirlo evita que parezca que
                faltan cámaras de la lista. */}
            {envLayers.has("liveCameras") && (
              <span
                className="hidden sm:inline"
                title={`${cameraStats.placed} cámaras tienen sede conocida y se dibujan; ${cameraStats.unplaceable} no (órbita, Marte, «Global» o canales multi-sede).`}
              >
                cámaras {cameraStats.placed}/{cameraStats.total}
              </span>
            )}
            {/* Ninguna fuente responde con datos inventados: cuando la capa se
                queda sin tráfico real, esto lo dice en vez de disimularlo. */}
            {(flightsUnavailable || shipsUnavailable) && (
              <span className="flex items-center gap-1 border border-amber-400/40 bg-amber-400/10 px-1.5 text-amber-300"
                title={`${[flightsUnavailable && "tráfico aéreo", shipsUnavailable && "tráfico marítimo"].filter(Boolean).join(" y ")} sin cobertura: la fuente externa no respondió y no se dibujan datos simulados. ${[flightsUnavailable && airTraffic.unavailableReason, shipsUnavailable && marineTraffic.unavailableReason].filter(Boolean).join(" · ")}`}>
                <TriangleAlert className="h-2.5 w-2.5" aria-hidden="true" />
                {[flightsUnavailable && "AÉREO", shipsUnavailable && "MARÍTIMO"].filter(Boolean).join("+")} SIN COBERTURA
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">{["NASA", "USGS", "NOAA", "GDELT"].map((source) => <span key={source} className="flex items-center gap-1"><CheckCircle2 className="h-2.5 w-2.5 text-primary" />{source}</span>)}</div>
        </div>
      </div>

      <PricingModal open={!!paywallReason} onClose={() => setPaywallReason(null)} reason={paywallReason ?? undefined} currentTier={tier} />
    </section>
  );
}
