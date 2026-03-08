import { useEffect, useRef, useCallback } from "react";
import {
  Ion,
  Viewer as CesiumViewer,
  Cartesian3,
  Color,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defined,
  HeadingPitchRange,
  Math as CesiumMath,
  VerticalOrigin,
  HorizontalOrigin,
  NearFarScalar,
  PolylineGlowMaterialProperty,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import type { HotspotData } from "./GlobeScene";

const CESIUM_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YzgzOGZkOS0zYTdjLTQ0NTctYjkzOS00MGJmOWY4NzBlMmQiLCJpZCI6NDAwMzQxLCJpYXQiOjE3NzI5ODYzODJ9.fDprRtLyVdJxT28_Sc0_-fNfCsw3yyESOQ0IDQefDJM";

const HOTSPOT_DATA: HotspotData[] = [
  { lat: 35.7, lon: 51.4, intensity: 1, color: "#ff4444", name: "Tehran", country: "Iran", marketVolume: "$2.1B", trend: "-12%", topTokens: ["USDT", "BTC"], type: "conflict" },
  { lat: 32.0, lon: 34.8, intensity: 0.9, color: "#ff6644", name: "Tel Aviv", country: "Israel", marketVolume: "$8.4B", trend: "+5%", topTokens: ["ETH", "MATIC"], type: "conflict" },
  { lat: 29.3, lon: 47.9, intensity: 0.7, color: "#ff8844", name: "Kuwait City", country: "Kuwait", marketVolume: "$1.2B", trend: "+2%", topTokens: ["BTC", "BNB"], type: "geopolitical" },
  { lat: 26.2, lon: 50.5, intensity: 0.6, color: "#ff8844", name: "Manama", country: "Bahrain", marketVolume: "$0.8B", trend: "+8%", topTokens: ["BTC", "XRP"], type: "finance" },
  { lat: 24.4, lon: 54.6, intensity: 0.5, color: "#ffaa44", name: "Abu Dhabi", country: "UAE", marketVolume: "$14.2B", trend: "+15%", topTokens: ["BTC", "ETH", "SOL"], type: "finance" },
  { lat: 51.5, lon: -0.1, intensity: 0.4, color: "#00ff41", name: "London", country: "UK", marketVolume: "$42.1B", trend: "+3%", topTokens: ["BTC", "ETH", "LINK"], type: "finance" },
  { lat: 48.8, lon: 2.3, intensity: 0.3, color: "#00ff41", name: "Paris", country: "France", marketVolume: "$12.8B", trend: "+1%", topTokens: ["BTC", "ETH"], type: "tech" },
  { lat: 52.5, lon: 13.4, intensity: 0.3, color: "#00ff41", name: "Berlin", country: "Germany", marketVolume: "$9.5B", trend: "+4%", topTokens: ["BTC", "DOT"], type: "tech" },
  { lat: 40.7, lon: -74.0, intensity: 0.5, color: "#00ff41", name: "New York", country: "USA", marketVolume: "$89.3B", trend: "+7%", topTokens: ["BTC", "ETH", "SOL", "DOGE"], type: "finance" },
  { lat: 38.9, lon: -77.0, intensity: 0.6, color: "#00ff41", name: "Washington DC", country: "USA", marketVolume: "$5.2B", trend: "+2%", topTokens: ["BTC", "ETH"], type: "geopolitical" },
  { lat: 34.0, lon: -118.2, intensity: 0.3, color: "#00ff41", name: "Los Angeles", country: "USA", marketVolume: "$18.7B", trend: "+6%", topTokens: ["SOL", "AVAX"], type: "tech" },
  { lat: 39.9, lon: 116.4, intensity: 0.7, color: "#ffdd44", name: "Beijing", country: "China", marketVolume: "$35.6B", trend: "-3%", topTokens: ["BTC", "ETH"], type: "geopolitical" },
  { lat: 35.6, lon: 139.6, intensity: 0.4, color: "#00ff41", name: "Tokyo", country: "Japan", marketVolume: "$28.4B", trend: "+9%", topTokens: ["BTC", "XRP", "ASTR"], type: "finance" },
  { lat: 37.5, lon: 127.0, intensity: 0.3, color: "#00ff41", name: "Seoul", country: "South Korea", marketVolume: "$22.1B", trend: "+11%", topTokens: ["BTC", "ETH", "XRP"], type: "tech" },
  { lat: 55.7, lon: 37.6, intensity: 0.5, color: "#ff6644", name: "Moscow", country: "Russia", marketVolume: "$4.8B", trend: "-8%", topTokens: ["BTC", "USDT"], type: "geopolitical" },
  { lat: 48.7, lon: 37.5, intensity: 0.8, color: "#ff4444", name: "Donetsk", country: "Ukraine", marketVolume: "$0.1B", trend: "-25%", topTokens: ["USDT"], type: "conflict" },
];

const ARC_PAIRS = [[0, 5], [3, 8], [11, 13], [14, 6], [9, 1], [7, 12]];

function hexToColor(hex: string, alpha = 1): Color {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return new Color(r, g, b, alpha);
}

interface CesiumGlobeProps {
  onHotspotClick?: (data: HotspotData | null) => void;
}

export function CesiumGlobe({ onHotspotClick }: CesiumGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumViewer | null>(null);

  const handleHotspotClick = useCallback(
    (data: HotspotData | null) => {
      onHotspotClick?.(data);
    },
    [onHotspotClick]
  );

  useEffect(() => {
    if (!containerRef.current) return;

    Ion.defaultAccessToken = CESIUM_TOKEN;

    const viewer = new CesiumViewer(containerRef.current, {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      navigationHelpButton: false,
      creditContainer: document.createElement("div"),
      skyBox: false,
      skyAtmosphere: undefined,
      contextOptions: {
        webgl: { alpha: true },
      },
    });

    // Dark atmosphere
    viewer.scene.backgroundColor = Color.TRANSPARENT;
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.atmosphereLightIntensity = 5.0;

    viewerRef.current = viewer;

    // Add hotspot entities
    HOTSPOT_DATA.forEach((spot, idx) => {
      const position = Cartesian3.fromDegrees(spot.lon, spot.lat, 0);
      const pointSize = 8 + spot.intensity * 12;

      viewer.entities.add({
        position,
        point: {
          pixelSize: pointSize,
          color: hexToColor(spot.color, 0.85),
          outlineColor: hexToColor(spot.color, 0.4),
          outlineWidth: 3,
          scaleByDistance: new NearFarScalar(1e6, 1.2, 1e8, 0.4),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: spot.name,
          font: "11px monospace",
          fillColor: Color.fromCssColorString("#00ff41"),
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          style: 2, // FILL_AND_OUTLINE
          verticalOrigin: VerticalOrigin.BOTTOM,
          horizontalOrigin: HorizontalOrigin.CENTER,
          pixelOffset: new Cartesian3(0, -14, 0) as any,
          scaleByDistance: new NearFarScalar(1e6, 1, 1e8, 0.3),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: { hotspotIndex: idx } as any,
      });
    });

    // Add arcs
    ARC_PAIRS.forEach(([a, b]) => {
      if (!HOTSPOT_DATA[a] || !HOTSPOT_DATA[b]) return;
      const start = HOTSPOT_DATA[a];
      const end = HOTSPOT_DATA[b];

      // Create arc points through interpolation with altitude
      const arcPoints: Cartesian3[] = [];
      const segments = 50;
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const lat = start.lat + (end.lat - start.lat) * t;
        const lon = start.lon + (end.lon - start.lon) * t;
        // Parabolic altitude for arc effect
        const alt = Math.sin(t * Math.PI) * 500000;
        arcPoints.push(Cartesian3.fromDegrees(lon, lat, alt));
      }

      viewer.entities.add({
        polyline: {
          positions: arcPoints,
          width: 1.5,
          material: new PolylineGlowMaterialProperty({
            glowPower: 0.3,
            color: Color.fromCssColorString("#00ff41").withAlpha(0.4),
          }),
        },
      });
    });

    // Click handler
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: any) => {
      const picked = viewer.scene.pick(click.position);
      if (defined(picked) && picked.id?.properties) {
        const idx = picked.id.properties.hotspotIndex?.getValue();
        if (idx !== undefined && HOTSPOT_DATA[idx]) {
          handleHotspotClick(HOTSPOT_DATA[idx]);
        }
      } else {
        handleHotspotClick(null);
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    // Initial camera position
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(20, 20, 20000000),
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-90),
        roll: 0,
      },
      duration: 0,
    });

    return () => {
      handler.destroy();
      if (!viewer.isDestroyed()) {
        viewer.destroy();
      }
    };
  }, [handleHotspotClick]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ background: "transparent" }}
    />
  );
}
