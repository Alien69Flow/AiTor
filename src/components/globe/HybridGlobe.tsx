import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { lazyWithRetry } from "@/lib/lazy-retry";
import { useIsMobile } from "@/hooks/use-mobile";
import { type UnifiedHotspotData } from "./GlobeScene";
import type { EnvLayerKey } from "@/lib/globe-layers";
import type { TacticalLayerKey } from "./CesiumGlobe";
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
  visibleLayers: Set<TacticalLayerKey>;
  onHotspotClick?: (d: UnifiedHotspotData | null) => void;
  onReady?: (navigateFn: (lat: number, lng: number, altitude: number) => void) => void;
  externalMarkers?: UnifiedHotspotData[];
  kpIndex?: number;
  earthquakes?: Earthquake[];
  nasaEvents?: NasaEvent[];
  sightings?: UAPSighting[];
  flights?: Flight[];
  ships?: Ship[];
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
  visibleLayers,
  onHotspotClick,
  onReady,
  externalMarkers,
  kpIndex = 0,
  earthquakes = [],
  nasaEvents = [],
  sightings = [],
  flights = [],
  ships = [],
}: HybridGlobeProps) {
  const isMobile = useIsMobile();
  const [flyTo, setFlyTo] = useState<{ lat: number; lon: number; alt: number } | null>(null);
  const satellites = useSatellites(!isMobile && layers.has("satellites"));
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
          visibleLayers={visibleLayers}
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
        />
      </Suspense>
    </div>
  );
}
