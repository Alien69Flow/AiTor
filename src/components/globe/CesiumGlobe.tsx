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
  UrlTemplateImageryProvider,
  Credit,
  PinBuilder,
  SkyBox,
  Sun,
  Moon,
  SkyAtmosphere,
  buildModuleUrl,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import type { HotspotData } from "./GlobeScene";
import type { UAPSighting } from "@/hooks/useUAPSightings";
import type { Earthquake } from "@/hooks/useEarthquakes";
import type { NasaEvent } from "@/hooks/useNasaEvents";

// Cesium Ion token MUST NOT live in the client bundle. We fetch a
// short-lived access token from the `cesium-tiles` edge function at
// runtime (see fetchCesiumToken below).
const SUPABASE_URL_BASE =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  "https://wkdtvrxavkhbifjtvvdw.supabase.co";

async function fetchCesiumToken(): Promise<string> {
  try {
    const anon =
      (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
      (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
      "";
    const r = await fetch(`${SUPABASE_URL_BASE}/functions/v1/cesium-tiles`, {
      headers: anon ? { apikey: anon, Authorization: `Bearer ${anon}` } : {},
    });
    if (!r.ok) return "";
    const d = await r.json();
    return (d?.accessToken as string) || "";
  } catch {
    return "";
  }
}

const TACTICAL_COLORS: Record<string, string> = {
  finance: "#FFD700", tech: "#FFD700", uap: "#00FF41", ufo: "#00FF41",
  intel: "#00FF41", conflict: "#FF4444", geopolitical: "#0088FF",
  logistics: "#FF8844", cryptozoology: "#FF00FF", convergence: "#FFFFFF",
  quake: "#FF4444", nasa: "#FFDD00", dao_node: "#FFD700", aircraft: "#E2E8F0",
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

const RAINVIEWER_FRAME_FALLBACK = 1719954000;

const SEVERITY_SIZE: Record<string, number> = {
  critical: 14, high: 11, medium: 8, low: 6, signal: 5,
};

function hexToColor(hex: string, alpha = 1): Color {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return new Color(r, g, b, alpha);
}

async function fetchRainViewerFrame(): Promise<number> {
  try {
    const r = await fetch("https://api.rainviewer.com/public/weather-maps.json");
    if (!r.ok) return RAINVIEWER_FRAME_FALLBACK;
    const data = await r.json();
    const frames = data?.radar?.past ?? [];
    const latest = frames[frames.length - 1]?.time;
    return Number.isFinite(latest) ? latest : RAINVIEWER_FRAME_FALLBACK;
  } catch {
    return RAINVIEWER_FRAME_FALLBACK;
  }
}

type LayerKey = "markets" | "uap" | "cryptozoo";

interface CesiumGlobeProps {
  onHotspotClick?: (data: HotspotData | null) => void;
  sightings?: UAPSighting[];
  visibleLayers?: Set<LayerKey>;
  flyTo?: { lat: number; lon: number; alt: number } | null;
  kpIndex?: number;
  earthquakes?: Earthquake[];
  nasaEvents?: NasaEvent[];
  /** Base imagery style: photo (ArcGIS satellite) vs vector dark (CartoDB). */
  baseMapStyle?: "satellite" | "dark";
  /** RainViewer live precipitation radar overlay. */
  showRadar?: boolean;
  /** OpenWeatherMap pressure isobars overlay (via edge proxy). */
  showIsobars?: boolean;
  /** OpenWeatherMap cloud cover overlay (via edge proxy). */
  showClouds?: boolean;
  /** OpenWeatherMap wind overlay (via edge proxy). */
  showWind?: boolean;
  /** OpenWeatherMap precipitation overlay (via edge proxy). */
  showRain?: boolean;
  /** Aircraft (OpenSky) — wired in next sprint. Prop kept for API stability. */
  aircraftEnabled?: boolean;
  externalMarkers?: HotspotData[];
  onReady?: (navFn: (lat: number, lng: number, altitude: number) => void) => void;
}

export function CesiumGlobe({
  onHotspotClick, sightings = [], visibleLayers, flyTo, kpIndex = 0,
  earthquakes = [], nasaEvents = [],
  externalMarkers = [],
  onReady,
  baseMapStyle = "satellite",
  showRadar = false, showIsobars = false, showClouds = false,
  showWind = false, showRain = false,
  aircraftEnabled = true,
}: CesiumGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumViewer | null>(null);
  const sightingEntityIdsRef = useRef<string[]>([]);
  const marketEntityIdsRef = useRef<string[]>([]);
  const arcEntityIdsRef = useRef<string[]>([]);
  const teslaAuraRef = useRef<string[]>([]);
  const quakeEntityIdsRef = useRef<string[]>([]);
  const nasaEntityIdsRef = useRef<string[]>([]);
  const externalEntityIdsRef = useRef<string[]>([]);
  const aircraftEntityIdsRef = useRef<string[]>([]);
  // Refs for dynamic imagery layers so we can remove/replace exactly.
  const baseLayerRef = useRef<any>(null);
  const radarLayerRef = useRef<any>(null);
  const isobarsLayerRef = useRef<any>(null);
  const cloudsLayerRef = useRef<any>(null);
  const windLayerRef = useRef<any>(null);
  const rainLayerRef = useRef<any>(null);

  // Edge proxy that keeps OPENWEATHER_API_KEY server-side.
  const OWM_PROXY = `${SUPABASE_URL_BASE}/functions/v1/openweather`;

  const handleHotspotClick = useCallback(
    (data: HotspotData | null) => { onHotspotClick?.(data); },
    [onHotspotClick]
  );

  // Initialize viewer once
  useEffect(() => {
    if (!containerRef.current) return;
    // Token is assigned async; viewer init does not block on it.
    fetchCesiumToken().then((tok) => {
      if (tok) Ion.defaultAccessToken = tok;
    });

    const viewer = new CesiumViewer(containerRef.current, {
      animation: false, baseLayerPicker: false, fullscreenButton: false,
      geocoder: false, homeButton: false, infoBox: false, sceneModePicker: false,
      selectionIndicator: false, timeline: false, navigationHelpButton: false,
      creditContainer: document.createElement("div"),
      terrainProvider: new EllipsoidTerrainProvider(),
      contextOptions: { webgl: { alpha: false } },
      // Base imagery is managed by the baseMapStyle useEffect below.
      baseLayer: false as any,
    });

    // ---------------- Photo-real cosmos environment ----------------
    viewer.scene.backgroundColor = Color.BLACK;

    // Real day/night terminator + dynamic sunrise/sunset atmosphere.
    viewer.scene.globe.enableLighting = true;
    (viewer.scene.globe as any).dynamicAtmosphereLighting = true;
    viewer.scene.globe.atmosphereLightIntensity = 8.0;

    // Halo atmosphere around the Earth limb.
    try {
      viewer.scene.skyAtmosphere = new SkyAtmosphere();
      viewer.scene.skyAtmosphere.show = true;
      viewer.scene.skyAtmosphere.brightnessShift = 0.05;
      viewer.scene.skyAtmosphere.hueShift = -0.05;
      viewer.scene.skyAtmosphere.saturationShift = 0.2;
    } catch (e) { console.warn("SkyAtmosphere init failed:", e); }

    // Native astros — Cesium computes real ephemerides (lunar phase, sun pos).
    try {
      viewer.scene.sun = new Sun();
      viewer.scene.sun.show = true;
      (viewer.scene.sun as any).glowFactor = 2.0;
      viewer.scene.moon = new Moon({
        textureUrl: buildModuleUrl("Assets/Textures/moonSmall.jpg"),
        onlySunLighting: false,
      } as any);
      viewer.scene.moon.show = true;
      // Reloj animado → efemérides reales para Sol y Luna
      viewer.clock.shouldAnimate = true;
      viewer.clock.multiplier = 1;
      // Atmósfera terrestre suave, sin comer el limbo solar
      viewer.scene.globe.showGroundAtmosphere = true;
      (viewer.scene.globe as any).atmosphereBrightnessShift = -0.1;
    } catch (e) { console.warn("Sun/Moon init failed:", e); }

    // High-res Milky Way skybox (tycho2t3_80) — served locally by
    // vite-plugin-cesium, so no CORS from third-party CDNs.
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
    } catch (e) { console.warn("SkyBox init failed:", e); }

    // Tactical bloom — city lights and stars punch through the dark.
    try {
      viewer.scene.postProcessStages.bloom.enabled = true;
      viewer.scene.postProcessStages.bloom.uniforms.glowOnly = false;
      viewer.scene.postProcessStages.bloom.uniforms.contrast = 16;
      viewer.scene.postProcessStages.bloom.uniforms.brightness = -0.1;
      viewer.scene.postProcessStages.bloom.uniforms.delta = 1.0;
      viewer.scene.postProcessStages.bloom.uniforms.sigma = 2.0;
      viewer.scene.postProcessStages.bloom.uniforms.stepSize = 1.0;
    } catch (e) { console.warn("Bloom init failed:", e); }

    // Night lights
    try {
      IonImageryProvider.fromAssetId(3812).then((provider) => {
        if (!viewer.isDestroyed()) {
          const layer = viewer.imageryLayers.addImageryProvider(provider);
          layer.dayAlpha = 0.0;
          layer.nightAlpha = 0.9;
          layer.brightness = 2.0;
        }
      }).catch((e: any) => console.warn("Night lights failed:", e));
    } catch (e) { console.warn("Night lights init failed:", e); }

    // Base imagery layer is now owned by the baseMapStyle useEffect below.

    // NO atmosphere ellipsoid entity — using Cesium's built-in skyAtmosphere instead

    viewerRef.current = viewer;

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
        const externalMarker = picked.id.properties.externalMarker?.getValue();
        if (externalMarker) {
          try {
            handleHotspotClick(JSON.parse(externalMarker));
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

    // Expose a lightweight zoom helper for the HUD buttons.
    const flyToLocation = (lat: number, lng: number, altitude: number) => {
      if (!viewer || viewer.isDestroyed()) return;
      const altitudeMeters = altitude < 1000 ? altitude * 1_000_000 : altitude;
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(lng, lat, altitudeMeters),
        orientation: { heading: CesiumMath.toRadians(0), pitch: CesiumMath.toRadians(-90), roll: 0 },
        duration: 1.5,
      });
    };
    onReady?.(flyToLocation);

    (window as any).__cesiumZoom = (factor: number) => {
      if (!viewer || viewer.isDestroyed()) return;
      const height = viewer.camera.positionCartographic.height;
      const nextHeight = Math.max(500, Math.min(30_000_000, height * factor));
      const carto = viewer.camera.positionCartographic;
      viewer.camera.flyTo({
        destination: Cartesian3.fromRadians(carto.longitude, carto.latitude, nextHeight),
        orientation: { heading: viewer.camera.heading, pitch: viewer.camera.pitch, roll: 0 },
        duration: 0.6,
      });
    };

    return () => {
      handler.destroy();
      if (!viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
      if ((window as any).__cesiumZoom) delete (window as any).__cesiumZoom;
    };
  }, [handleHotspotClick, onReady]);

  // ---- Base map layer (satellite vs dark vector) --------------------------
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    let cancelled = false;

    (async () => {
      let provider: any = null;
      try {
        if (baseMapStyle === "dark") {
          provider = new UrlTemplateImageryProvider({
            url: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
            maximumLevel: 19,
            credit: "© CARTO © OpenStreetMap",
          });
        } else {
          provider = await ArcGisMapServerImageryProvider.fromUrl(
            "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer"
          );
        }
      } catch (e) {
        console.warn("Base imagery failed:", e);
        return;
      }
      if (cancelled || viewer.isDestroyed() || !provider) return;
      // Remove previous base layer if any
      if (baseLayerRef.current) {
        try { viewer.imageryLayers.remove(baseLayerRef.current, true); } catch { /* ignore */ }
        baseLayerRef.current = null;
      }
      // Insert at bottom so overlays and night-lights stay above.
      const layer = viewer.imageryLayers.addImageryProvider(provider, 0);
      baseLayerRef.current = layer;
    })();

    return () => { cancelled = true; };
  }, [baseMapStyle]);

  // ---- Generic helper: toggle a UrlTemplate imagery overlay ---------------
  function useOverlay(
    enabled: boolean,
    ref: React.MutableRefObject<any>,
    urlTemplate: string | null,
    alpha: number,
    maximumLevel: number = 8,
    options: Record<string, any> = {},
  ) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return;
      if (enabled && urlTemplate) {
        try {
          const provider = new UrlTemplateImageryProvider({
            url: urlTemplate,
            maximumLevel,
            tilingScheme: options.tilingScheme,
            rectangle: options.rectangle,
            minimumLevel: options.minimumLevel,
            tileWidth: options.tileWidth,
            tileHeight: options.tileHeight,
            credit: options.credit,
          });
          const layer = viewer.imageryLayers.addImageryProvider(provider);
          layer.alpha = alpha;
          if (typeof options.brightness === "number") layer.brightness = options.brightness;
          if (typeof options.contrast === "number") layer.contrast = options.contrast;
          if (typeof options.saturation === "number") layer.saturation = options.saturation;
          ref.current = layer;
        } catch (e) { console.warn("Overlay failed:", urlTemplate, e); }
      }
      return () => {
        if (ref.current && viewer && !viewer.isDestroyed()) {
          try { viewer.imageryLayers.remove(ref.current, true); } catch { /* ignore */ }
          ref.current = null;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, urlTemplate]);
  }

  const [rainViewerFrame, setRainViewerFrame] = useState<number | null>(null);
  useEffect(() => {
    if (!showRadar) return;
    let cancelled = false;
    fetchRainViewerFrame().then((frame) => {
      if (!cancelled) setRainViewerFrame(frame);
    });
    return () => { cancelled = true; };
  }, [showRadar]);

  // RainViewer — static timestamp placeholder per MVP spec.
  useOverlay(
    showRadar,
    radarLayerRef,
    rainViewerFrame ? `https://tilecache.rainviewer.com/v2/radar/${rainViewerFrame}/256/{z}/{x}/{y}/2/1_1.png` : null,
    0.6,
    10,
    { credit: new Credit("RainViewer") },
  );
  // OpenWeather isobars (pressure). Key hidden by the edge proxy.
  useOverlay(
    showIsobars,
    isobarsLayerRef,
    `${OWM_PROXY}?tile=pressure_new&z={z}&x={x}&y={y}`,
    0.7,
    12,
    { brightness: 1.15, contrast: 1.1, credit: new Credit("OpenWeather") },
  );
  useOverlay(
    showClouds,
    cloudsLayerRef,
    `${OWM_PROXY}?tile=clouds_new&z={z}&x={x}&y={y}`,
    0.55,
    12,
    { brightness: 1.2, contrast: 1.05, credit: new Credit("OpenWeather") },
  );
  useOverlay(
    showWind,
    windLayerRef,
    `${OWM_PROXY}?tile=wind_new&z={z}&x={x}&y={y}`,
    0.55,
    12,
    { brightness: 1.15, contrast: 1.1, credit: new Credit("OpenWeather") },
  );
  useOverlay(
    showRain,
    rainLayerRef,
    `${OWM_PROXY}?tile=precipitation_new&z={z}&x={x}&y={y}`,
    0.65,
    12,
    { brightness: 1.15, contrast: 1.08, credit: new Credit("OpenWeather") },
  );

  // Aircraft (OpenSky-style live layer) — deterministic tactical sample until
  // the live feed endpoint is available, so the control renders visible traffic.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    aircraftEntityIdsRef.current.forEach(id => {
      const e = viewer.entities.getById(id);
      if (e) viewer.entities.remove(e);
    });
    aircraftEntityIdsRef.current = [];

    if (!aircraftEnabled) return;

    const traffic = [
      { id: "mad-ams", lon: -3.7, lat: 40.4, heading: 42, label: "OSN-214" },
      { id: "par-dxb", lon: 8.2, lat: 44.6, heading: 118, label: "OSN-771" },
      { id: "lon-nyc", lon: -22.0, lat: 50.5, heading: 285, label: "OSN-509" },
      { id: "tok-sin", lon: 128.4, lat: 29.8, heading: 214, label: "OSN-088" },
      { id: "gulf", lon: 48.8, lat: 27.9, heading: 92, label: "OSN-331" },
    ];

    traffic.forEach((aircraft) => {
      const entityId = `aircraft-${aircraft.id}`;
      viewer.entities.add({
        id: entityId,
        position: Cartesian3.fromDegrees(aircraft.lon, aircraft.lat, 9000),
        billboard: {
          image: new PinBuilder().fromText("✈", Color.fromCssColorString("#E2E8F0"), 36).toDataURL(),
          width: 28,
          height: 28,
          rotation: CesiumMath.toRadians(aircraft.heading),
          verticalOrigin: VerticalOrigin.CENTER,
          horizontalOrigin: HorizontalOrigin.CENTER,
          scaleByDistance: new NearFarScalar(1e6, 1, 1e8, 0.35),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: aircraft.label,
          font: "9px monospace",
          fillColor: Color.fromCssColorString("#E2E8F0"),
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          style: 2,
          verticalOrigin: VerticalOrigin.BOTTOM,
          horizontalOrigin: HorizontalOrigin.CENTER,
          pixelOffset: new Cartesian2(0, -16),
          scaleByDistance: new NearFarScalar(1e6, 0.8, 1e8, 0.15),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      aircraftEntityIdsRef.current.push(entityId);
    });
  }, [aircraftEnabled]);

  // External unified markers — DAO HQ, OSINT/environment markers from parent.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    externalEntityIdsRef.current.forEach(id => {
      const e = viewer.entities.getById(id);
      if (e) viewer.entities.remove(e);
    });
    externalEntityIdsRef.current = [];

    externalMarkers.forEach((marker, i) => {
      if (!Number.isFinite(marker.lat) || !Number.isFinite(marker.lon)) return;
      const entityId = `external-${marker.type}-${i}`;
      const markerColor = marker.color || TACTICAL_COLORS[marker.type] || "#E2E8F0";
      const isDao = marker.type === "dao_node";
      viewer.entities.add({
        id: entityId,
        position: Cartesian3.fromDegrees(marker.lon, marker.lat, isDao ? 15000 : 0),
        point: {
          pixelSize: isDao ? 18 : 7 + marker.intensity * 8,
          color: hexToColor(markerColor, isDao ? 1 : 0.86),
          outlineColor: isDao ? Color.WHITE.withAlpha(0.8) : hexToColor(markerColor, 0.35),
          outlineWidth: isDao ? 4 : 2,
          scaleByDistance: new NearFarScalar(1e6, 1.35, 1e8, isDao ? 0.55 : 0.28),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: isDao ? "✦ DAO Zaragoza" : marker.name,
          font: isDao ? "12px monospace" : "9px monospace",
          fillColor: hexToColor(markerColor, 0.95),
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          style: 2,
          verticalOrigin: VerticalOrigin.BOTTOM,
          horizontalOrigin: HorizontalOrigin.CENTER,
          pixelOffset: new Cartesian2(0, isDao ? -18 : -11),
          scaleByDistance: new NearFarScalar(1e6, 1, 1e8, isDao ? 0.35 : 0.12),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: {
          externalMarker: JSON.stringify(marker),
        } as any,
      });
      externalEntityIdsRef.current.push(entityId);
    });
  }, [externalMarkers]);

  // Tesla Aurora — dynamic polar rings reacting to Kp
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // Clean previous aurora entities
    teslaAuraRef.current.forEach(id => {
      const e = viewer.entities.getById(id);
      if (e) viewer.entities.remove(e);
    });
    teslaAuraRef.current = [];

    if (kpIndex <= 3) return;

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
              const elapsed = (Date.now() - startTime) % 6000;
              const pulse = 1 + 0.15 * Math.sin((elapsed / 6000) * Math.PI * 2 + ring);
              return baseRadius * pulse;
            }, false) as any,
            semiMinorAxis: new CallbackProperty(() => {
              const elapsed = (Date.now() - startTime) % 6000;
              const majorPulse = 1 + 0.15 * Math.sin((elapsed / 6000) * Math.PI * 2 + ring);
              const minorPulse = 1 + 0.15 * Math.sin((elapsed / 6000) * Math.PI * 2 + ring + 1);
              const majorVal = baseRadius * majorPulse;
              const minorVal = baseRadius * 0.6 * minorPulse;
              return Math.min(majorVal, minorVal);
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
  }, [kpIndex]);

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
            const elapsed = (Date.now() - startTime) % 4000;
            const pulse = 1 + 0.3 * Math.sin((elapsed / 4000) * Math.PI * 2);
            return baseRadius * pulse;
          }, false) as any,
          semiMinorAxis: new CallbackProperty(() => {
            const elapsed = (Date.now() - startTime) % 4000;
            const pulse = 1 + 0.3 * Math.sin((elapsed / 4000) * Math.PI * 2);
            const majorVal = baseRadius * pulse;
            const minorVal = baseRadius * pulse * 0.98;
            return Math.min(majorVal, minorVal);
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

    if (visibleLayers && !visibleLayers.has("markets")) return;

    HOTSPOT_DATA.forEach((spot, idx) => {
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
      if (!HOTSPOT_DATA[a] || !HOTSPOT_DATA[b]) return;
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
      if (visibleLayers) {
        if ((cat === "uap" || cat === "ufo") && !visibleLayers.has("uap")) return;
        if (cat === "cryptozoology" && !visibleLayers.has("cryptozoo")) return;
      }
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
    const altitudeMeters = flyTo.alt < 1000 ? flyTo.alt * 1_000_000 : flyTo.alt;
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(flyTo.lon, flyTo.lat, altitudeMeters),
      orientation: { heading: CesiumMath.toRadians(0), pitch: CesiumMath.toRadians(-90), roll: 0 },
      duration: 1.5,
    });
  }, [flyTo]);

  return (
    <div ref={containerRef} className="w-full h-full" style={{ background: "#000000" }} />
  );
}
