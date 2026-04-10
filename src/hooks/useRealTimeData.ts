import { useMemo } from "react";
import { useEarthquakes } from "./useEarthquakes";
import { useNasaEvents } from "./useNasaEvents";
import { useCryptoPrices } from "./useCryptoPrices";
import { useSpaceWeather } from "./useSpaceWeather";
import { useUAPSightings } from "./useUAPSightings";
import type { LayerKey } from "@/components/dashboard/LegendPanel";

export function useRealTimeData() {
  const { earthquakes } = useEarthquakes();
  const { events: nasaEvents } = useNasaEvents();
  const { prices: cryptoPrices } = useCryptoPrices();
  const spaceWeather = useSpaceWeather();
  const { sightings } = useUAPSightings();

  const counts = useMemo<Record<LayerKey, number>>(() => ({
    finance: cryptoPrices.length,
    intel: sightings.length,
    conflict: earthquakes.filter(q => q.magnitude >= 5).length,
    geopolitical: nasaEvents.filter(e => e.category.toLowerCase().includes("storm")).length,
    logistics: 0,
    cryptozoo: 0,
    convergence: 1,
  }), [earthquakes, nasaEvents, cryptoPrices, sightings]);

  return {
    earthquakes,
    nasaEvents,
    cryptoPrices,
    spaceWeather,
    sightings,
    counts,
  };
}
