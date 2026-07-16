import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ZoomIn, ZoomOut, Crosshair,
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
const DAO_MARKER: UnifiedHotspotData = {
  lat: ZARAGOZA.lat,
  lon: ZARAGOZA.lon,
  intensity: 1,
  color: "#FFD700",
  name: "ΔlieπFlΦw DAO",
  country: "Zaragoza",
  marketVolume: "Sovereign Node",
  trend: "ONLINE",
  topTokens: ["DAO", "HQ"],
  type: "dao_node",
};

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
  externalMarkers = [],
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
  const [showClouds, setShowClouds] = useState(false);
  const [showWind, setShowWind] = useState(false);
  const [showRain, setShowRain] = useState(false);
  const [showAircraft, setShowAircraft] = useState(aircraftEnabled);
  const [showTemperature, setShowTemperature] = useState(false);
  const [showMarkets, setShowMarkets] = useState(marketsEnabled);
  const [showFires, setShowFires] = useState(firesEnabled);
  const [flyToTarget, setFlyToTarget] = useState<
    { lat: number; lon: number; alt: number } | null
  >(null);

  useEffect(() => setShowFires(firesEnabled), [firesEnabled]);
  useEffect(() => setShowAircraft(aircraftEnabled), [aircraftEnabled]);
  useEffect(() => setShowMarkets(marketsEnabled), [marketsEnabled]);

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
    else setFlyToTarget({ lat, lon, alt: alt < 1000 ? alt * 1_000_000 : alt });
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

  const mergedExternalMarkers = useMemo(() => {
    const seen = new Set<string>();
    return [DAO_MARKER, ...externalMarkers].filter((marker) => {
      const key = `${marker.type}:${marker.name}:${marker.lat.toFixed(3)}:${marker.lon.toFixed(3)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [externalMarkers]);

  useEffect(() => {
    const state = {
      radar: showRadar,
      clouds: showClouds,
      precipitation: showRain || showRadar,
      wind: showWind,
      pressure: showIsobars,
      temperature: showTemperature,
    };
    (window as any).__owmState = state;
    (window as any).__globeBaseState = baseMapStyle;
    (window as any).__globeSetBase = (style: "satellite" | "dark") => setBaseMapStyle(style);
    // Mutually-exclusive OWM overlay — only one raster active at a time so
    // stacked tiles don't turn the globe into a muddy blob when zooming.
    (window as any).__owmToggle = (
      key: "radar" | "clouds" | "precipitation" | "wind" | "pressure" | "temperature",
    ) => {
      const cur: Record<string, boolean> = {
        radar: showRadar, clouds: showClouds, precipitation: showRain,
        wind: showWind, pressure: showIsobars, temperature: showTemperature,
      };
      const isOn = !!cur[key];
      setShowRadar(false); setShowClouds(false); setShowRain(false);
      setShowWind(false); setShowIsobars(false); setShowTemperature(false);
      if (isOn) return;
      if (key === "radar") setShowRadar(true);
      else if (key === "clouds") setShowClouds(true);
      else if (key === "precipitation") setShowRain(true);
      else if (key === "wind") setShowWind(true);
      else if (key === "pressure") setShowIsobars(true);
      else if (key === "temperature") setShowTemperature(true);
    };
    return () => {
      delete (window as any).__owmState;
      delete (window as any).__owmToggle;
      delete (window as any).__globeBaseState;
      delete (window as any).__globeSetBase;
    };
  }, [baseMapStyle, showClouds, showRain, showRadar, showWind, showIsobars, showTemperature]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <CesiumGlobe
        onHotspotClick={onHotspotClick}
        sightings={sightings as any}
        externalMarkers={mergedExternalMarkers}
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
        {...({ onReady: handleReady, showTemperature } as any)}
      />

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