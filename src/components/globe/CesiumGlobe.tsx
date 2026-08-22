// @ts-nocheck
import { useEffect, useRef, useCallback, useState } from "react";
import {
  Ion,
  Viewer as CesiumViewer,
  Cartesian3,
  Color,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defined,
  Math as CesiumMath,
  VerticalOrigin,
  HorizontalOrigin,
  NearFarScalar,
  PolylineGlowMaterialProperty,
  Cartesian2,
  ArcGisMapServerImageryProvider,
  IonImageryProvider,
  EllipsoidTerrainProvider,
  CallbackProperty,
  SkyBox,
  buildModuleUrl,
  UrlTemplateImageryProvider,
  ImageryLayer,
  ProviderViewModel,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import type { HotspotData } from "./GlobeScene";
import type { UAPSighting } from "@/hooks/useUAPSightings";
import type { Earthquake } from "@/hooks/useEarthquakes";
import type { NasaEvent } from "@/hooks/useNasaEvents";
import type { Flight } from "@/hooks/useAirTraffic";
import type { Ship } from "@/hooks/useMarineTraffic";
import { GLOBE_LAYERS, type EnvLayerKey } from "@/lib/globe-layers";
import type { SatellitePosition } from "@/hooks/useSatellites";
import type { OutageEvent } from "@/hooks/useInternetOutages";
import {
  CONFLICT_ZONES,
  CONFLICT_ICONS,
  CONFLICT_COLORS,
  CHOKEPOINTS,
  NUCLEAR_SITES,
  MILITARY_BASES,
  ECONOMIC_CENTERS,
  UNDERSEA_CABLES,
  PIPELINES,
} from "@/lib/geo-datasets";

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  "https://wkdtvrxavkhbifjtvvdw.supabase.co";

/** OWM tiles are proxied server-side so the API key never reaches the bundle. */
const OWM_TILE_URL = (layerId: string) =>
  `${SUPABASE_URL}/functions/v1/openweather?tile=${layerId}&z={z}&x={x}&y={y}`;

const OWM_ALPHA: Record<string, number> = {
  clouds_new: 0.75,
  precipitation_new: 0.8,
  pressure_new: 0.7,
  wind_new: 0.65,
  temp_new: 0.7,
};

/**
 * NASA GIBS (open, no API key) — VIIRS thermal anomalies give global wildfire
 * detection including Spain and the rest of Europe, which the EONET point feed
 * misses. GIBS publishes yesterday's full mosaic reliably.
 */
function gibsDate(): string {
  const d = new Date(Date.now() - 36 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

const GIBS_URL = (layer: string, level = 8) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${gibsDate()}/GoogleMapsCompatible_Level${level}/{z}/{y}/{x}.png`;

// The Cesium Ion token is never shipped to the browser bundle; it is fetched
// at runtime from the server-side `cesium-tiles` proxy.

const TACTICAL_COLORS: Record<string, string> = {
  finance: "#FFD700", tech: "#FFD700", uap: "#00FF41", ufo: "#00FF41",
  intel: "#00FF41", conflict: "#FF4444", geopolitical: "#0088FF",
  logistics: "#FF8844", cryptozoology: "#FF00FF", convergence: "#FFFFFF",
};

const HOTSPOT_DATA: HotspotData[] = [
  { lat: 35.7, lon: 51.4, intensity: 1, color: "#FF4444", name: "Tehran", country: "Iran", marketVolume: "$2.1B", trend: "-12%", topTokens: ["USDT", "BTC"], type: "conflict" },
  { lat: 32.0, lon: 34.8, intensity: 0.9, color: "#FF4444", name: "Tel Aviv", country: "Israel", marketVolume: "$8.4B", trend: "+5%", topTokens: ["ETH", "MATIC"], type: "conflict" },
  { lat: 29.3, lon: 47.9, intensity: 0.7, color: "#0088FF", name: "Kuwait City", country: "Kuwait", marketVolume: "$1.2B", trend: "+2%", topTokens: ["BTC", "BNB"], type: "geopolitical" },
  { lat: 26.2, lon: 50.5, intensity: 0.6, color: "#FFD700", name: "Manama", country: "Bahrain", marketVolume: "$0.8B", trend: "+8%", topTokens: ["BTC", "XRP"], type: "finance" },
  { lat: 24.4, lon: 54.6, intensity: 0.5, color: "#FFD700", name: "Abu Dhabi", country: "UAE", marketVolume: "$14.2B", trend: "+15%", topTokens: ["BTC", "ETH", "SOL"], type: "finance" },
  { lat: 51.5, lon: -0.1, intensity: 0.4, color: "#FFD700", name: "London", country: "UK", marketVolume: "$42.1B", trend: "+3%", topTokens: ["BTC", "ETH", "LINK"], type: "finance" },
  { lat: 48.8, lon: 2.3, intensity: 0.3, color: "#FFD700", name: "Paris", country: "France", marketVolume: "$12.8B", trend: "+1%", topTokens: ["BTC", "ETH"], type: "tech" },
  { lat: 52.5, lon: 13.4, intensity: 0.3, color: "#FFD700", name: "Berlin", country: "Germany", marketVolume: "$9.5B", trend: "+4%", topTokens: ["BTC", "DOT"], type: "tech" },
  { lat: 40.7, lon: -74.0, intensity: 0.5, color: "#FFD700", name: "New York", country: "USA", marketVolume: "$89.3B", trend: "+7%", topTokens: ["BTC", "ETH", "SOL", "DOGE"], type: "finance" },
  { lat: 38.9, lon: -77.0, intensity: 0.6, color: "#0088FF", name: "Washington DC", country: "USA", marketVolume: "$5.2B", trend: "+2%", topTokens: ["BTC", "ETH"], type: "geopolitical" },
  { lat: 34.0, lon: -118.2, intensity: 0.3, color: "#FFD700", name: "Los Angeles", country: "USA", marketVolume: "$18.7B", trend: "+6%", topTokens: ["SOL", "AVAX"], type: "tech" },
  { lat: 39.9, lon: 116.4, intensity: 0.7, color: "#0088FF", name: "Beijing", country: "China", marketVolume: "$35.6B", trend: "-3%", topTokens: ["BTC", "ETH"], type: "geopolitical" },
  { lat: 35.6, lon: 139.6, intensity: 0.4, color: "#FFD700", name: "Tokyo", country: "Japan", marketVolume: "$28.4B", trend: "+9%", topTokens: ["BTC", "XRP", "ASTR"], type: "finance" },
  { lat: 37.5, lon: 127.0, intensity: 0.3, color: "#FFD700", name: "Seoul", country: "South Korea", marketVolume: "$22.1B", trend: "+11%", topTokens: ["BTC", "ETH", "XRP"], type: "tech" },
  { lat: 55.7, lon: 37.6, intensity: 0.5, color: "#0088FF", name: "Moscow", country: "Russia", marketVolume: "$4.8B", trend: "-8%", topTokens: ["BTC", "USDT"], type: "geopolitical" },
  { lat: 48.7, lon: 37.5, intensity: 0.8, color: "#FF4444", name: "Donetsk", country: "Ukraine", marketVolume: "$0.1B", trend: "-25%", topTokens: ["USDT"], type: "conflict" },
];

const ARC_PAIRS = [[0, 5], [3, 8], [11, 13], [14, 6], [7, 12]];

const SEVERITY_SIZE: Record<string, number> = {
  critical: 14, high: 11, medium: 8, low: 6, signal: 5,
};

function hexToColor(hex: string, alpha = 1): Color {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return new Color(r, g, b, alpha);
}

/** Categories controlled by the tactical legend. Keep this aligned with LegendPanel. */
export type TacticalLayerKey =
  | "finance"
  | "intel"
  | "conflict"
  | "geopolitical"
  | "logistics"
  | "cryptozoo"
  | "convergence";

function tacticalLayerForCategory(category: string): TacticalLayerKey {
  switch (category) {
    case "tech":
    case "market":
    case "finance":
      return "finance";
    case "uap":
    case "ufo":
    case "intel":
      return "intel";
    case "cryptozoology":
      return "cryptozoo";
    case "chokepoint":
    case "logistics":
      return "logistics";
    case "geopolitical":
      return "geopolitical";
    case "conflict":
      return "conflict";
    default:
      return "convergence";
  }
}

interface CesiumGlobeProps {
  onHotspotClick?: (data: HotspotData | null) => void;
  sightings?: UAPSighting[];
  visibleLayers?: Set<TacticalLayerKey>;
  envLayers?: Set<EnvLayerKey>;
  flyTo?: { lat: number; lon: number; alt: number } | null;
  kpIndex?: number;
  earthquakes?: Earthquake[];
  nasaEvents?: NasaEvent[];
  flights?: Flight[];
  ships?: Ship[];
  satellites?: SatellitePosition[];
  outages?: OutageEvent[];
}

export function CesiumGlobe({
  onHotspotClick, sightings = [], visibleLayers, envLayers, flyTo, kpIndex = 0,
  earthquakes = [], nasaEvents = [], flights = [], ships = [],
  satellites = [], outages = [],
}: CesiumGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumViewer | null>(null);
  const owmLayersRef = useRef<Record<string, any>>({});
  const gibsLayersRef = useRef<Record<string, any>>({});
  const sightingEntityIdsRef = useRef<string[]>([]);
  const marketEntityIdsRef = useRef<string[]>([]);
  const arcEntityIdsRef = useRef<string[]>([]);
  const teslaAuraRef = useRef<string[]>([]);
  const quakeEntityIdsRef = useRef<string[]>([]);
  const nasaEntityIdsRef = useRef<string[]>([]);
  const flightEntityIdsRef = useRef<string[]>([]);
  const shipEntityIdsRef = useRef<string[]>([]);
  const staticEntityIdsRef = useRef<string[]>([]);
  const satEntityIdsRef = useRef<string[]>([]);
  const outageEntityIdsRef = useRef<string[]>([]);

  const handleHotspotClick = useCallback(
    (data: HotspotData | null) => { onHotspotClick?.(data); },
    [onHotspotClick]
  );

  // Initialize viewer once
  useEffect(() => {
    if (!containerRef.current) return;
    Ion.defaultAccessToken = "";

    const viewer = new CesiumViewer(containerRef.current, {
      animation: false, baseLayerPicker: false, fullscreenButton: false,
      geocoder: false, homeButton: false, infoBox: false, sceneModePicker: false,
      selectionIndicator: false, timeline: false, navigationHelpButton: false,
      creditContainer: document.createElement("div"),
      terrainProvider: new EllipsoidTerrainProvider(),
      contextOptions: { webgl: { alpha: false } },
      // Start with no base layer so async imagery never wipes overlays that
      // were already added (that race made toggled-on layers invisible).
      baseLayer: false as any,
    });

    // Enable built-in Cesium sky with stars and atmosphere
    viewer.scene.backgroundColor = Color.BLACK;
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.atmosphereLightIntensity = 8.0;

    // Enable sky atmosphere (the glow halo around the Earth)
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = true;
      viewer.scene.skyAtmosphere.brightnessShift = 0.05;
      viewer.scene.skyAtmosphere.hueShift = -0.05;
      viewer.scene.skyAtmosphere.saturationShift = 0.2;
    }

    // Enable sun and moon
    if (viewer.scene.sun) viewer.scene.sun.show = true;
    if (viewer.scene.moon) viewer.scene.moon.show = true;

    // Dense star field skybox (bundled Tycho star catalog — no CORS dependency)
    try {
      viewer.scene.skyBox = new SkyBox({
        sources: {
          positiveX: buildModuleUrl("Assets/Textures/SkyBox/tycho2t3_80_px.jpg"),
          negativeX: buildModuleUrl("Assets/Textures/SkyBox/tycho2t3_80_mx.jpg"),
          positiveY: buildModuleUrl("Assets/Textures/SkyBox/tycho2t3_80_py.jpg"),
          negativeY: buildModuleUrl("Assets/Textures/SkyBox/tycho2t3_80_my.jpg"),
          positiveZ: buildModuleUrl("Assets/Textures/SkyBox/tycho2t3_80_pz.jpg"),
          negativeZ: buildModuleUrl("Assets/Textures/SkyBox/tycho2t3_80_mz.jpg"),
        },
      });
    } catch (e) {
      console.warn("Skybox init failed, using default stars:", e);
    }

    // NO atmosphere ellipsoid entity — using Cesium's built-in skyAtmosphere instead

    viewerRef.current = viewer;

    // Deterministic async init: base → night lights → (env layers effect runs separately).
    // No parallel .then() chains — everything is awaited in order so removeAll() never
    // wipes overlays that a faster-resolving promise might have already added.
    (async () => {
      try {
        // 1. Clear any default layers ONCE at the start.
        viewer.imageryLayers.removeAll();

        // 2. Base satellite imagery FIRST (bottom of stack).
        const baseProvider = await ArcGisMapServerImageryProvider.fromUrl(
          "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer"
        );
        if (viewer.isDestroyed()) return;
        const baseLayer = viewer.imageryLayers.addImageryProvider(baseProvider);
        viewer.imageryLayers.lowerToBottom(baseLayer);

        // 3. Night lights SECOND (above base, below weather overlays).
        try {
          const nlProvider = await IonImageryProvider.fromAssetId(3812);
          if (viewer.isDestroyed()) return;
          const nl = viewer.imageryLayers.addImageryProvider(nlProvider);
          nl.dayAlpha = 0.0;
          nl.nightAlpha = 0.9;
          nl.brightness = 2.0;
          viewer.imageryLayers.lowerToBottom(nl);
          viewer.imageryLayers.raise(nl);
        } catch (e: any) {
          console.warn("Night lights failed:", e);
        }
      } catch (e: any) {
        console.warn("ArcGIS base imagery failed:", e);
      }
    })();

    // Click handler
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: any) => {
      const picked = viewer.scene.pick(click.position);
      if (defined(picked) && picked.id?.properties) {
        const idx = picked.id.properties.hotspotIndex?.getValue();
        if (idx !== undefined && HOTSPOT_DATA[idx]) {
          handleHotspotClick(HOTSPOT_DATA[idx]);
          return;
        }
        const sightingData = picked.id.properties.sightingData?.getValue();
        if (sightingData) {
          try {
            const parsed = JSON.parse(sightingData);
            handleHotspotClick({
              lat: parsed.lat, lon: parsed.lon,
              intensity: parsed.severity === "critical" ? 1 : 0.5,
              color: TACTICAL_COLORS[parsed.category] || "#00FF41",
              name: parsed.location, country: parsed.category?.toUpperCase() || "UAP",
              marketVolume: parsed.source || "Unknown", trend: parsed.date_reported || "",
              topTokens: [parsed.type || "unknown"], type: parsed.category || "uap",
            });
          } catch { /* ignore */ }
          return;
        }
      }
      handleHotspotClick(null);
    }, ScreenSpaceEventType.LEFT_CLICK);

    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(20, 20, 20000000),
      orientation: { heading: CesiumMath.toRadians(0), pitch: CesiumMath.toRadians(-90), roll: 0 },
      duration: 0,
    });

    return () => {
      handler.destroy();
      if (!viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
    };
  }, [handleHotspotClick]);

  // Environmental imagery overlays (OpenWeatherMap via secure proxy)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const active = envLayers ?? new Set<EnvLayerKey>();
    
    console.log("[CesiumGlobe] envLayers changed:", Array.from(active));

    GLOBE_LAYERS.filter((l) => l.owm).forEach((def) => {
      const id = def.owm as string;
      const existing = owmLayersRef.current[id];
      const shouldShow = active.has(def.key);
      const alpha = OWM_ALPHA[id] ?? 0.7;

      if (shouldShow && !existing) {
        try {
          const imageryProvider = new UrlTemplateImageryProvider({
            url: OWM_TILE_URL(id),
            maximumLevel: 10,
            minimumLevel: 0,
            credit: "OpenWeatherMap",
          });
          const layer = viewer.imageryLayers.addImageryProvider(imageryProvider);
          layer.alpha = alpha;
          owmLayersRef.current[id] = layer;
        } catch (e) {
          console.error("[CesiumGlobe] OWM layer add FAILED:", id, e);
        }
      } else if (existing) {
        try {
          existing.show = shouldShow;
          existing.alpha = shouldShow ? alpha : 0;
        } catch (e) {
          console.error("[CesiumGlobe] OWM layer toggle FAILED:", id, e);
        }
      }
    });

    // NASA GIBS imagery overlays (no key required).
    const GIBS_OVERLAYS: { key: EnvLayerKey; layer: string; alpha: number; level?: number }[] = [
      { key: "wildfires", layer: "VIIRS_NOAA20_Thermal_Anomalies_375m_All", alpha: 0.95, level: 8 },
      { key: "solarActivity", layer: "VIIRS_SNPP_DayNightBand_At_Sensor_Radiance", alpha: 0.35, level: 8 },
    ];
    GIBS_OVERLAYS.forEach(({ key, layer: layerId, alpha, level }) => {
      const shouldShow = active.has(key);
      const existing = gibsLayersRef.current[layerId];
      if (shouldShow && !existing) {
        try {
          const provider = new UrlTemplateImageryProvider({
            url: GIBS_URL(layerId, level),
            maximumLevel: level ?? 8,
            minimumLevel: 0,
            credit: "NASA GIBS / EOSDIS",
          });
          const l = viewer.imageryLayers.addImageryProvider(provider);
          l.alpha = alpha;
          gibsLayersRef.current[layerId] = l;
        } catch (e) {
          console.error("[CesiumGlobe] GIBS layer add failed:", layerId, e);
        }
      } else if (existing) {
        existing.show = shouldShow;
        existing.alpha = shouldShow ? alpha : 0;
      }
    });

    // Atmosphere halo toggle
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = active.has("atmosphere");
    }
  }, [envLayers]);

  // Tesla Aurora — dynamic polar rings reacting to Kp + solarActivity layer toggle
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // Clean previous aurora entities
    teslaAuraRef.current.forEach(id => {
      const e = viewer.entities.getById(id);
      if (e) viewer.entities.remove(e);
    });
    teslaAuraRef.current = [];

    const active = envLayers ?? new Set<EnvLayerKey>();
    if (kpIndex <= 3 || !active.has("solarActivity")) return;

    const intensity = Math.min((kpIndex - 3) / 6, 1);
    const startTime = Date.now();

    // Create aurora ring bands at both poles
    const poles = [
      { lat: 67, suffix: "n", colors: ["#00FFCC", "#7B2FFF", "#00FF41"] },
      { lat: -67, suffix: "s", colors: ["#7B2FFF", "#00FFCC", "#FF00FF"] },
    ];

    poles.forEach(({ lat, suffix, colors }) => {
      // Multiple thin rings at different latitudes to simulate aurora oval
      for (let ring = 0; ring < 3; ring++) {
        const ringLat = lat + (lat > 0 ? -ring * 3 : ring * 3);
        const entityId = `aurora-${suffix}-${ring}`;
        const baseRadius = 400000 + ring * 200000;
        const color = colors[ring];

        viewer.entities.add({
          id: entityId,
          position: Cartesian3.fromDegrees(0, ringLat, 80000 + ring * 30000),
          ellipse: {
            semiMajorAxis: new CallbackProperty(() => {
              // Quantize time so major/minor callbacks always agree within a frame
              const t = Math.floor((Date.now() - startTime) / 50) * 50;
              const pulse = 1 + 0.15 * Math.sin(((t % 6000) / 6000) * Math.PI * 2 + ring);
              return baseRadius * pulse;
            }, false) as any,
            semiMinorAxis: new CallbackProperty(() => {
              const t = Math.floor((Date.now() - startTime) / 50) * 50;
              const pulse = 1 + 0.15 * Math.sin(((t % 6000) / 6000) * Math.PI * 2 + ring);
              return baseRadius * pulse * 0.6;
            }, false) as any,
            material: hexToColor(color, 0.03 + intensity * 0.05),
            outline: true,
            outlineColor: hexToColor(color, 0.08 + intensity * 0.12),
            outlineWidth: 1,
            height: 80000 + ring * 30000,
          },
        });
        teslaAuraRef.current.push(entityId);
      }
    });
  }, [kpIndex, envLayers]);

  // Earthquake entities — pulsing red rings
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    quakeEntityIdsRef.current.forEach(id => {
      const e = viewer.entities.getById(id);
      if (e) viewer.entities.remove(e);
    });
    quakeEntityIdsRef.current = [];

    const significant = earthquakes.filter(q => q.magnitude >= 2.5).slice(0, 100);

    significant.forEach((q, i) => {
      const entityId = `quake-${i}`;
      const baseRadius = Math.max(20000, q.magnitude * 30000);
      const startTime = Date.now();

      viewer.entities.add({
        id: entityId,
        position: Cartesian3.fromDegrees(q.lon, q.lat, 0),
        ellipse: {
          semiMajorAxis: new CallbackProperty(() => {
            const t = Math.floor((Date.now() - startTime) / 50) * 50;
            const pulse = 1 + 0.3 * Math.sin(((t % 4000) / 4000) * Math.PI * 2);
            return baseRadius * pulse;
          }, false) as any,
          semiMinorAxis: new CallbackProperty(() => {
            const t = Math.floor((Date.now() - startTime) / 50) * 50;
            const pulse = 1 + 0.3 * Math.sin(((t % 4000) / 4000) * Math.PI * 2);
            return baseRadius * pulse * 0.98;
          }, false) as any,
          material: Color.fromCssColorString("#FF4444").withAlpha(
            Math.min(0.6, q.magnitude / 10)
          ),
          outline: true,
          outlineColor: Color.fromCssColorString("#FF4444").withAlpha(0.8),
          outlineWidth: 1,
          height: 0,
        },
        label: q.magnitude >= 4.5 ? {
          text: `${q.magnitude.toFixed(1)}`,
          font: "9px monospace",
          fillColor: Color.fromCssColorString("#FF4444"),
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          style: 2,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian2(0, -8),
          scaleByDistance: new NearFarScalar(1e6, 0.8, 1e8, 0.2),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        } : undefined,
      });
      quakeEntityIdsRef.current.push(entityId);
    });
  }, [earthquakes]);

  // NASA EONET events — yellow warning points
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    nasaEntityIdsRef.current.forEach(id => {
      const e = viewer.entities.getById(id);
      if (e) viewer.entities.remove(e);
    });
    nasaEntityIdsRef.current = [];

    nasaEvents.forEach((evt, i) => {
      const entityId = `nasa-${i}`;
      const isWildfire = evt.category.toLowerCase().includes("wildfire") || evt.category.toLowerCase().includes("fire");
      const color = isWildfire ? "#FF8844" : "#FFDD00";
      const emoji = isWildfire ? "🔥" : "⚠️";

      viewer.entities.add({
        id: entityId,
        position: Cartesian3.fromDegrees(evt.lon, evt.lat, 0),
        point: {
          pixelSize: 7,
          color: hexToColor(color, 0.85),
          outlineColor: hexToColor(color, 0.4),
          outlineWidth: 3,
          scaleByDistance: new NearFarScalar(1e6, 1.2, 1e8, 0.4),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `${emoji} ${evt.title.substring(0, 20)}`,
          font: "9px monospace",
          fillColor: hexToColor(color, 0.9),
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          style: 2,
          verticalOrigin: VerticalOrigin.BOTTOM,
          horizontalOrigin: HorizontalOrigin.CENTER,
          pixelOffset: new Cartesian2(0, -10),
          scaleByDistance: new NearFarScalar(1e6, 0.8, 1e8, 0.15),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      nasaEntityIdsRef.current.push(entityId);
    });
  }, [nasaEvents]);

  // Market hotspots layer
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    marketEntityIdsRef.current.forEach(id => {
      const e = viewer.entities.getById(id); if (e) viewer.entities.remove(e);
    });
    arcEntityIdsRef.current.forEach(id => {
      const e = viewer.entities.getById(id); if (e) viewer.entities.remove(e);
    });
    marketEntityIdsRef.current = [];
    arcEntityIdsRef.current = [];

    const visibleSpotIndexes = new Set<number>();
    HOTSPOT_DATA.forEach((spot, idx) => {
      if (visibleLayers && !visibleLayers.has(tacticalLayerForCategory(spot.type))) return;
      visibleSpotIndexes.add(idx);
      const entityId = `market-${idx}`;
      const tacticalColor = TACTICAL_COLORS[spot.type] || spot.color;
      viewer.entities.add({
        id: entityId,
        position: Cartesian3.fromDegrees(spot.lon, spot.lat, 0),
        point: {
          pixelSize: 8 + spot.intensity * 12,
          color: hexToColor(tacticalColor, 0.85),
          outlineColor: hexToColor(tacticalColor, 0.4),
          outlineWidth: 3,
          scaleByDistance: new NearFarScalar(1e6, 1.2, 1e8, 0.4),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: spot.name, font: "11px monospace",
          fillColor: Color.fromCssColorString(tacticalColor),
          outlineColor: Color.BLACK, outlineWidth: 2, style: 2,
          verticalOrigin: VerticalOrigin.BOTTOM,
          horizontalOrigin: HorizontalOrigin.CENTER,
          pixelOffset: new Cartesian2(0, -14),
          scaleByDistance: new NearFarScalar(1e6, 1, 1e8, 0.3),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: { hotspotIndex: idx } as any,
      });
      marketEntityIdsRef.current.push(entityId);
    });

    ARC_PAIRS.forEach(([a, b], arcIdx) => {
      if (!HOTSPOT_DATA[a] || !HOTSPOT_DATA[b] || !visibleSpotIndexes.has(a) || !visibleSpotIndexes.has(b)) return;
      const start = HOTSPOT_DATA[a], end = HOTSPOT_DATA[b];
      const arcPoints: Cartesian3[] = [];
      for (let i = 0; i <= 50; i++) {
        const t = i / 50;
        arcPoints.push(Cartesian3.fromDegrees(
          start.lon + (end.lon - start.lon) * t,
          start.lat + (end.lat - start.lat) * t,
          Math.sin(t * Math.PI) * 500000
        ));
      }
      const arcId = `arc-${arcIdx}`;
      viewer.entities.add({
        id: arcId,
        polyline: {
          positions: arcPoints, width: 1.5,
          material: new PolylineGlowMaterialProperty({ glowPower: 0.3, color: Color.fromCssColorString("#FFD700").withAlpha(0.3) }),
        },
      });
      arcEntityIdsRef.current.push(arcId);
    });
  }, [visibleLayers]);

  // Sighting entities
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    sightingEntityIdsRef.current.forEach((id) => {
      const entity = viewer.entities.getById(id);
      if (entity) viewer.entities.remove(entity);
    });
    sightingEntityIdsRef.current = [];

    sightings.forEach((s) => {
      if (s.lat == null || s.lon == null) return;
      const cat = (s.category as string) || "uap";
      if (visibleLayers && !visibleLayers.has(tacticalLayerForCategory(cat))) return;
      const colorHex = TACTICAL_COLORS[cat] || "#00FF41";
      const size = SEVERITY_SIZE[s.severity || "signal"] || 6;
      const entityId = `sighting-${s.id}`;
      viewer.entities.add({
        id: entityId,
        position: Cartesian3.fromDegrees(s.lon, s.lat, 0),
        point: {
          pixelSize: size,
          color: hexToColor(colorHex, 0.9),
          outlineColor: hexToColor(colorHex, 0.3),
          outlineWidth: size * 0.6,
          scaleByDistance: new NearFarScalar(1e6, 1.4, 1e8, 0.5),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `${cat === "cryptozoology" ? "🦎" : cat === "ufo" ? "🛸" : "◉"} ${s.location?.split(",")[0] || ""}`,
          font: "10px monospace", fillColor: hexToColor(colorHex, 0.9),
          outlineColor: Color.BLACK, outlineWidth: 2, style: 2,
          verticalOrigin: VerticalOrigin.BOTTOM,
          horizontalOrigin: HorizontalOrigin.CENTER,
          pixelOffset: new Cartesian2(0, -12),
          scaleByDistance: new NearFarScalar(1e6, 0.9, 1e8, 0.2),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: {
          sightingData: JSON.stringify({
            lat: s.lat, lon: s.lon, location: s.location, description: s.description,
            type: s.type, severity: s.severity, source: s.source, category: s.category,
            date_reported: s.date_reported,
          }),
        } as any,
      });
      sightingEntityIdsRef.current.push(entityId);
    });
  }, [sightings, visibleLayers]);

  // Fly-to
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !flyTo) return;
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(flyTo.lon, flyTo.lat, flyTo.alt),
      orientation: { heading: CesiumMath.toRadians(0), pitch: CesiumMath.toRadians(-90), roll: 0 },
      duration: 1.5,
    });
  }, [flyTo]);

  // Air Traffic layer — aircraft markers from OpenSky Network
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    
    const active = envLayers ?? new Set<EnvLayerKey>();
    if (!active.has("airTraffic")) {
      // Clean up if layer disabled
      flightEntityIdsRef.current.forEach(id => {
        const e = viewer.entities.getById(id);
        if (e) viewer.entities.remove(e);
      });
      flightEntityIdsRef.current = [];
      return;
    }

    // Remove old entities
    flightEntityIdsRef.current.forEach(id => {
      const e = viewer.entities.getById(id);
      if (e) viewer.entities.remove(e);
    });
    flightEntityIdsRef.current = [];

    // Add flight markers
    flights.forEach((flight, i) => {
      if (!Number.isFinite(flight.latitude) || !Number.isFinite(flight.longitude)) return;
      
      const entityId = `flight-${i}`;
      viewer.entities.add({
        id: entityId,
        position: Cartesian3.fromDegrees(flight.longitude, flight.latitude, flight.altitude),
        point: {
          pixelSize: 4,
          color: hexToColor("#00FFFF", 0.9),
          outlineColor: hexToColor("#FFFFFF", 0.5),
          outlineWidth: 1,
          scaleByDistance: new NearFarScalar(1e6, 1.5, 1e8, 0.3),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `${flight.callsign}`,
          font: "8px monospace",
          fillColor: hexToColor("#00FFFF", 0.8),
          outlineColor: Color.BLACK,
          outlineWidth: 1,
          style: 2,
          verticalOrigin: VerticalOrigin.BOTTOM,
          horizontalOrigin: HorizontalOrigin.CENTER,
          pixelOffset: new Cartesian2(0, -8),
          scaleByDistance: new NearFarScalar(1e5, 0.8, 5e6, 0.1),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      flightEntityIdsRef.current.push(entityId);
    });
  }, [flights, envLayers]);

  // Marine Traffic layer — ship markers from VesselFinder
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const active = envLayers ?? new Set<EnvLayerKey>();
    if (!active.has("marineTraffic")) {
      // Clean up if layer disabled
      shipEntityIdsRef.current.forEach(id => {
        const e = viewer.entities.getById(id);
        if (e) viewer.entities.remove(e);
      });
      shipEntityIdsRef.current = [];
      return;
    }

    // Remove old entities
    shipEntityIdsRef.current.forEach(id => {
      const e = viewer.entities.getById(id);
      if (e) viewer.entities.remove(e);
    });
    shipEntityIdsRef.current = [];

    // Add ship markers
    ships.forEach((ship, i) => {
      if (!Number.isFinite(ship.latitude) || !Number.isFinite(ship.longitude)) return;
      
      const entityId = `ship-${i}`;
      viewer.entities.add({
        id: entityId,
        position: Cartesian3.fromDegrees(ship.longitude, ship.latitude, 0),
        point: {
          pixelSize: 6,
          color: hexToColor("#38BDF8", 0.9),
          outlineColor: hexToColor("#FFFFFF", 0.5),
          outlineWidth: 1,
          scaleByDistance: new NearFarScalar(1e6, 1.5, 1e8, 0.3),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `${ship.name || ship.type}`,
          font: "8px monospace",
          fillColor: hexToColor("#38BDF8", 0.8),
          outlineColor: Color.BLACK,
          outlineWidth: 1,
          style: 2,
          verticalOrigin: VerticalOrigin.BOTTOM,
          horizontalOrigin: HorizontalOrigin.CENTER,
          pixelOffset: new Cartesian2(0, -8),
          scaleByDistance: new NearFarScalar(1e5, 0.8, 5e6, 0.1),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      shipEntityIdsRef.current.push(entityId);
    });
  }, [ships, envLayers]);

  // Conflicts + strategic infrastructure (static registries, Liveuamap-style)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const active = envLayers ?? new Set<EnvLayerKey>();

    staticEntityIdsRef.current.forEach((id) => {
      const e = viewer.entities.getById(id);
      if (e) viewer.entities.remove(e);
    });
    staticEntityIdsRef.current = [];

    const addPoint = (
      id: string, lat: number, lon: number, color: string, label: string,
      size: number, payload?: Record<string, unknown>,
    ) => {
      viewer.entities.add({
        id,
        position: Cartesian3.fromDegrees(lon, lat, 0),
        point: {
          pixelSize: size,
          color: hexToColor(color, 0.9),
          outlineColor: hexToColor(color, 0.35),
          outlineWidth: 4,
          scaleByDistance: new NearFarScalar(1e6, 1.3, 1e8, 0.45),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: label,
          font: "10px monospace",
          fillColor: hexToColor(color, 0.95),
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          style: 2,
          verticalOrigin: VerticalOrigin.BOTTOM,
          horizontalOrigin: HorizontalOrigin.CENTER,
          pixelOffset: new Cartesian2(0, -12),
          scaleByDistance: new NearFarScalar(1e6, 0.9, 1e8, 0.2),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: payload ? ({ sightingData: JSON.stringify(payload) } as any) : undefined,
      });
      staticEntityIdsRef.current.push(id);
    };

    if (active.has("conflictZones")) {
      CONFLICT_ZONES.forEach((c) => {
        addPoint(
          `conflict-${c.id}`, c.lat, c.lon, CONFLICT_COLORS[c.category],
          `${CONFLICT_ICONS[c.category]} ${c.name}`,
          7 + c.intensity * 7,
          {
            lat: c.lat, lon: c.lon, location: `${c.name} — ${c.country}`,
            description: `${c.brief} · Reliability ${c.reliability}%`,
            type: c.category, severity: c.intensity > 0.8 ? "critical" : "high",
            source: c.source, category: "conflict", date_reported: "live",
          },
        );
      });
    }

    if (active.has("chokepoints")) {
      CHOKEPOINTS.forEach((p) =>
        addPoint(`choke-${p.id}`, p.lat, p.lon, "#ea580c", `⚓ ${p.name}`, 8, {
          lat: p.lat, lon: p.lon, location: p.name, description: p.detail,
          type: "chokepoint", severity: "medium", source: "WorldMonitor registry",
          category: "logistics", date_reported: "static",
        }),
      );
    }
    if (active.has("nuclearSites")) {
      NUCLEAR_SITES.forEach((p) =>
        addPoint(`nuke-${p.id}`, p.lat, p.lon, "#7c3aed", `☢️ ${p.name}`, 8, {
          lat: p.lat, lon: p.lon, location: p.name, description: p.detail,
          type: "nuclear", severity: "high", source: "WorldMonitor registry",
          category: "geopolitical", date_reported: "static",
        }),
      );
    }
    if (active.has("militaryBases")) {
      MILITARY_BASES.forEach((p) =>
        addPoint(`mil-${p.id}`, p.lat, p.lon, "#94a3b8", `🛡️ ${p.name}`, 7, {
          lat: p.lat, lon: p.lon, location: p.name, description: p.detail,
          type: "military", severity: "medium", source: "WorldMonitor registry",
          category: "geopolitical", date_reported: "static",
        }),
      );
    }
    if (active.has("economicCenters")) {
      ECONOMIC_CENTERS.forEach((p) =>
        addPoint(`eco-${p.id}`, p.lat, p.lon, "#10b981", `💹 ${p.name}`, 7, {
          lat: p.lat, lon: p.lon, location: p.name, description: p.detail,
          type: "market", severity: "low", source: "WorldMonitor registry",
          category: "finance", date_reported: "static",
        }),
      );
    }

    const addLine = (id: string, path: [number, number][], color: string, name: string) => {
      viewer.entities.add({
        id,
        polyline: {
          positions: path.map(([lon, lat]) => Cartesian3.fromDegrees(lon, lat, 20000)),
          width: 2,
          material: new PolylineGlowMaterialProperty({
            glowPower: 0.25,
            color: Color.fromCssColorString(color).withAlpha(0.6),
          }),
        },
        properties: { cableName: name } as any,
      });
      staticEntityIdsRef.current.push(id);
    };

    if (active.has("underseaCables")) {
      UNDERSEA_CABLES.forEach((c) => addLine(`cable-${c.id}`, c.path, "#0891b2", c.name));
    }
    if (active.has("pipelines")) {
      PIPELINES.forEach((p) => addLine(`pipe-${p.id}`, p.path, "#ca8a04", p.name));
    }
  }, [envLayers]);

  // Orbital surveillance — propagated TLEs
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    satEntityIdsRef.current.forEach((id) => {
      const e = viewer.entities.getById(id);
      if (e) viewer.entities.remove(e);
    });
    satEntityIdsRef.current = [];

    satellites.forEach((s) => {
      if (!Number.isFinite(s.lat) || !Number.isFinite(s.lon)) return;
      const entityId = `satellite-${s.id}`;
      viewer.entities.add({
        id: entityId,
        position: Cartesian3.fromDegrees(s.lon, s.lat, Math.max(0, s.altKm) * 1000),
        point: {
          pixelSize: 4,
          color: hexToColor("#8b5cf6", 0.95),
          outlineColor: hexToColor("#c4b5fd", 0.4),
          outlineWidth: 2,
          scaleByDistance: new NearFarScalar(1e6, 1.4, 1e8, 0.5),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: s.name,
          font: "8px monospace",
          fillColor: hexToColor("#c4b5fd", 0.85),
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          style: 2,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian2(0, -8),
          scaleByDistance: new NearFarScalar(1e6, 0.7, 3e7, 0.1),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      satEntityIdsRef.current.push(entityId);
    });
  }, [satellites]);

  // Internet outages (IODA)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    outageEntityIdsRef.current.forEach((id) => {
      const e = viewer.entities.getById(id);
      if (e) viewer.entities.remove(e);
    });
    outageEntityIdsRef.current = [];

    outages.forEach((o) => {
      const entityId = `outage-${o.code}`;
      viewer.entities.add({
        id: entityId,
        position: Cartesian3.fromDegrees(o.lon, o.lat, 0),
        ellipse: {
          semiMajorAxis: 260000,
          semiMinorAxis: 260000,
          material: hexToColor("#dc2626", 0.15),
          outline: true,
          outlineColor: hexToColor("#dc2626", 0.6),
          height: 0,
        },
        label: {
          text: `📡 ${o.name} (${o.events})`,
          font: "10px monospace",
          fillColor: hexToColor("#fca5a5", 0.95),
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          style: 2,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian2(0, -10),
          scaleByDistance: new NearFarScalar(1e6, 0.9, 1e8, 0.2),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: {
          sightingData: JSON.stringify({
            lat: o.lat, lon: o.lon, location: o.name,
            description: `${o.events} internet disruption events in the last 24h`,
            type: "outage", severity: "medium", source: "IODA / Georgia Tech",
            category: "intel", date_reported: "24h",
          }),
        } as any,
      });
      outageEntityIdsRef.current.push(entityId);
    });
  }, [outages]);

  return (
    <div ref={containerRef} className="w-full h-full" style={{ background: "#000000" }} />
  );
}
