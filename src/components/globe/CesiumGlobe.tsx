// @ts-nocheck
import { useEffect, useRef, useCallback } from "react";
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
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import type { HotspotData } from "./GlobeScene";
import type { UAPSighting } from "@/hooks/useUAPSightings";
import type { Earthquake } from "@/hooks/useEarthquakes";
import type { NasaEvent } from "@/hooks/useNasaEvents";

const CESIUM_TOKEN =
  import.meta.env.VITE_CESIUM_TOKEN ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YzgzOGZkOS0zYTdjLTQ0NTctYjkzOS00MGJmOWY4NzBlMmQiLCJpZCI6NDAwMzQxLCJpYXQiOjE3NzI5ODYzODJ9.fDprRtLyVdJxT28_Sc0_-fNfCsw3yyESOQ0IDQefDJM";

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

type LayerKey = "markets" | "uap" | "cryptozoo";

interface CesiumGlobeProps {
  onHotspotClick?: (data: HotspotData | null) => void;
  sightings?: UAPSighting[];
  visibleLayers?: Set<LayerKey>;
  flyTo?: { lat: number; lon: number; alt: number } | null;
  kpIndex?: number;
  earthquakes?: Earthquake[];
  nasaEvents?: NasaEvent[];
}

export function CesiumGlobe({
  onHotspotClick, sightings = [], visibleLayers, flyTo, kpIndex = 0,
  earthquakes = [], nasaEvents = [],
}: CesiumGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumViewer | null>(null);
  const sightingEntityIdsRef = useRef<string[]>([]);
  const marketEntityIdsRef = useRef<string[]>([]);
  const arcEntityIdsRef = useRef<string[]>([]);
  const teslaAuraRef = useRef<string[]>([]);
  const quakeEntityIdsRef = useRef<string[]>([]);
  const nasaEntityIdsRef = useRef<string[]>([]);

  const handleHotspotClick = useCallback(
    (data: HotspotData | null) => { onHotspotClick?.(data); },
    [onHotspotClick]
  );

  // Initialize viewer once
  useEffect(() => {
    if (!containerRef.current) return;
    Ion.defaultAccessToken = CESIUM_TOKEN;

    const viewer = new CesiumViewer(containerRef.current, {
      animation: false, baseLayerPicker: false, fullscreenButton: false,
      geocoder: false, homeButton: false, infoBox: false, sceneModePicker: false,
      selectionIndicator: false, timeline: false, navigationHelpButton: false,
      creditContainer: document.createElement("div"),
      terrainProvider: new EllipsoidTerrainProvider(),
      contextOptions: { webgl: { alpha: false } },
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

    // Dense star field skybox
    try {
      viewer.scene.skyBox = new SkyBox({
        sources: {
          positiveX: "https://cesium.com/public/SandcastleSampleData/skybox_px.jpg",
          negativeX: "https://cesium.com/public/SandcastleSampleData/skybox_mx.jpg",
          positiveY: "https://cesium.com/public/SandcastleSampleData/skybox_py.jpg",
          negativeY: "https://cesium.com/public/SandcastleSampleData/skybox_my.jpg",
          positiveZ: "https://cesium.com/public/SandcastleSampleData/skybox_pz.jpg",
          negativeZ: "https://cesium.com/public/SandcastleSampleData/skybox_mz.jpg",
        },
      });
    } catch (e) {
      console.warn("Skybox init failed, using default stars:", e);
    }

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

    // ArcGIS satellite imagery
    try {
      ArcGisMapServerImageryProvider.fromUrl(
        "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer"
      ).then((provider) => {
        if (!viewer.isDestroyed()) {
          viewer.imageryLayers.removeAll();
          viewer.imageryLayers.addImageryProvider(provider);
          IonImageryProvider.fromAssetId(3812).then((nightProv) => {
            if (!viewer.isDestroyed()) {
              const nl = viewer.imageryLayers.addImageryProvider(nightProv);
              nl.dayAlpha = 0.0; nl.nightAlpha = 0.9; nl.brightness = 2.0;
            }
          }).catch(() => {});
        }
      });
    } catch (e) { console.warn("ArcGIS failed:", e); }

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
              const pulse = 1 + 0.15 * Math.sin((elapsed / 6000) * Math.PI * 2 + ring + 1);
              return baseRadius * 0.6 * pulse;
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
            return baseRadius * pulse;
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
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(flyTo.lon, flyTo.lat, flyTo.alt),
      orientation: { heading: CesiumMath.toRadians(0), pitch: CesiumMath.toRadians(-90), roll: 0 },
      duration: 1.5,
    });
  }, [flyTo]);

  return (
    <div ref={containerRef} className="w-full h-full" style={{ background: "#000000" }} />
  );
}
