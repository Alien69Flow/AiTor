import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { lazyWithRetry } from "@/lib/lazy-retry";
import { useIsMobile } from "@/hooks/use-mobile";
import { type UnifiedHotspotData } from "./GlobeScene";
import type { EnvLayerKey } from "@/lib/globe-layers";
import type { Earthquake } from "@/hooks/useEarthquakes";
import type { NasaEvent } from "@/hooks/useNasaEvents";
import type { UAPSighting } from "@/hooks/useUAPSightings";
import type { Flight } from "@/hooks/useAirTraffic";
import type { Ship } from "@/hooks/useMarineTraffic";
import { useSatellites } from "@/hooks/useSatellites";
import { useInternetOutages } from "@/hooks/useInternetOutages";

const CesiumGlobe = lazyWithRetry(() =>
  import("./CesiumGlobe").then((m) => ({ default: m.CesiumGlobe }))
);

export interface HybridGlobeProps {
  layers: Set<EnvLayerKey>;
  onHotspotClick?: (d: UnifiedHotspotData | null) => void;
  onReady?: (navigateFn: (lat: number, lng: number, altitude: number) => void) => void;
  externalMarkers?: UnifiedHotspotData[];
  kpIndex?: number;
  earthquakes?: Earthquake[];
  nasaEvents?: NasaEvent[];
  sightings?: UAPSighting[];
  flights?: Flight[];
  ships?: Ship[];
  satellites?: { id: string; name: string; lat: number; lon: number; altKm: number }[];
  rainTileUrl?: string | null;
  surfaceWeather?: any[];
  fires?: any[];
  auroraCells?: { lat: number; lon: number; probability: number }[];
  cables?: any[];
  bitcoinNodes?: any[];
  gdeltEvents?: any[];
}

function GlobeFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      <span className="text-[10px] uppercase tracking-[0.3em] text-cyan-400/70 animate-pulse">
        Initializing GIS engine…
      </span>
    </div>
  );
}

export function HybridGlobe({
  layers,
  onHotspotClick,
  onReady,
  externalMarkers,
  kpIndex = 0,
  earthquakes = [],
  nasaEvents = [],
  sightings = [],
  flights = [],
  ships = [],
  satellites: satellitesProp,
  rainTileUrl = null,
  surfaceWeather = [],
  fires = [],
  auroraCells = [],
  cables = [],
  bitcoinNodes = [],
  gdeltEvents = [],
}: HybridGlobeProps) {
  const isMobile = useIsMobile();
  const [flyTo, setFlyTo] = useState<{ lat: number; lon: number; alt: number } | null>(null);
  const fallbackSatellites = useSatellites(
    !isMobile && layers.has("satellites") && !satellitesProp,
  );
  const satellites = satellitesProp?.length ? satellitesProp : fallbackSatellites;
  const { outages } = useInternetOutages(layers.has("internetOutages"));
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const cesiumNavigate = useCallback((lat: number, lng: number, altitude: number) => {
    // react-globe.gl altitude is in earth radii; Cesium expects metres.
    setFlyTo({ lat, lon: lng, alt: Math.max(150_000, altitude * 6_371_000) });
  }, []);

  // Single unified engine (Cesium) on every device.
  useEffect(() => {
    onReadyRef.current?.(cesiumNavigate);
  }, [cesiumNavigate]);

  return (
    <div className="relative w-full h-full">
      <Suspense fallback={<GlobeFallback />}>
        <CesiumGlobe
          envLayers={layers}
          onHotspotClick={onHotspotClick as any}
          sightings={sightings}
          flyTo={flyTo}
          kpIndex={layers.has("solarActivity") ? kpIndex : 0}
          earthquakes={layers.has("earthquakes") ? earthquakes : []}
          nasaEvents={layers.has("wildfires") ? nasaEvents : []}
          flights={layers.has("airTraffic") ? flights : []}
          ships={layers.has("marineTraffic") ? ships : []}
          satellites={layers.has("satellites") ? satellites : []}
          outages={layers.has("internetOutages") ? outages : []}
          rainTileUrl={rainTileUrl}
          surfaceWeather={surfaceWeather}
          fires={fires}
          auroraCells={auroraCells}
          cables={cables}
          bitcoinNodes={bitcoinNodes}
          gdeltEvents={gdeltEvents}
        />
      </Suspense>
    </div>
  );
}
