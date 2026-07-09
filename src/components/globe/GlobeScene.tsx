import { useCallback, useMemo, useRef, useState } from "react";
import {
  Layers, Radar, CloudRain, Cloud, Wind, Gauge, Satellite,
  Map as MapIcon, Plane, ZoomIn, ZoomOut, Crosshair,
  ChevronRight, ChevronLeft, TrendingUp,
} from "lucide-react";
import { CesiumGlobe } from "./CesiumGlobe";
import { useEarthquakes } from "@/hooks/useEarthquakes";
import { useNasaEvents } from "@/hooks/useNasaEvents";
import { useUAPSightings } from "@/hooks/useUAPSightings";
import { useSpaceWeather } from "@/hooks/useSpaceWeather";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Shared hotspot type — kept exported because dashboards and unified intel
// hooks import it from this module.
// ---------------------------------------------------------------------------
export interface UnifiedHotspotData {
  lat: number;
  lon: number;
  intensity: number;
  color: string;
  name: string;
  country: string;
  marketVolume: string;
  trend: string;
  topTokens: string[];
  type:
    | "conflict" | "finance" | "tech" | "geopolitical"
    | "quake" | "dao_node" | "nasa" | "aircraft";
}
export type HotspotData = UnifiedHotspotData;

interface GlobeSceneProps {
  onHotspotClick?: (d: UnifiedHotspotData | null) => void;
  onReady?: (navFn: (lat: number, lng: number, altitude: number) => void) => void;
  externalMarkers?: UnifiedHotspotData[];
  // Kept for API stability with GlobeDashboard; mapped to internal HUD state.
  cloudsEnabled?: boolean;
  weatherEnabled?: boolean;
  firesEnabled?: boolean;
  aircraftEnabled?: boolean;
  marketsEnabled?: boolean;
}

const ZARAGOZA = { lat: 41.65, lon: -0.88, alt: 1_500_000 };

/**
 * GlobeScene — pure UI wrapper around the Cesium engine.
 *
 * All rendering (imagery, entities, atmosphere, aurora) is delegated to
 * <CesiumGlobe/>. This component owns the floating HUD (layer toggles,
 * base-map selector, HUD zoom + fly-to controls) and forwards state as
 * props. No react-globe.gl / three imports live here.
 */
export function GlobeScene({
  onHotspotClick,
  onReady,
  cloudsEnabled = true,
  weatherEnabled = true,
  firesEnabled = true,
  aircraftEnabled = true,
  marketsEnabled = true,
}: GlobeSceneProps) {
  // Data feeds required by CesiumGlobe
  const { earthquakes } = useEarthquakes();
  const { events: nasaEvents } = useNasaEvents();
  const { sightings } = useUAPSightings();
  const { kpIndex } = useSpaceWeather();

  // ---- HUD state --------------------------------------------------------
  const [baseMapStyle, setBaseMapStyle] = useState<"satellite" | "dark">("satellite");
  const [showRadar, setShowRadar] = useState(false);
  const [showIsobars, setShowIsobars] = useState(false);
  const [showClouds, setShowClouds] = useState(cloudsEnabled);
  const [showWind, setShowWind] = useState(false);
  const [showRain, setShowRain] = useState(weatherEnabled);
  const [showAircraft, setShowAircraft] = useState(aircraftEnabled);
  const [showMarkets, setShowMarkets] = useState(marketsEnabled);
  const [showFires, setShowFires] = useState(firesEnabled);
  const [panelOpen, setPanelOpen] = useState(true);
  const [flyToTarget, setFlyToTarget] = useState<
    { lat: number; lon: number; alt: number } | null
  >(null);

  // Cesium exposes a nav callback we forward both to parent and to HUD buttons.
  const navRef = useRef<((lat: number, lng: number, alt: number) => void) | null>(null);
  const handleReady = useCallback(
    (fn: (lat: number, lng: number, alt: number) => void) => {
      navRef.current = fn;
      onReady?.(fn);
    },
    [onReady],
  );

  // Category visibility (markets / uap / cryptozoo). UAP + Cryptozoo stay on;
  // only markets are gated by the HUD to match the LegendPanel semantics.
  const visibleLayers = useMemo(() => {
    const s = new Set<"markets" | "uap" | "cryptozoo">();
    if (showMarkets) s.add("markets");
    s.add("uap");
    s.add("cryptozoo");
    return s;
  }, [showMarkets]);

  const navigate = useCallback((lat: number, lon: number, alt: number) => {
    if (navRef.current) navRef.current(lat, lon, alt);
    else setFlyToTarget({ lat, lon, alt });
  }, []);

  const flyToDAO = () => navigate(ZARAGOZA.lat, ZARAGOZA.lon, ZARAGOZA.alt);
  const zoomIn = () => {
    // Halve altitude at current view (approximate — Cesium camera zoom).
    (window as any).__cesiumZoom?.(0.5);
  };
  const zoomOut = () => {
    (window as any).__cesiumZoom?.(2);
  };

  // Filter NASA fire events out when firesEnabled=false. We can't cheaply
  // partition inside CesiumGlobe without new props, so pre-filter here.
  const filteredNasa = useMemo(() => {
    if (showFires) return nasaEvents;
    return nasaEvents.filter(
      (e) => !/(fire|wildfire)/i.test(e.category || ""),
    );
  }, [nasaEvents, showFires]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <CesiumGlobe
        onHotspotClick={onHotspotClick}
        sightings={sightings as any}
        visibleLayers={visibleLayers}
        flyTo={flyToTarget}
        kpIndex={kpIndex}
        earthquakes={earthquakes as any}
        nasaEvents={filteredNasa as any}
        baseMapStyle={baseMapStyle}
        showRadar={showRadar}
        showIsobars={showIsobars}
        showClouds={showClouds}
        showWind={showWind}
        showRain={showRain}
        aircraftEnabled={showAircraft}
        {...({ onReady: handleReady } as any)}
      />

      {/* ================ HUD: Layer Control Panel (top-right) ============ */}
      <div className="absolute top-3 right-3 z-30 flex items-start gap-2 pointer-events-none">
        {panelOpen ? (
          <div
            className="pointer-events-auto w-[260px] max-h-[calc(100vh-6rem)] overflow-y-auto bg-black/80 backdrop-blur-md border border-[#69af00]/40 rounded-xl p-4 shadow-[0_0_24px_rgba(105,175,0,0.15)]"
            style={{ fontFamily: "'Nasalization', ui-monospace, monospace" }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#69af00]" />
                <span className="text-[11px] tracking-[0.15em] text-[#69af00] uppercase">
                  Tactical Layers
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="text-[#69af00]/70 hover:text-[#69af00] transition"
                aria-label="Collapse layer panel"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Base map selector */}
            <div className="mb-4">
              <div className="text-[9px] uppercase tracking-widest text-slate-500 mb-1.5">
                Base Map
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <BaseChoice
                  active={baseMapStyle === "satellite"}
                  onClick={() => setBaseMapStyle("satellite")}
                  Icon={Satellite}
                  label="SATELLITE"
                />
                <BaseChoice
                  active={baseMapStyle === "dark"}
                  onClick={() => setBaseMapStyle("dark")}
                  Icon={MapIcon}
                  label="DARK"
                />
              </div>
            </div>

            {/* Weather overlays */}
            <SectionLabel>Weather Overlays</SectionLabel>
            <ToggleRow icon={Radar} label="Rain Radar" hint="RainViewer" active={showRadar} onToggle={() => setShowRadar((v) => !v)} />
            <ToggleRow icon={Gauge} label="Isobars" hint="OWM · pressure" active={showIsobars} onToggle={() => setShowIsobars((v) => !v)} />
            <ToggleRow icon={Cloud} label="Clouds" hint="OWM · clouds" active={showClouds} onToggle={() => setShowClouds((v) => !v)} />
            <ToggleRow icon={Wind} label="Wind" hint="OWM · wind" active={showWind} onToggle={() => setShowWind((v) => !v)} />
            <ToggleRow icon={CloudRain} label="Precipitation" hint="OWM · rain" active={showRain} onToggle={() => setShowRain((v) => !v)} />

            <SectionLabel className="mt-3">Intel Feeds</SectionLabel>
            <ToggleRow icon={Plane} label="Aircraft" hint="OpenSky · soon" active={showAircraft} onToggle={() => setShowAircraft((v) => !v)} />
            <ToggleRow icon={TrendingUp} label="Markets" hint="Hotspots" active={showMarkets} onToggle={() => setShowMarkets((v) => !v)} />
            <ToggleRow icon={CloudRain} label="Fires" hint="NASA EONET" active={showFires} onToggle={() => setShowFires((v) => !v)} />

            <div className="mt-4 pt-3 border-t border-[#69af00]/20 flex items-center justify-between text-[9px] text-slate-500 uppercase tracking-wider">
              <span>Kp Index</span>
              <span className={cn("font-mono", kpIndex >= 4 ? "text-[#FFD700]" : "text-[#69af00]")}>
                {kpIndex.toFixed(1)}
              </span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="pointer-events-auto w-9 h-9 rounded-lg bg-black/80 backdrop-blur-md border border-[#69af00]/40 flex items-center justify-center text-[#69af00] hover:border-[#69af00] transition"
            aria-label="Open layer panel"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ================ HUD: Left-side navigation buttons =============== */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2 pointer-events-none">
        <HUDButton onClick={zoomIn} label="Zoom In">
          <ZoomIn className="w-4 h-4" />
        </HUDButton>
        <HUDButton onClick={zoomOut} label="Zoom Out">
          <ZoomOut className="w-4 h-4" />
        </HUDButton>
        <HUDButton onClick={flyToDAO} label="Center DAO HQ" accent>
          <Crosshair className="w-4 h-4" />
        </HUDButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small HUD subcomponents (kept in-file to reduce blast radius)
// ---------------------------------------------------------------------------
function SectionLabel({
  children, className,
}: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("text-[9px] uppercase tracking-widest text-slate-500 mb-1.5", className)}>
      {children}
    </div>
  );
}

function ToggleRow({
  icon: Icon, label, hint, active, onToggle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; hint?: string; active: boolean; onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border transition mb-1",
        active
          ? "bg-[#69af00]/10 border-[#69af00]/60 text-[#69af00]"
          : "bg-black/40 border-slate-700/50 text-slate-400 hover:border-[#69af00]/40 hover:text-[#69af00]/80",
      )}
    >
      <span className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </span>
      <span className="flex items-center gap-2">
        {hint && <span className="text-[8px] text-slate-500 uppercase tracking-wide">{hint}</span>}
        <span
          className={cn(
            "w-6 h-3 rounded-full relative transition",
            active ? "bg-[#69af00]/80" : "bg-slate-700",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 w-2 h-2 rounded-full bg-black transition-all",
              active ? "left-3.5" : "left-0.5",
            )}
          />
        </span>
      </span>
    </button>
  );
}

function BaseChoice({
  active, onClick, Icon, label,
}: {
  active: boolean; onClick: () => void;
  Icon: React.ComponentType<{ className?: string }>; label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-[9px] tracking-widest transition",
        active
          ? "bg-[#69af00]/15 border-[#69af00] text-[#69af00]"
          : "bg-black/40 border-slate-700/50 text-slate-400 hover:border-[#69af00]/40",
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function HUDButton({
  onClick, label, accent, children,
}: {
  onClick: () => void; label: string; accent?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "pointer-events-auto w-9 h-9 rounded-lg bg-black/70 backdrop-blur-md border flex items-center justify-center transition shadow-[0_0_12px_rgba(0,0,0,0.6)]",
        accent
          ? "border-[#FFD700]/50 text-[#FFD700] hover:border-[#FFD700] hover:bg-[#FFD700]/10"
          : "border-[#69af00]/50 text-[#69af00] hover:border-[#69af00] hover:bg-[#69af00]/10",
      )}
    >
      {children}
    </button>
  );
}