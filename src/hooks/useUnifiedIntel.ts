import { useMemo } from "react";
import { useRealTimeData } from "./useRealTimeData";
import { useOsintIntel, type IntelEvent } from "./useOsintIntel";
import { useRainViewer } from "./connectors/useRainViewer";
import { useSurfaceWeather } from "./connectors/useSurfaceWeather";
import { useEmscQuakes } from "./connectors/useEmscQuakes";
import { useFirmsFires } from "./connectors/useFirmsFires";
import { useAurora } from "./connectors/useAurora";
import { useSubmarineCables } from "./connectors/useSubmarineCables";
import { useBitcoinNodes } from "./connectors/useBitcoinNodes";
import { useGdeltEvents } from "./connectors/useGdeltEvents";
import { useAdsbTraffic } from "./connectors/useAdsbTraffic";
import { useCelestrakSatellites } from "./connectors/useCelestrakSatellites";
import { useIssPosition } from "./connectors/useIssPosition";
import { useIonosphere } from "./connectors/useIonosphere";
import { useVanAllenBelts } from "./connectors/useVanAllenBelts";
import { useSolarWind } from "./connectors/useSolarWind";
import { useEnvironmentGrid } from "./connectors/useEnvironmentGrid";
import { toStatus, type LayerStatus } from "@/lib/connectors";
import type { EnvLayerKey } from "@/lib/globe-layers";
import type { Earthquake } from "./useEarthquakes";
import type { UnifiedHotspotData } from "@/components/globe/GlobeScene";

export interface TickerItem {
  tag: string;
  text: string;
  source: string;
  time: string;
  severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

export type ConnectorKey =
  | "rainRadar"
  | "surfaceWeather"
  | "quakesEmsc"
  | "fires"
  | "aurora"
  | "satellites"
  | "iss"
  | "ionosphere"
  | "vanAllen"
  | "heliosphere"
  | "cables"
  | "bitcoinNodes"
  | "gdelt"
  | "aviation"
  | "drying"
  | "pollen"
  | "sea"
  | "snow"
  | "osint";

export type LayerStatusMap = Record<ConnectorKey, LayerStatus>;

/**
 * Unified intelligence layer.
 * Single source of truth combining environmental telemetry (USGS/EMSC/NOAA/NASA),
 * market data, infrastructure registries and OSINT feeds.
 *
 * Each connector owns its own loading/error state; a failing endpoint never
 * blocks the rendering of the other active layers.
 */
export function useUnifiedIntel(activeLayers?: Set<EnvLayerKey>) {
  const on = (k: EnvLayerKey) => (activeLayers ? activeLayers.has(k) : false);

  const realtime = useRealTimeData();
  const osint = useOsintIntel();

  // --- 1. Weather & atmosphere -------------------------------------------
  const rain = useRainViewer(on("precipitation"));
  const surface = useSurfaceWeather(on("wind") || on("isobars") || on("temperature") || on("humidity"));
  // Secado, polen, mar y nieve comparten rejilla y petición batida: se piden
  // juntos si cualquiera de las cuatro capas está encendida.
  const environment = useEnvironmentGrid({
    drying: on("dryingIndex"),
    pollen: on("pollen"),
    sea: on("seaState"),
    snow: on("snowDepth"),
  });

  // --- 2. Seismic & emergencies ------------------------------------------
  const emsc = useEmscQuakes(activeLayers ? on("earthquakes") : true);
  const fires = useFirmsFires(on("wildfires"), "ESP");

  /**
   * FIRMS exige una clave de mapa que este proyecto no tiene configurada, así
   * que su feed llega vacío con la nota "FIRMS map key not configured" y la capa
   * de incendios se quedaba en blanco aunque el resto del globo estuviera vivo.
   * EONET —que ya se pide para los eventos de NASA y es abierto— publica los
   * mismos incendios activos CON coordenadas, así que sirve de respaldo: se
   * prefieren las detecciones de FIRMS cuando existen y, si no, se usan las de
   * EONET, diciendo en cada punto de dónde viene.
   */
  const fireDetections = useMemo(() => {
    if (fires.data.length > 0) return fires.data;
    return realtime.nasaEvents
      .filter((event) => event.category === "Wildfires" && Number.isFinite(event.lat) && Number.isFinite(event.lon))
      .map((event) => ({
        id: `eonet-${event.id}`,
        lat: event.lat,
        lon: event.lon,
        brightness: 0,
        confidence: "EONET · incendio activo",
        acquired: event.date,
        satellite: "EONET",
        source: "NASA EONET",
      }));
  }, [fires.data, realtime.nasaEvents]);

  // --- 3. Space & satellites ---------------------------------------------
  // El óvalo auroral es la huella ionosférica de la magnetosfera: la misma
  // malla de OVATION sirve a las dos capas, así que se pide si cualquiera de
  // las dos está encendida (antes sólo respondía al Kp de `solarActivity`).
  const aurora = useAurora(on("solarActivity") || on("magnetosphere"));
  const sats = useCelestrakSatellites(on("satellites"));
  const iss = useIssPosition(on("iss"));
  const iono = useIonosphere(on("ionosphere"));
  // Van Allen y heliosfera comparten un mismo motivo: lo que rodea a la Tierra
  // se mide desde dentro (GOES, en el cinturón exterior) o desde L1 (el viento
  // solar que infla la burbuja), no desde una órbita dedicada.
  const belts = useVanAllenBelts(on("vanAllen"));
  const solarWind = useSolarWind(on("heliosphere"));

  // --- 4. Infrastructure & blockchain ------------------------------------
  const cables = useSubmarineCables(on("underseaCables"));
  const btcNodes = useBitcoinNodes(on("economicCenters"));

  // --- 5. OSINT & aviation -----------------------------------------------
  const gdelt = useGdeltEvents(on("conflictZones") || on("internetOutages"));
  const aviation = useAdsbTraffic(on("airTraffic"), 15_000);

  /** USGS (global) merged with EMSC (Europe / Iberia), de-duplicated by proximity. */
  const earthquakes = useMemo<Earthquake[]>(() => {
    const merged = [...realtime.earthquakes];
    emsc.data.forEach((q) => {
      const dup = merged.some(
        (m) =>
          Math.abs(m.lat - q.lat) < 0.4 &&
          Math.abs(m.lon - q.lon) < 0.4 &&
          Math.abs(m.time - q.time) < 120_000,
      );
      if (!dup) merged.push(q);
    });
    return merged;
  }, [realtime.earthquakes, emsc.data]);

  const layerStatus = useMemo<LayerStatusMap>(
    () => ({
      rainRadar: toStatus(rain, rain.data.frames.length),
      surfaceWeather: toStatus(surface, surface.data.length),
      quakesEmsc: toStatus(emsc, emsc.data.length),
      fires: {
        loading: fires.loading,
        error: fires.error,
        lastUpdate: fires.lastUpdate,
        count: fireDetections.length,
      },
      aurora: toStatus(aurora, aurora.data.cells.length),
      satellites: {
        loading: sats.loading,
        error: sats.error,
        lastUpdate: null,
        count: sats.positions.length,
      },
      iss: {
        loading: iss.loading,
        error: iss.error,
        lastUpdate: iss.lastUpdate,
        count: Number.isFinite(iss.data.lat) ? 1 : 0,
      },
      ionosphere: toStatus(iono, iono.data.points.length),
      vanAllen: {
        loading: belts.loading,
        error: belts.error,
        lastUpdate: belts.lastUpdate,
        count: belts.data.measuredAt ? 1 : 0,
      },
      heliosphere: toStatus(solarWind, solarWind.data.measuredAt ? 1 : 0),
      cables: toStatus(cables, cables.data.length),
      bitcoinNodes: toStatus(btcNodes, btcNodes.data.length),
      gdelt: toStatus(gdelt, gdelt.data.length),
      aviation: toStatus(aviation, aviation.data.length),
      drying: toStatus(environment, environment.data.drying.length),
      pollen: toStatus(environment, environment.data.pollen.length),
      sea: toStatus(environment, environment.data.sea.length),
      snow: toStatus(environment, environment.data.snow.length),
      osint: {
        loading: osint.isLoading,
        error: osint.error,
        lastUpdate: osint.lastUpdate,
        count: osint.events.length,
      },
    }),
    [rain, surface, emsc, fires, fireDetections, aurora, sats, iss, iono, belts, solarWind, cables, btcNodes, gdelt, aviation, environment, osint],
  );

  // Correlate OSINT critical events with crypto volatility (>5% 24h)
  const correlations = useMemo(() => {
    const volatile = realtime.cryptoPrices.filter((p) => Math.abs(p.change24h ?? 0) > 5);
    const criticalIntel = osint.events.filter(
      (e) => e.severity === "CRITICAL" || e.severity === "HIGH",
    );
    return criticalIntel.map((event) => ({
      event,
      marketImpact: volatile.map((v) => ({
        symbol: v.symbol,
        change24h: v.change24h,
        price: v.price,
      })),
    }));
  }, [realtime.cryptoPrices, osint.events]);

  // Geographic markers from environmental + OSINT (only when coords known)
  const eventMarkers = useMemo<UnifiedHotspotData[]>(() => {
    const markers: UnifiedHotspotData[] = [];

    earthquakes.slice(0, 60).forEach((q) => {
      markers.push({
        lat: q.lat,
        lon: q.lon,
        intensity: Math.min(1, (q.magnitude || 4) / 9),
        color: q.magnitude >= 6 ? "#ff4444" : q.magnitude >= 5 ? "#ff8844" : "#ffff00",
        name: q.place || "Earthquake",
        country: q.id.startsWith("emsc-") ? "EMSC" : "USGS",
        marketVolume: `M${(q.magnitude || 0).toFixed(1)}`,
        trend: `${q.depth}km`,
        topTokens: [],
        type: "quake",
      });
    });

    realtime.nasaEvents.forEach((e) => {
      if (typeof e.lat === "number" && typeof e.lon === "number") {
        markers.push({
          lat: e.lat,
          lon: e.lon,
          intensity: 0.5,
          color: "#00ff41",
          name: e.title || e.category,
          country: "NASA EONET",
          marketVolume: e.category,
          trend: e.date || "",
          topTokens: [],
          type: "nasa",
        });
      }
    });

    realtime.sightings.slice(0, 60).forEach((s) => {
      if (typeof s.lat === "number" && typeof s.lon === "number") {
        markers.push({
          lat: s.lat,
          lon: s.lon,
          intensity: 0.4,
          color: "#ff00ff",
          name: s.location || s.type || "UAP",
          country: s.source || "UAP",
          marketVolume: s.severity || "LOW",
          trend: s.date_reported || "",
          topTokens: [],
          type: "geopolitical",
        });
      }
    });

    return markers;
  }, [earthquakes, realtime.nasaEvents, realtime.sightings]);

  // Unified ticker stream merging OSINT + environmental headlines
  const tickerItems = useMemo<TickerItem[]>(() => {
    const items: TickerItem[] = [];

    osint.events.slice(0, 8).forEach((e) => {
      items.push({
        tag: `[${e.severity}]`,
        text: e.title,
        source: `Source: ${e.source}`,
        time: new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        severity: e.severity,
      });
    });

    [...earthquakes].sort((a, b) => b.magnitude - a.magnitude).slice(0, 4).forEach((q) => {
      items.push({
        tag: "[ALERT]",
        text: `M${q.magnitude.toFixed(1)} earthquake — ${q.place}`,
        source: q.id.startsWith("emsc-") ? "Source: EMSC" : "Source: USGS",
        time: new Date(q.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        severity: q.magnitude >= 6 ? "CRITICAL" : q.magnitude >= 5 ? "HIGH" : "MEDIUM",
      });
    });

    gdelt.data.slice(0, 4).forEach((g) => {
      items.push({
        tag: "[GDELT]",
        text: g.title,
        source: `Source: ${g.domain}`,
        time: g.location || "",
        severity: "LOW",
      });
    });

    realtime.nasaEvents.slice(0, 3).forEach((evt) => {
      items.push({
        tag: "[NASA]",
        text: `${evt.category}: ${evt.title}`,
        source: "Source: NASA EONET",
        time: evt.date
          ? new Date(evt.date).toLocaleDateString([], { month: "short", day: "numeric" })
          : "Active",
        severity: "LOW",
      });
    });

    return items;
  }, [osint.events, earthquakes, realtime.nasaEvents, gdelt.data]);

  const events: IntelEvent[] = useMemo(() => osint.events, [osint.events]);

  return {
    ...realtime,
    earthquakes,
    // Connector payloads
    rainTileUrl: rain.tileUrl,
    rainFrame: rain.latestFrame,
    surfaceWeather: surface.data,
    fires: fireDetections,
    auroraMesh: aurora.data,
    satellites: sats.positions,
    iss: iss.data,
    ionosphere: iono.data,
    vanAllen: belts.data,
    solarWind: solarWind.data,
    cables: cables.data,
    bitcoinNodes: btcNodes.data,
    gdeltEvents: gdelt.data,
    aviation: aviation.data,
    environment: environment.data,
    // OSINT
    osint: osint.events,
    osintLoading: osint.isLoading,
    osintError: osint.error,
    refreshOsint: osint.refresh,
    // Derived
    layerStatus,
    correlations,
    events,
    eventMarkers,
    tickerItems,
  };
}
