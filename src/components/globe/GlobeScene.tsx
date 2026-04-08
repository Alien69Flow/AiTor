import { useEffect, useRef, useState, useCallback } from "react";
import Globe from "react-globe.gl";

// ARQUITECTURA DE DATOS
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
  type: "conflict" | "finance" | "tech" | "geopolitical" | "quake" | "dao_node" | "nasa";
}

const DAO_BASE_HOTSPOTS: UnifiedHotspotData[] = [
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

// Aurora rings for Tesla layer
const AURORA_RINGS = [
  { lat: 67, lng: 0, maxR: 6, propagationSpeed: 2, repeatPeriod: 3000, color: () => "#00ffff88" },
  { lat: 67, lng: 120, maxR: 5, propagationSpeed: 1.5, repeatPeriod: 4000, color: () => "#ff00ff66" },
  { lat: 67, lng: 240, maxR: 4, propagationSpeed: 2.5, repeatPeriod: 3500, color: () => "#00ff4166" },
  { lat: -67, lng: 60, maxR: 6, propagationSpeed: 2, repeatPeriod: 3000, color: () => "#00ffff88" },
  { lat: -67, lng: 180, maxR: 5, propagationSpeed: 1.5, repeatPeriod: 4000, color: () => "#ff00ff66" },
  { lat: -67, lng: 300, maxR: 4, propagationSpeed: 2.5, repeatPeriod: 3500, color: () => "#00ff4166" },
];

export function GlobeScene({ onHotspotClick }: { onHotspotClick?: (d: UnifiedHotspotData | null) => void }) {
  const globeRef = useRef<any>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pointsData, setPointsData] = useState<UnifiedHotspotData[]>(DAO_BASE_HOTSPOTS);
  const [arcsData, setArcsData] = useState<any[]>([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Data: arcs + USGS earthquakes
  useEffect(() => {
    const pairs = [[0, 5], [2, 8], [11, 13], [14, 6], [9, 1], [15, 7]];
    const newArcs = pairs.map(([a, b]) => {
      const start = DAO_BASE_HOTSPOTS[a];
      const end = DAO_BASE_HOTSPOTS[b];
      if (!start || !end) return null;
      return {
        startLat: start.lat, startLng: start.lon,
        endLat: end.lat, endLng: end.lon,
        color: [start.color, end.color],
      };
    }).filter(Boolean);
    setArcsData(newArcs);

    fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson')
      .then(res => res.json())
      .then(data => {
        const quakes: UnifiedHotspotData[] = (data.features || []).map((feat: any) => ({
          lat: feat.geometry.coordinates[1],
          lon: feat.geometry.coordinates[0],
          intensity: (feat.properties.mag || 4) / 9,
          color: "#ffff00",
          name: feat.properties.title || "Earthquake",
          country: "USGS",
          marketVolume: "N/A",
          trend: "N/A",
          topTokens: [] as string[],
          type: "quake" as const,
        }));
        setPointsData(prev => [...DAO_BASE_HOTSPOTS, ...quakes]);
      })
      .catch(e => console.warn("USGS fetch error:", e));
  }, []);

  // Globe controls
  useEffect(() => {
    if (!globeRef.current) return;
    const t = setTimeout(() => {
      if (!globeRef.current) return;
      globeRef.current.pointOfView({ lat: 25, lng: 30, altitude: 2.3 }, 1500);
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.4;
      }
    }, 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full bg-black">
      {dimensions.width > 0 && (
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}

          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"

          showGraticules={true}
          graticulesColor="rgba(0, 255, 65, 0.05)"

          showAtmosphere={true}
          atmosphereColor="#00aaff"
          atmosphereAltitude={0.18}

          pointsData={pointsData}
          pointLat="lat"
          pointLng="lon"
          pointColor="color"
          pointAltitude={(d: any) => d.type === 'quake' ? 0.01 : 0.02}
          pointRadius={(d: any) => d.type === 'quake' ? d.intensity * 0.6 : d.intensity * 0.4}
          onPointClick={(point: any) => onHotspotClick?.(point as UnifiedHotspotData)}

          labelsData={pointsData.filter(d => d.type !== 'quake')}
          labelLat="lat"
          labelLng="lon"
          labelText="name"
          labelSize={0.4}
          labelDotRadius={0}
          labelColor={() => 'rgba(255, 255, 255, 0.7)'}
          labelResolution={2}

          arcsData={arcsData}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcColor="color"
          arcDashLength={0.5}
          arcDashGap={0.3}
          arcDashAnimateTime={() => 1500 + Math.random() * 2000}
          arcStroke={0.4}

          ringsData={AURORA_RINGS}
          ringLat="lat"
          ringLng="lng"
          ringMaxRadius="maxR"
          ringPropagationSpeed="propagationSpeed"
          ringRepeatPeriod="repeatPeriod"
          ringColor="color"
        />
      )}
    </div>
  );
}
