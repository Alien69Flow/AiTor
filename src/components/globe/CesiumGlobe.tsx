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
  GeographicTilingScheme,
  EllipsoidTerrainProvider,
  CallbackProperty,
  SkyBox,
  buildModuleUrl,
  UrlTemplateImageryProvider,
  ImageryLayer,
  ProviderViewModel,
  ArcType,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import type { HotspotData } from "./GlobeScene";
import type { UAPSighting } from "@/hooks/useUAPSightings";
import type { Earthquake } from "@/hooks/useEarthquakes";
import type { NasaEvent } from "@/hooks/useNasaEvents";
import type { Flight } from "@/hooks/useAirTraffic";
import type { Ship } from "@/hooks/useMarineTraffic";
import { GLOBE_LAYERS, type EnvLayerKey, type globeLayerDef } from "@/lib/globe-layers";
import { aircraftSilhouette } from "@/lib/aircraft-silhouette";
import { COSMIC_TRIGGER_ALTITUDE_M } from "@/lib/cosmic-scale";
import {
  ZOOM_MAX_ALTITUDE_M,
  ZOOM_MIN_ALTITUDE_M,
  groundWidthFromFov,
  nextZoomAltitude,
} from "@/lib/globe-scale";
import type { ViewScale } from "./GlobeScaleHud";
import type { SatellitePosition } from "@/hooks/useSatellites";
import type { OutageEvent } from "@/hooks/useInternetOutages";
import type { IssPosition } from "@/hooks/connectors/useIssPosition";
import type { IonosphereMesh } from "@/hooks/connectors/useIonosphere";
import type { PlacedCamera } from "@/lib/live-camera-places";
import type { VanAllenBelts } from "@/hooks/connectors/useVanAllenBelts";
import type { SolarWind } from "@/hooks/connectors/useSolarWind";
import { HELIOPAUSE_AU, FAST_WIND_KMS } from "@/hooks/connectors/useSolarWind";
import { beltRings } from "@/lib/van-allen-belts";
import { subsolarPoint } from "@/lib/solar-position";
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
import { SUPABASE_URL } from "@/integrations/supabase/client";

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
 * NASA GIBS (open, no API key) rasters. Every layer links its own
 * TileMatrixSet and TIME window — the wrong level answers `TILEMATRIXSET is
 * invalid for LAYER` and an out-of-range date answers 404 — so the level and
 * the date policy live in each layer's `gibs` config in globe-layers.ts.
 */
function gibsDate(offsetHours = 36): string {
  const d = new Date(Date.now() - offsetHours * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

function gibsTileUrl(cfg: NonNullable<globeLayerDef["gibs"]>): string {
  const time = cfg.timeless ? "" : `${cfg.date ?? gibsDate(cfg.dateOffsetHours ?? 36)}/`;
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${cfg.layer}/default/${time}GoogleMapsCompatible_Level${cfg.level}/{z}/{y}/{x}.png`;
}

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

const MARKER_GLYPHS: Record<string, string> = {
  quake: "⌁", fire: "▲", flight: "✈", ship: "◆", satellite: "✦",
  conflict: "✕", news: "!", bitcoin: "₿", outage: "⌁", market: "$", uap: "◉",
  camera: "▶", iss: "◈", belt: "☢", sun: "☉",
};

/** Radio medio terrestre, para pasar la geometría del dipolo a metros. */
const EARTH_RADIUS_M = 6_378_137;

/** Color del cinturón exterior según lo que mide GOES. */
const BELT_LEVEL_COLORS: Record<VanAllenBelts["level"], string> = {
  quiet: "#38bdf8",
  elevated: "#facc15",
  high: "#fb7185",
  extreme: "#f43f5e",
};

/**
 * Pulse helper for the paired axes of a pulsing ellipse.
 *
 * `semiMajorAxis` and `semiMinorAxis` are two independent CallbackProperties:
 * evaluating the pulse in each one let a 50ms quantization-bucket straddle
 * make the minor axis larger than the major one, and
 * `semiMajorAxis must be >= semiMinorAxis` then froze the whole globe
 * (DeveloperError from EllipseGeometry). Cesium rebuilds the geometry reading
 * `semiMajorAxis` before `semiMinorAxis`, so `minor` clamps itself against the
 * major value computed in the same pass — the invariant now holds on every
 * evaluation, whatever the clock does.
 */
function makePulsePair(startTime: number, periodMs: number, amplitude: number, phase = 0) {
  let lastBucket = -1;
  let lastPulse = 1;
  let lastMajor = 0;
  const pulse = () => {
    const t = Math.floor((Date.now() - startTime) / 50) * 50;
    if (t !== lastBucket) {
      lastBucket = t;
      lastPulse = 1 + amplitude * Math.sin(((t % periodMs) / periodMs) * Math.PI * 2 + phase);
    }
    return lastPulse;
  };
  return {
    major: (base: number) => {
      lastMajor = base * pulse();
      return lastMajor;
    },
    minor: (base: number, factor: number) => Math.min(lastMajor, base * pulse() * factor),
  };
}

function markerIcon(type: string, color: string): string {
  const glyph = MARKER_GLYPHS[type] || "•";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><path d="M20 2 36 11v18L20 38 4 29V11Z" fill="#05070a" fill-opacity=".9" stroke="${color}" stroke-width="2"/><circle cx="20" cy="20" r="12" fill="${color}" fill-opacity=".16"/><text x="20" y="25" text-anchor="middle" font-family="monospace" font-size="16" font-weight="700" fill="${color}">${glyph}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Aircraft marker: a top-view silhouette instead of the shared hexagon badge.
 *
 * The generic badge drew every point — quakes, ships, aircraft — as a shield
 * with a glyph inside, so a plane looked like a UI pin from above. These shapes
 * are drawn nose-up and rotated by the reported heading, which is what makes a
 * traffic layer readable at a glance.
 */
function aircraftMarkerIcon(
  category: string | null | undefined,
  color: string,
): string {
  const shape = aircraftSilhouette(category);
  const body = {
    plane: `<path d="M19 3.5c.7-.7 1.3-.7 2 0l2.1 12.1 11.4 6.2v3L23 22.1l-.8 10.1 4.3 2.7v2L20 35.1l-6.5 1.8v-2l4.3-2.7L17 22.1 5.5 24.8v-3l11.4-6.2L19 3.5Z" fill="${color}" stroke="#071018" stroke-width="1" stroke-linejoin="round"/>`,
    helicopter: `<ellipse cx="20" cy="19" rx="3.4" ry="6.2" fill="${color}" stroke="#071018" stroke-width="1"/><g fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round"><path d="M7 14h26"/><path d="M20 3v11"/><path d="M20 25.5v9.5"/><path d="M15.5 35h9"/></g>`,
    balloon: `<circle cx="20" cy="14.5" r="9.5" fill="${color}" fill-opacity=".45" stroke="${color}" stroke-width="2"/><path d="M15.5 23.5 17 29h6l1.5-5.5" fill="none" stroke="${color}" stroke-width="2"/><rect x="16" y="29" width="8" height="5.5" rx="1.4" fill="${color}" stroke="#071018" stroke-width="1"/>`,
    drone: `<g fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="4.4"/><circle cx="29" cy="11" r="4.4"/><circle cx="11" cy="29" r="4.4"/><circle cx="29" cy="29" r="4.4"/><path d="M15 15 25 25M25 15 15 25"/></g><circle cx="20" cy="20" r="4.6" fill="${color}" stroke="#071018" stroke-width="1"/>`,
  }[shape];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">${body}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Propiedades planas de entidad: Cesium las envuelve en ConstantProperty. */
type PlainEntityProperties = Record<string, string | number | boolean>;

function eventPayload(data: Record<string, unknown>): PlainEntityProperties {
  return { sightingData: JSON.stringify(data) };
}

type LayerKey = "markets" | "uap" | "cryptozoo";

interface CesiumGlobeProps {
  onHotspotClick?: (data: HotspotData | null) => void;
  /** Fired when the camera pulls out past the globe, so the view can hand over
   *  to the cosmic zoom. Receives the camera altitude in metres. */
  onZoomFar?: (altitudeMetres: number) => void;
  /** Escala real de la vista (metros por píxel en el centro de la pantalla). */
  onViewScale?: (scale: ViewScale | null) => void;
  /** Botones de zoom de la barra de escala. `null` al desmontar. */
  onZoomControls?: (controls: { zoomIn: () => void; zoomOut: () => void } | null) => void;
  sightings?: UAPSighting[];
  visibleLayers?: Set<LayerKey>;
  envLayers?: Set<EnvLayerKey>;
  flyTo?: { lat: number; lon: number; alt: number } | null;
  kpIndex?: number;
  earthquakes?: Earthquake[];
  nasaEvents?: NasaEvent[];
  flights?: Flight[];
  ships?: Ship[];
  satellites?: SatellitePosition[];
  outages?: OutageEvent[];
  /** RainViewer radar tile template (null while unavailable). */
  rainTileUrl?: string | null;
  /** NOAA Ovation aurora mesh cells. */
  auroraCells?: { lat: number; lon: number; probability: number }[];
  /** NASA FIRMS active fire detections. */
  fires?: { id: string; lat: number; lon: number; brightness: number; confidence: string }[];
  /** TeleGeography submarine cables. */
  cables?: { id: string; name: string; color: string; paths: [number, number][][] }[];
  /** Bitnodes reachable Bitcoin nodes. */
  bitcoinNodes?: { id: string; lat: number; lon: number; city: string; country: string }[];
  /** GDELT geolocated news events. */
  gdeltEvents?: { id: string; title: string; lat: number; lon: number; domain: string; url: string }[];
  /** Open-Meteo surface wind / pressure vectors. */
  surfaceWeather?: {
    id: string; name: string; lat: number; lon: number;
    pressureHpa: number; windSpeedMs: number; windDirectionDeg: number;
    temperatureC: number; humidityPercent: number;
  }[];
  /** ISS en su posición real (WhereTheISS.at). `null` mientras no hay medida. */
  iss?: IssPosition | null;
  /** Malla TEC de la ionosfera (NOAA SWPC GLOTEC). */
  ionosphere?: IonosphereMesh | null;
  /** Electrones >2 MeV medidos por GOES: intensidad del cinturón exterior. */
  vanAllen?: VanAllenBelts | null;
  /** Viento solar en L1: lo que infla la heliosfera. */
  solarWind?: SolarWind | null;
  /**
   * Cámaras del Alien con sede conocida. Al pulsarlas abren su ficha como
   * cualquier otro marcador; el directo se pide desde dentro de la ficha, así
   * que el visor no necesita saber nada de navegar a otro módulo.
   */
  cameras?: PlacedCamera[];
}

export function CesiumGlobe({
  onHotspotClick, onZoomFar, onViewScale, onZoomControls, sightings = [], visibleLayers, envLayers, flyTo, kpIndex = 0,
  earthquakes = [], nasaEvents = [], flights = [], ships = [],
  satellites = [], outages = [],
  rainTileUrl = null, auroraCells = [], fires = [], cables = [],
  bitcoinNodes = [], gdeltEvents = [], surfaceWeather = [],
  iss = null, ionosphere = null, cameras = [],
  vanAllen = null, solarWind = null,
}: CesiumGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumViewer | null>(null);
  const owmLayersRef = useRef<Record<string, ImageryLayer>>({});
  const gibsLayersRef = useRef<Record<string, ImageryLayer>>({});
  const rainLayerRef = useRef<ImageryLayer | null>(null);
  const rainUrlRef = useRef<string | null>(null);
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
  const connectorEntityIdsRef = useRef<string[]>([]);
  const issEntityIdsRef = useRef<string[]>([]);
  const ionoEntityIdsRef = useRef<string[]>([]);
  const cameraEntityIdsRef = useRef<string[]>([]);
  const vanAllenEntityIdsRef = useRef<string[]>([]);
  const heliosphereEntityIdsRef = useRef<string[]>([]);

  const handleHotspotClick = useCallback(
    (data: HotspotData | null) => { onHotspotClick?.(data); },
    [onHotspotClick]
  );

  // Keep the callback in a ref so the viewer is never re-created when it changes.
  const onZoomFarRef = useRef(onZoomFar);
  onZoomFarRef.current = onZoomFar;
  const onViewScaleRef = useRef(onViewScale);
  onViewScaleRef.current = onViewScale;
  const onZoomControlsRef = useRef(onZoomControls);
  onZoomControlsRef.current = onZoomControls;

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
      baseLayer: false,
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
        //
        // Antes se pedía el asset 3812 de Cesium Ion, pero el token está en
        // blanco (`Ion.defaultAccessToken = ""`), así que Ion contestaba 401 y
        // el globo se quedaba sin luces nocturnas. NASA GIBS sirve la misma
        // capa (VIIRS City Lights) con CORS abierto y sin credencial.
        try {
          const nlProvider = new UrlTemplateImageryProvider({
            url: "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/VIIRS_CityLights_2012/default/500m/{z}/{y}/{x}.jpeg",
            tilingScheme: new GeographicTilingScheme(),
            maximumLevel: 8,
          });
          if (viewer.isDestroyed()) return;
          const nl = viewer.imageryLayers.addImageryProvider(nlProvider);
          nl.dayAlpha = 0.0;
          nl.nightAlpha = 0.9;
          nl.brightness = 2.0;
          viewer.imageryLayers.lowerToBottom(nl);
          viewer.imageryLayers.raise(nl);
        } catch (e) {
          console.warn("Night lights failed:", e);
        }
      } catch (e) {
        console.warn("ArcGIS base imagery failed:", e);
      }
    })();

    // Click handler
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: { position: Cartesian2 }) => {
      const picked = viewer.scene.pick(click.position);
      if (defined(picked) && picked.id?.properties) {
        // Una cámara del Alien NO cambia de módulo al pulsarla: abre su ficha
        // como cualquier otro marcador y el directo se pide desde dentro, para
        // que el clic nunca saque al operador del globo antes de leer nada.
        // `cameraId` viaja en el hotspot para que la ficha sepa qué abrir.
        const cameraId = picked.id.properties.cameraId?.getValue();
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
              // Las cámaras conservan el rosa de su marcador en la ficha.
              color: parsed.type === "camera" ? "#f472b6" : TACTICAL_COLORS[parsed.category] || "#00FF41",
              name: parsed.location, country: parsed.category?.toUpperCase() || "UAP",
              marketVolume: parsed.source || "Unknown", trend: parsed.date_reported || "",
              topTokens: [parsed.type || "unknown"], type: parsed.category || "uap",
              description: parsed.description || "",
              source: parsed.source || "Unknown",
              timestamp: parsed.date_reported || "LIVE",
              reliability: parsed.reliability || undefined,
              ...(typeof cameraId === "string" && cameraId ? { cameraId } : {}),
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

    // Hand over to the cosmic zoom once the camera is far enough out that the
    // globe no longer fills the view. Threshold lives in CosmicZoom.
    const onCameraChanged = () => {
      const altitude = viewer.camera.positionCartographic?.height ?? 0;
      if (altitude > COSMIC_TRIGGER_ALTITUDE_M) onZoomFarRef.current?.(altitude);
    };
    viewer.camera.changed.addEventListener(onCameraChanged);

    // Límites de acercamiento reales. Sin suelo, la rueda seguía metiendo la
    // cámara dentro del elipsoide (pantalla negra sin detalle); sin techo, el
    // globo se alejaba indefinidamente en vez de pasar al zoom cósmico.
    const controller = viewer.scene.screenSpaceCameraController;
    controller.minimumZoomDistance = ZOOM_MIN_ALTITUDE_M;
    controller.maximumZoomDistance = ZOOM_MAX_ALTITUDE_M;
    // `camera.changed` sólo dispara cuando la cámara se mueve más de este
    // porcentaje: con el 0,5 % por defecto la escala se quedaba atrás.
    viewer.camera.percentageChanged = 0.01;

    // Botones de la barra de escala: un paso = 60 % de la altura, con los mismos
    // topes que la rueda (250 m … 63 000 km). `zoomIn`/`zoomOut` mueven la cámara
    // a lo largo de su dirección de vista, así que respetan la inclinación.
    const applyZoom = (direction: "in" | "out") => {
      if (viewer.isDestroyed()) return;
      const height = viewer.camera.positionCartographic?.height;
      if (!height || !Number.isFinite(height)) return;
      const target = nextZoomAltitude(height, direction);
      if (target === null) return;
      const delta = Math.abs(height - target);
      if (direction === "in") viewer.camera.zoomIn(delta);
      else viewer.camera.zoomOut(delta);
    };
    onZoomControlsRef.current?.({
      zoomIn: () => applyZoom("in"),
      zoomOut: () => applyZoom("out"),
    });

    // Escala real: se proyectan dos píxeles a la misma altura a ambos lados del
    // centro de la pantalla y se mide la distancia geodésica sobre el globo.
    // Así la barra dice kilómetros de verdad, incluso con la cámara inclinada.
    const measureScale = () => {
      if (viewer.isDestroyed()) return;
      const scene = viewer.scene;
      const canvas = scene.canvas;
      const width = canvas.clientWidth || canvas.width;
      const height = canvas.clientHeight || canvas.height;
      const altitude = viewer.camera.positionCartographic?.height ?? 0;
      if (!width || !height) return;

      const sample = (x: number) => {
        const pixel = new Cartesian2(x, height / 2);
        const ray = viewer.camera.getPickRay(pixel);
        const hit = ray ? scene.globe.pick(ray, scene) : undefined;
        return hit ?? viewer.camera.pickEllipsoid(pixel, scene.globe.ellipsoid);
      };
      const left = sample(width / 2 - 60);
      const right = sample(width / 2 + 60);

      let metresPerPixel = Number.NaN;
      let estimated = true;
      if (left && right) {
        const span = Cartesian3.distance(left, right);
        if (span > 0.1) {
          metresPerPixel = span / 120;
          estimated = false;
        }
      }
      if (!Number.isFinite(metresPerPixel)) {
        const fovY = (viewer.camera.frustum as { fovy?: number }).fovy ?? CesiumMath.toRadians(60);
        metresPerPixel = groundWidthFromFov(altitude, fovY, width / height) / width;
      }

      onViewScaleRef.current?.({ altitudeM: altitude, metresPerPixel, viewportWidthPx: width, estimated });
    };

    let scaleFrame = 0;
    const scheduleScale = () => {
      if (scaleFrame) return;
      scaleFrame = requestAnimationFrame(() => {
        scaleFrame = 0;
        measureScale();
      });
    };
    viewer.camera.changed.addEventListener(scheduleScale);
    viewer.camera.moveEnd.addEventListener(scheduleScale);
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => scheduleScale());
    if (containerRef.current) resizeObserver?.observe(containerRef.current);
    scheduleScale();

    return () => {
      handler.destroy();
      if (scaleFrame) cancelAnimationFrame(scaleFrame);
      resizeObserver?.disconnect();
      if (!viewer.isDestroyed()) {
        viewer.camera.changed.removeEventListener(onCameraChanged);
        viewer.camera.changed.removeEventListener(scheduleScale);
        viewer.camera.moveEnd.removeEventListener(scheduleScale);
        viewer.destroy();
      }
      onViewScaleRef.current?.(null);
      onZoomControlsRef.current?.(null);
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
    // NASA GIBS raster overlays (no key required), driven by the `gibs` config
    // on each layer definition so panel data and renderer can never drift.
    GLOBE_LAYERS.filter((l) => l.gibs).forEach((def) => {
      const cfg = def.gibs as NonNullable<globeLayerDef["gibs"]>;
      const shouldShow = active.has(def.key);
      const alpha = cfg.alpha ?? 0.8;
      const existing = gibsLayersRef.current[cfg.layer];
      if (shouldShow && !existing) {
        try {
          const provider = new UrlTemplateImageryProvider({
            url: gibsTileUrl(cfg),
            maximumLevel: cfg.level,
            minimumLevel: 0,
            credit: "NASA GIBS / EOSDIS",
          });
          const l = viewer.imageryLayers.addImageryProvider(provider);
          l.alpha = alpha;
          gibsLayersRef.current[cfg.layer] = l;
        } catch (e) {
          console.error("[CesiumGlobe] GIBS layer add failed:", cfg.layer, e);
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

    // Day/night terminator: real solar lighting. Only applied when the caller
    // supplies an env-layer set, so callers without one keep the init default.
    if (envLayers) {
      viewer.scene.globe.enableLighting = active.has("dayNight");
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
        const pulse = makePulsePair(startTime, 6000, 0.15, ring);

        viewer.entities.add({
          id: entityId,
          position: Cartesian3.fromDegrees(0, ringLat, 80000 + ring * 30000),
          ellipse: {
            semiMajorAxis: new CallbackProperty(() => pulse.major(baseRadius), false),
            semiMinorAxis: new CallbackProperty(() => pulse.minor(baseRadius, 0.6), false),
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
      const pulse = makePulsePair(startTime, 4000, 0.3);

      viewer.entities.add({
        id: entityId,
        position: Cartesian3.fromDegrees(q.lon, q.lat, 0),
        ellipse: {
          semiMajorAxis: new CallbackProperty(() => pulse.major(baseRadius), false),
          semiMinorAxis: new CallbackProperty(() => pulse.minor(baseRadius, 0.98), false),
          material: Color.fromCssColorString("#FF4444").withAlpha(
            Math.min(0.6, q.magnitude / 10)
          ),
          outline: true,
          outlineColor: Color.fromCssColorString("#FF4444").withAlpha(0.8),
          outlineWidth: 1,
          height: 0,
        },
        billboard: {
          image: markerIcon("quake", "#FF4444"), width: 28, height: 28,
          verticalOrigin: VerticalOrigin.CENTER,
          scaleByDistance: new NearFarScalar(1e6, 1.1, 1e8, 0.35),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
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
        properties: eventPayload({
          lat: q.lat, lon: q.lon, location: q.place || "Earthquake",
          description: `Magnitude ${q.magnitude.toFixed(1)} · depth ${q.depth} km`,
          type: "quake", severity: q.magnitude >= 6 ? "critical" : q.magnitude >= 5 ? "high" : "medium",
          source: q.id.startsWith("emsc-") ? "EMSC" : "USGS", category: "quake",
          date_reported: new Date(q.time).toISOString(), reliability: "Official seismic feed",
        }),
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
        billboard: {
          image: markerIcon(isWildfire ? "fire" : "news", color), width: 26, height: 26,
          scaleByDistance: new NearFarScalar(1e6, 1.2, 1e8, 0.4),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: eventPayload({
          lat: evt.lat, lon: evt.lon, location: evt.title,
          description: `${evt.category} · NASA Earth Observatory Natural Event Tracking`,
          type: isWildfire ? "fire" : "hazard", severity: "medium", source: "NASA EONET",
          category: "nasa", date_reported: evt.date || "Active", reliability: "Official satellite feed",
        }),
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
        properties: { hotspotIndex: idx } as PlainEntityProperties,
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
        } satisfies PlainEntityProperties,
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
      if (!flight.latitude || !flight.longitude) return;
      
      const entityId = `flight-${i}`;
      viewer.entities.add({
        id: entityId,
        position: Cartesian3.fromDegrees(flight.longitude, flight.latitude, flight.altitude),
        billboard: {
          image: aircraftMarkerIcon(flight.aircraftCategory, "#69AF00"), width: 26, height: 26,
          rotation: -CesiumMath.toRadians(flight.heading || 0),
          scaleByDistance: new NearFarScalar(1e6, 1.5, 1e8, 0.3),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: eventPayload({
          lat: flight.latitude, lon: flight.longitude, location: flight.callsign || flight.icao24,
          description: `${flight.aircraftType ? `${flight.aircraftType} · ` : ""}${Math.round(flight.altitude)} m · ${Math.round(flight.velocity)} m/s · heading ${Math.round(flight.heading)}°`,
          type: "aircraft", severity: "low", source: "ADSB.lol", category: "aircraft",
          date_reported: flight.timestamp || "LIVE", reliability: "ADS-B telemetry",
        }),
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
      if (!ship.latitude || !ship.longitude) return;
      
      const entityId = `ship-${i}`;
      viewer.entities.add({
        id: entityId,
        position: Cartesian3.fromDegrees(ship.longitude, ship.latitude, 0),
        billboard: {
          image: markerIcon("ship", "#FFD700"), width: 23, height: 23,
          rotation: -CesiumMath.toRadians(ship.heading || 0),
          scaleByDistance: new NearFarScalar(1e6, 1.5, 1e8, 0.3),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: eventPayload({
          lat: ship.latitude, lon: ship.longitude, location: ship.name || ship.mmsi,
          description: `${ship.type} · ${ship.speed} kn · destination ${ship.destination || "unknown"}`,
          type: "ship", severity: "low", source: "VesselFinder / AIS", category: "logistics",
          date_reported: ship.timestamp || "LIVE", reliability: "AIS telemetry",
        }),
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
        properties: payload ? ({ sightingData: JSON.stringify(payload) } as PlainEntityProperties) : undefined,
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
        properties: { cableName: name } as PlainEntityProperties,
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
        billboard: {
          image: markerIcon("satellite", "#69AF00"), width: 20, height: 20,
          scaleByDistance: new NearFarScalar(1e6, 1.4, 1e8, 0.5),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: eventPayload({
          lat: s.lat, lon: s.lon, location: s.name,
          description: `Orbital altitude ${s.altKm.toFixed(0)} km`, type: "satellite", severity: "low",
          source: "CelesTrak", category: "intel", date_reported: "LIVE", reliability: "TLE propagation",
        }),
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
        } satisfies PlainEntityProperties,
      });
      outageEntityIdsRef.current.push(entityId);
    });
  }, [outages]);

  // RainViewer precipitation radar (imagery layer, swapped when a new frame lands)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const active = (envLayers ?? new Set<EnvLayerKey>()).has("precipitation");

    if (!active || !rainTileUrl) {
      if (rainLayerRef.current) {
        try { viewer.imageryLayers.remove(rainLayerRef.current, true); } catch { /* noop */ }
        rainLayerRef.current = null;
        rainUrlRef.current = null;
      }
      return;
    }
    if (rainUrlRef.current === rainTileUrl && rainLayerRef.current) return;

    try {
      const provider = new UrlTemplateImageryProvider({
        url: rainTileUrl,
        maximumLevel: 8,
        minimumLevel: 0,
        credit: "RainViewer",
      });
      const layer = viewer.imageryLayers.addImageryProvider(provider);
      layer.alpha = 0.8;
      if (rainLayerRef.current) {
        try { viewer.imageryLayers.remove(rainLayerRef.current, true); } catch { /* noop */ }
      }
      rainLayerRef.current = layer;
      rainUrlRef.current = rainTileUrl;
    } catch (e) {
      console.warn("[CesiumGlobe] RainViewer layer failed:", e);
    }
  }, [rainTileUrl, envLayers]);

  // Connector-driven vector layers: aurora mesh, FIRMS fires, submarine cables,
  // Bitcoin nodes, GDELT events and Open-Meteo surface vectors.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const active = envLayers ?? new Set<EnvLayerKey>();

    connectorEntityIdsRef.current.forEach((id) => {
      const e = viewer.entities.getById(id);
      if (e) viewer.entities.remove(e);
    });
    connectorEntityIdsRef.current = [];

    const track = (id: string) => connectorEntityIdsRef.current.push(id);

    // --- NOAA Ovation aurora mesh ---
    // La malla se dibuja para `solarActivity` y para `magnetosphere`: es la
    // huella ionosférica del óvalo auroral, y la segunda capa existe para verla
    // también con Kp bajo (la corona de `solarActivity` sólo aparece con Kp>3).
    if (active.has("solarActivity") || active.has("magnetosphere")) {
      auroraCells.forEach((c, i) => {
        const id = `aurora-cell-${i}`;
        const a = Math.min(0.5, c.probability / 140);
        viewer.entities.add({
          id,
          position: Cartesian3.fromDegrees(c.lon, c.lat, 120000),
          point: {
            pixelSize: 6 + c.probability / 18,
            color: hexToColor(c.probability > 45 ? "#7B2FFF" : "#00FFCC", a),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        track(id);
      });
    }

    // --- NASA FIRMS thermal detections ---
    if (active.has("wildfires")) {
      fires.slice(0, 500).forEach((f) => {
        const id = `firms-${f.id}`;
        viewer.entities.add({
          id,
          position: Cartesian3.fromDegrees(f.lon, f.lat, 0),
          billboard: {
            image: markerIcon("fire", "#FF8844"), width: 22, height: 22,
            scaleByDistance: new NearFarScalar(1e6, 1.4, 1e8, 0.3),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          properties: {
            sightingData: JSON.stringify({
              lat: f.lat, lon: f.lon, location: "Active fire",
              description: `Brightness ${f.brightness} · confidence ${f.confidence}`,
              type: "fire", severity: "high", source: "NASA FIRMS (VIIRS)",
              category: "conflict", date_reported: "24h",
            }),
          } satisfies PlainEntityProperties,
        });
        track(id);
      });
    }

    // --- TeleGeography submarine cables ---
    if (active.has("underseaCables")) {
      cables.forEach((cable) => {
        cable.paths.forEach((path, si) => {
          if (path.length < 2) return;
          const id = `tg-cable-${cable.id}-${si}`;
          viewer.entities.add({
            id,
            polyline: {
              positions: path.map(([lon, lat]) => Cartesian3.fromDegrees(lon, lat, 15000)),
              width: 1.4,
              material: new PolylineGlowMaterialProperty({
                glowPower: 0.2,
                color: Color.fromCssColorString(cable.color || "#0891b2").withAlpha(0.55),
              }),
            },
            properties: { cableName: cable.name } as PlainEntityProperties,
          });
          track(id);
        });
      });
    }

    // --- Bitnodes Bitcoin nodes ---
    if (active.has("economicCenters")) {
      bitcoinNodes.forEach((n) => {
        const id = `btc-node-${n.id}`;
        viewer.entities.add({
          id,
          position: Cartesian3.fromDegrees(n.lon, n.lat, 0),
          billboard: {
            image: markerIcon("bitcoin", "#FFD700"), width: 18, height: 18,
            scaleByDistance: new NearFarScalar(1e6, 1.6, 1e8, 0.25),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          properties: eventPayload({
            lat: n.lat, lon: n.lon, location: n.city || n.country || "Bitcoin node",
            description: `Reachable Bitcoin node · ${n.country || "unknown country"}`,
            type: "bitcoin", severity: "low", source: "Bitnodes", category: "finance",
            date_reported: "LIVE", reliability: "Public network crawler",
          }),
        });
        track(id);
      });
    }

    // --- GDELT geolocated news ---
    if (active.has("conflictZones") || active.has("internetOutages")) {
      gdeltEvents.slice(0, 100).forEach((g) => {
        const id = `gdelt-${g.id}`;
        viewer.entities.add({
          id,
          position: Cartesian3.fromDegrees(g.lon, g.lat, 0),
          billboard: {
            image: markerIcon("news", "#69AF00"), width: 21, height: 21,
            scaleByDistance: new NearFarScalar(1e6, 1.3, 1e8, 0.3),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          properties: {
            sightingData: JSON.stringify({
              lat: g.lat, lon: g.lon, location: g.title.slice(0, 90),
              description: g.url, type: "news", severity: "medium",
              source: `GDELT · ${g.domain}`, category: "intel", date_reported: "24h",
            }),
          } satisfies PlainEntityProperties,
        });
        track(id);
      });
    }

    // --- Open-Meteo surface wind / pressure ---
    if (active.has("wind") || active.has("isobars") || active.has("temperature") || active.has("humidity")) {
      surfaceWeather.forEach((p) => {
        const id = `surface-${p.id}`;
        const rad = (p.windDirectionDeg * Math.PI) / 180;
        const len = 2 + Math.min(6, p.windSpeedMs / 4);
        const endLat = p.lat + Math.cos(rad) * len * -0.5;
        const endLon = p.lon + Math.sin(rad) * len * -0.5;
        viewer.entities.add({
          id,
          polyline: {
            positions: [
              Cartesian3.fromDegrees(p.lon, p.lat, 30000),
              Cartesian3.fromDegrees(endLon, endLat, 30000),
            ],
            width: 2,
            material: new PolylineGlowMaterialProperty({
              glowPower: 0.3,
              color: Color.fromCssColorString("#6EE7B7").withAlpha(0.8),
            }),
          },
        });
        track(id);
        const labelId = `${id}-label`;
        viewer.entities.add({
          id: labelId,
          position: Cartesian3.fromDegrees(p.lon, p.lat, 30000),
          label: {
            text: active.has("isobars")
              ? `${Math.round(p.pressureHpa)} hPa`
              : active.has("humidity")
                ? `${Math.round(p.humidityPercent)}% RH`
                : active.has("temperature")
                  ? `${p.temperatureC.toFixed(1)}°C`
                  : `${p.windSpeedMs.toFixed(0)} m/s · ${Math.round(p.windDirectionDeg)}°`,
            font: "9px monospace",
            fillColor: hexToColor("#A5B4FC", 0.9),
            outlineColor: Color.BLACK,
            outlineWidth: 2,
            style: 2,
            verticalOrigin: VerticalOrigin.BOTTOM,
            pixelOffset: new Cartesian2(0, -8),
            scaleByDistance: new NearFarScalar(1e6, 0.9, 1e8, 0.2),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        track(labelId);
      });
    }
  }, [envLayers, auroraCells, fires, cables, bitcoinNodes, gdeltEvents, surfaceWeather]);

  // ISS — posición real de WhereTheISS.at, a su altitud, con la huella de
  // cobertura de la estación (~2 250 km de radio) para que se entienda qué ve.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    issEntityIdsRef.current.forEach((id) => {
      const e = viewer.entities.getById(id);
      if (e) viewer.entities.remove(e);
    });
    issEntityIdsRef.current = [];

    const active = envLayers ?? new Set<EnvLayerKey>();
    if (!active.has("iss") || !iss) return;
    if (!Number.isFinite(iss.lat) || !Number.isFinite(iss.lon)) return;

    const id = "iss-station";
    viewer.entities.add({
      id,
      position: Cartesian3.fromDegrees(iss.lon, iss.lat, Math.max(0, iss.altKm) * 1000),
      ellipse: {
        semiMajorAxis: 2_250_000,
        semiMinorAxis: 2_250_000,
        material: hexToColor("#f472b6", 0.05),
        outline: true,
        outlineColor: hexToColor("#f472b6", 0.3),
        outlineWidth: 1,
        height: 0,
      },
      billboard: {
        image: markerIcon("iss", "#f472b6"), width: 26, height: 26,
        verticalOrigin: VerticalOrigin.CENTER,
        scaleByDistance: new NearFarScalar(1e6, 1.2, 1e8, 0.45),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: `ISS · ${iss.altKm.toFixed(0)} km`,
        font: "10px monospace",
        fillColor: hexToColor("#fbcfe8", 0.95),
        outlineColor: Color.BLACK,
        outlineWidth: 2,
        style: 2,
        verticalOrigin: VerticalOrigin.BOTTOM,
        pixelOffset: new Cartesian2(0, -10),
        scaleByDistance: new NearFarScalar(1e6, 1, 1e8, 0.25),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      properties: eventPayload({
        lat: iss.lat, lon: iss.lon, location: "Estación Espacial Internacional",
        description:
          `Altitud ${iss.altKm.toFixed(0)} km · ${iss.speedKmh.toFixed(0)} km/h · ` +
          `${iss.visibility === "daylight" ? "a la luz del día" : "en eclipse"}`,
        type: "iss", severity: "low", source: "WhereTheISS.at (TLE NORAD 25544)",
        category: "intel", date_reported: "LIVE", reliability: "Elementos orbitales oficiales",
      }),
    });
    issEntityIdsRef.current.push(id);
  }, [iss, envLayers]);

  // Ionosfera — malla TEC de NOAA. El tamaño y el color del punto son el TEC:
  // azul (bajo) → violeta → magenta (alto), que es donde la señal GNSS llega
  // con retardo y las comunicaciones HF fallan.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    ionoEntityIdsRef.current.forEach((id) => {
      const e = viewer.entities.getById(id);
      if (e) viewer.entities.remove(e);
    });
    ionoEntityIdsRef.current = [];

    const active = envLayers ?? new Set<EnvLayerKey>();
    if (!active.has("ionosphere") || !ionosphere || !ionosphere.points.length) return;

    const span = Math.max(1, ionosphere.maxTec - ionosphere.minTec);
    ionosphere.points.forEach((p, i) => {
      const t = Math.min(1, Math.max(0, (p.tec - ionosphere.minTec) / span));
      const id = `iono-${i}`;
      viewer.entities.add({
        id,
        position: Cartesian3.fromDegrees(p.lon, p.lat, 350_000),
        point: {
          pixelSize: 4 + t * 7,
          color: hexToColor(t > 0.66 ? "#f472b6" : t > 0.33 ? "#c084fc" : "#22d3ee", 0.3 + t * 0.45),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: eventPayload({
          lat: p.lat, lon: p.lon, location: "Ionosfera",
          description: `TEC ${p.tec.toFixed(1)} TECU`, type: "ionosphere",
          severity: t > 0.66 ? "high" : "low", source: "NOAA SWPC GLOTEC",
          category: "intel", date_reported: ionosphere.observationTime, reliability: "Medido",
        }),
      });
      ionoEntityIdsRef.current.push(id);
    });
  }, [ionosphere, envLayers]);

  // Cámaras del Alien en su sitio. El marcador lleva `cameraId` en las
  // propiedades para que el clic del visor abra esa cámara en la pestaña UAP.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    cameraEntityIdsRef.current.forEach((id) => {
      const e = viewer.entities.getById(id);
      if (e) viewer.entities.remove(e);
    });
    cameraEntityIdsRef.current = [];

    const active = envLayers ?? new Set<EnvLayerKey>();
    if (!active.has("liveCameras")) return;

    cameras.forEach((camera) => {
      const id = `camera-${camera.id}`;
      viewer.entities.add({
        id,
        position: Cartesian3.fromDegrees(camera.lon, camera.lat, 0),
        billboard: {
          image: markerIcon("camera", "#f472b6"), width: 22, height: 22,
          scaleByDistance: new NearFarScalar(1e6, 1.4, 1e8, 0.3),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: camera.label,
          font: "9px monospace",
          fillColor: hexToColor("#fbcfe8", 0.9),
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          style: 2,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian2(0, -10),
          // Las etiquetas sólo aparecen de cerca: con 259 cámaras, escribirlas
          // todas a la vez tapaban el globo entero.
          scaleByDistance: new NearFarScalar(1e6, 0.9, 3e7, 0),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: {
          cameraId: camera.id,
          sightingData: JSON.stringify({
            lat: camera.lat, lon: camera.lon, location: camera.label,
            description:
              `${camera.source} · ${camera.categoryLabel}` +
              (camera.approximate ? " · sede aproximada (la ficha da la región)" : "") +
              " · pulsar para ver su ficha",
            type: "camera", severity: "low", source: camera.source,
            category: "intel", date_reported: "LIVE",
          }),
        } as PlainEntityProperties,
      });
      cameraEntityIdsRef.current.push(id);
    });
  }, [cameras, envLayers]);

  // Cinturones de Van Allen — los dos toroides de partículas atrapadas por el
  // dipolo. La geometría es la real (sección de cada cinturón en el plano del
  // ecuador magnético, inclinado 9,4° respecto al eje de rotación) y el color
  // del exterior es la intensidad que mide GOES, que orbita *dentro* de él: a
  // 6,6 R⊕ el satélite es parte del cinturón que mide. El interior es de
  // protones y se dibuja gris, sin intensidad, porque ninguna fuente abierta de
  // este proyecto lo mide: pintarlo del color de otro cinturón sería inventarlo.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    vanAllenEntityIdsRef.current.forEach((id) => {
      const e = viewer.entities.getById(id);
      if (e) viewer.entities.remove(e);
    });
    vanAllenEntityIdsRef.current = [];

    const active = envLayers ?? new Set<EnvLayerKey>();
    if (!active.has("vanAllen") || !vanAllen || !vanAllen.measuredAt) return;

    const track = (id: string) => vanAllenEntityIdsRef.current.push(id);
    const outerColor = BELT_LEVEL_COLORS[vanAllen.level];
    const toEcef = (x: number, y: number, z: number) =>
      new Cartesian3(x * EARTH_RADIUS_M, y * EARTH_RADIUS_M, z * EARTH_RADIUS_M);

    for (const ring of beltRings("outer")) {
      const id = `van-allen-outer-${ring.radiusEarth}`;
      viewer.entities.add({
        id,
        polyline: {
          positions: ring.points.map((p) => toEcef(p.x, p.y, p.z)),
          width: 2,
          // El anillo exterior, el más lejano, se dibuja más tenue: es el que se
          // pierde antes al alejarse la vista.
          material: hexToColor(outerColor, ring.radiusEarth >= 8 ? 0.4 : 0.65),
          arcType: ArcType.NONE,
        },
        properties: eventPayload({
          location: `Cinturón exterior · ${ring.radiusEarth} R⊕`,
          description:
            `Electrones >2 MeV: ${vanAllen.electronFlux.toFixed(0)} e⁻·cm⁻²·s⁻¹·sr⁻¹ ` +
            `(${vanAllen.level === "quiet" ? "tranquilo" : vanAllen.level === "elevated" ? "elevado" : vanAllen.level === "high" ? "alto" : "extremo"})`,
          type: "vanAllen", severity: vanAllen.level === "high" || vanAllen.level === "extreme" ? "high" : "low",
          source: `NOAA GOES-${vanAllen.satellite} · ${vanAllen.satellites} satélites`, category: "intel",
          date_reported: vanAllen.measuredAt, reliability: "Medido (sección en el plano del ecuador magnético)",
        }),
      });
      track(id);
    }

    for (const ring of beltRings("inner")) {
      const id = `van-allen-inner-${ring.radiusEarth}`;
      viewer.entities.add({
        id,
        polyline: {
          positions: ring.points.map((p) => toEcef(p.x, p.y, p.z)),
          width: 2,
          material: hexToColor("#64748b", 0.45),
          arcType: ArcType.NONE,
        },
        properties: eventPayload({
          location: `Cinturón interior · ${ring.radiusEarth} R⊕`,
          description: "Protones de alta energía. Sin intensidad propia: no hay fuente abierta que lo mida con esta cadencia.",
          type: "vanAllen", severity: "low", source: "Modelo estándar de radiación (geometría)",
          category: "intel", date_reported: "LIVE", reliability: "Geometría, no medida",
        }),
      });
      track(id);
    }

    // Una etiqueta en el borde exterior para poder identificar la capa de un
    // vistazo, como el hueco que dejan las líneas del cinturón.
    const labelRing = beltRings("outer").at(-1);
    const anchor = labelRing?.points[0];
    if (anchor) {
      const id = "van-allen-label";
      viewer.entities.add({
        id,
        position: toEcef(anchor.x, anchor.y, anchor.z),
        billboard: {
          image: markerIcon("belt", outerColor), width: 22, height: 22,
          scaleByDistance: new NearFarScalar(1e7, 1.3, 1e9, 0.4),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `Van Allen · ${vanAllen.level}`,
          font: "10px monospace",
          fillColor: hexToColor("#fbcfe8", 0.95),
          outlineColor: Color.BLACK, outlineWidth: 2, style: 2,
          verticalOrigin: VerticalOrigin.BOTTOM, pixelOffset: new Cartesian2(0, -10),
          scaleByDistance: new NearFarScalar(1e7, 1, 1e9, 0.3),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: eventPayload({
          location: "Cinturones de Van Allen",
          description:
            `Cinturón exterior medido por GOES: ${vanAllen.electronFlux.toFixed(0)} e⁻·cm⁻²·s⁻¹·sr⁻¹ (${vanAllen.level}). ` +
            "Cinturón interior de protones: sólo geometría, sin intensidad propia.",
          type: "vanAllen", severity: "low", source: "NOAA GOES", category: "intel",
          date_reported: vanAllen.measuredAt, reliability: "Medido",
        }),
      });
      track(id);
    }
  }, [vanAllen, envLayers]);

  // Heliosfera — el viento solar llega por el punto subsolar y sigue de largo
  // por el lado opuesto: la burbuja vista desde dentro, que es lo único que se
  // puede medir de ella (L1, a 1,5 millones de km). La frontera (heliopausa, a
  // ~120 UA, cruzada por las Voyager) va escrita en la ficha porque a escala de
  // globo no es dibujable: sería una esfera 12 000 veces más lejos que el Sol.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    heliosphereEntityIdsRef.current.forEach((id) => {
      const e = viewer.entities.getById(id);
      if (e) viewer.entities.remove(e);
    });
    heliosphereEntityIdsRef.current = [];

    const active = envLayers ?? new Set<EnvLayerKey>();
    if (!active.has("heliosphere") || !solarWind || !solarWind.measuredAt) return;

    const track = (id: string) => heliosphereEntityIdsRef.current.push(id);
    const { lat, lon } = subsolarPoint();
    const fast = solarWind.speedKms >= FAST_WIND_KMS;
    const color = fast ? "#fdba74" : "#fcd34d";
    const south = -lat;

    // Dos trazos radiales: el viento entrando por el punto subsolar y saliendo
    // por el antisolar. Es la dirección real del flujo, no una flecha decorativa.
    viewer.entities.add({
      id: "heliosphere-inflow",
      polyline: {
        positions: [
          Cartesian3.fromDegrees(lon, lat, 1_200_000),
          Cartesian3.fromDegrees(lon, lat, 0),
        ],
        width: 2.5,
        material: hexToColor(color, 0.75),
      },
      properties: eventPayload({
        location: "Viento solar llegando (punto subsolar)",
        description: `Velocidad ${solarWind.speedKms.toFixed(0)} km/s · Bz ${solarWind.bzGsm} nT (${solarWind.bzGsm < 0 ? "acoplado: entra" : "desacoplado: rebota"})`,
        type: "heliosphere", severity: fast ? "moderate" : "low",
        source: "NOAA SWPC · L1 (DSCOVR/ACE)", category: "intel",
        date_reported: solarWind.measuredAt, reliability: "Medido",
      }),
    });
    track("heliosphere-inflow");

    viewer.entities.add({
      id: "heliosphere-outflow",
      polyline: {
        positions: [
          Cartesian3.fromDegrees(lon + 180, south, 0),
          Cartesian3.fromDegrees(lon + 180, south, 1_200_000),
        ],
        width: 2,
        material: hexToColor(color, 0.45),
      },
      properties: eventPayload({
        location: "Viento solar saliendo (lado antisolar)",
        description: "El flujo continúa y estira la magnetosfera en cola: la misma corriente que infla la heliosfera.",
        type: "heliosphere", severity: "low", source: "NOAA SWPC · L1",
        category: "intel", date_reported: solarWind.measuredAt, reliability: "Dirección del flujo (geometría)",
      }),
    });
    track("heliosphere-outflow");

    viewer.entities.add({
      id: "heliosphere-marker",
      position: Cartesian3.fromDegrees(lon, lat, 1_400_000),
      billboard: {
        image: markerIcon("sun", color), width: 24, height: 24,
        scaleByDistance: new NearFarScalar(1e6, 1.3, 1e8, 0.5),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: `Viento solar ${solarWind.speedKms.toFixed(0)} km/s`,
        font: "10px monospace",
        fillColor: hexToColor("#fed7aa", 0.95),
        outlineColor: Color.BLACK, outlineWidth: 2, style: 2,
        verticalOrigin: VerticalOrigin.BOTTOM, pixelOffset: new Cartesian2(0, -12),
        scaleByDistance: new NearFarScalar(1e6, 1, 1e8, 0.3),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      properties: eventPayload({
        location: "Heliosfera · viento solar en L1",
        description:
          `Velocidad ${solarWind.speedKms.toFixed(0)} km/s · campo total ${solarWind.bt} nT · Bz ${solarWind.bzGsm} nT · ` +
          `F10,7 ${solarWind.f107} sfu. Frontera del dominio solar (heliopausa) a ~${HELIOPAUSE_AU} UA: ` +
          "cruzada por Voyager 1 en 2012 (121,6 UA) y Voyager 2 en 2018 (119 UA), sin sondeo en vivo.",
        type: "heliosphere", severity: fast ? "moderate" : "low", source: "NOAA SWPC · viento solar en L1",
        category: "intel", date_reported: solarWind.measuredAt, reliability: "Medido en L1",
      }),
    });
    track("heliosphere-marker");
  }, [solarWind, envLayers]);

  return (
    <div ref={containerRef} className="w-full h-full" style={{ background: "#000000" }} />
  );
}

