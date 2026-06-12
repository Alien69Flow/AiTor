import { useEffect, useRef, useState, useCallback } from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";
import {
  Layers,
  X,
  Cloud,
  Radio,
  Flame,
  Plane,
  TrendingUp,
  Shield,
  Radar,
  Crosshair,
} from "lucide-react";
import { useSpaceWeather } from "@/hooks/useSpaceWeather";
import {
  createAtmosphereShell,
  createAuroraCurtains,
  createVanAllenBelts,
  createMagneticFlux,
  createTelluricGrid,
  getGIBSCloudTexture,
} from "./layers/HighFidelityLayers";

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
  type: "conflict" | "finance" | "tech" | "geopolitical" | "quake" | "dao_node" | "nasa" | "aircraft";
}

export type HotspotData = UnifiedHotspotData;

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
  { lat: 41.65, lon: -0.88, intensity: 1.0, color: "#ffffff", name: "DAO HQ", country: "Zaragoza", marketVolume: "∞", trend: "N/A", topTokens: ["CONVERGENCE"], type: "dao_node" },
];

function getAuroraRings(kpIndex: number) {
  const active = kpIndex >= 4;
  const severe = kpIndex >= 6;
  const baseAlpha = active ? 'cc' : '44';
  const maxR = active ? 8 : 4;
  const speed = active ? 3 : 1.5;
  const rings = [
    { lat: 67, lng: 0, maxR, propagationSpeed: speed, repeatPeriod: 3000, color: () => `#00ffff${baseAlpha}` },
    { lat: 67, lng: 120, maxR: maxR * 0.8, propagationSpeed: speed * 0.75, repeatPeriod: 4000, color: () => `#ff00ff${active ? 'aa' : '33'}` },
    { lat: 67, lng: 240, maxR: maxR * 0.7, propagationSpeed: speed * 1.2, repeatPeriod: 3500, color: () => `#00ff41${active ? '99' : '33'}` },
    { lat: -67, lng: 60, maxR, propagationSpeed: speed, repeatPeriod: 3000, color: () => `#00ffff${baseAlpha}` },
    { lat: -67, lng: 180, maxR: maxR * 0.8, propagationSpeed: speed * 0.75, repeatPeriod: 4000, color: () => `#ff00ff${active ? 'aa' : '33'}` },
    { lat: -67, lng: 300, maxR: maxR * 0.7, propagationSpeed: speed * 1.2, repeatPeriod: 3500, color: () => `#00ff41${active ? '99' : '33'}` },
  ];
  if (severe) {
    rings.push(
      { lat: 0, lng: 0, maxR: 5, propagationSpeed: 2, repeatPeriod: 5000, color: () => '#ff00ff55' },
      { lat: 0, lng: 180, maxR: 4, propagationSpeed: 1.5, repeatPeriod: 6000, color: () => '#00ffff44' },
    );
  }
  return rings;
}

function addMoon(scene: THREE.Scene) {
  const loader = new THREE.TextureLoader();
  const moonGeo = new THREE.SphereGeometry(8, 32, 32);
  const moonMat = new THREE.MeshPhongMaterial({
    map: loader.load("https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Moon_Farside_LRO.jpg/1024px-Moon_Farside_LRO.jpg"),
    emissive: new THREE.Color(0x222222),
  });
  const moon = new THREE.Mesh(moonGeo, moonMat);
  moon.position.set(250, 80, -150);
  moon.name = "moon";
  scene.add(moon);
  return moon;
}

function addSunLight(scene: THREE.Scene) {
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.8);
  sunLight.position.set(-300, 100, 200);
  scene.add(sunLight);
  const ambient = new THREE.AmbientLight(0x334466, 0.4);
  scene.add(ambient);

  const spriteMat = new THREE.SpriteMaterial({
    map: new THREE.TextureLoader().load("data:image/svg+xml," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffee" stop-opacity="1"/><stop offset="30%" stop-color="#ffdd88" stop-opacity="0.6"/><stop offset="100%" stop-color="#ff8800" stop-opacity="0"/></radialGradient><circle cx="64" cy="64" r="64" fill="url(#g)"/></svg>`
    )),
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const sunSprite = new THREE.Sprite(spriteMat);
  sunSprite.position.set(-300, 100, 200);
  sunSprite.scale.set(80, 80, 1);
  scene.add(sunSprite);
}

interface GlobeSceneProps {
  onHotspotClick?: (d: UnifiedHotspotData | null) => void;
  onReady?: (navigateFn: (lat: number, lng: number, altitude: number) => void) => void;
  externalMarkers?: UnifiedHotspotData[];
  cloudsEnabled?: boolean;
  weatherEnabled?: boolean;
  firesEnabled?: boolean;
  aircraftEnabled?: boolean;
  marketsEnabled?: boolean;
}

const ZARAGOZA = { lat: 41.65, lon: -0.88 };

// LED indicator with halo glow (reserved for status micro-indicators)
const LedIndicator = ({ color, active = true, size = "sm" }: { color: string; active?: boolean; size?: "sm" | "md" | "lg" }) => {
  const dim = size === "sm" ? "w-1.5 h-1.5" : size === "lg" ? "w-3 h-3" : "w-2 h-2";
  return (
    <div
      className={`rounded-full transition-all duration-300 ${dim} ${active ? 'animate-pulse' : ''}`}
      style={{
        backgroundColor: active ? color : 'rgba(71, 85, 105, 0.4)',
        boxShadow: active ? `0 0 8px ${color}80, 0 0 16px ${color}40` : 'none',
      }}
    />
  );
};

export function GlobeScene({
  onHotspotClick,
  onReady,
  externalMarkers,
  cloudsEnabled: cloudsEnabledProp = true,
  weatherEnabled: weatherEnabledProp = true,
  firesEnabled: firesEnabledProp = true,
  aircraftEnabled: aircraftEnabledProp = true,
  marketsEnabled: marketsEnabledProp = true,
}: GlobeSceneProps) {
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [localCloudsEnabled, setLocalCloudsEnabled] = useState(cloudsEnabledProp);
  const [localWeatherEnabled, setLocalWeatherEnabled] = useState(weatherEnabledProp);
  const [localAtmosphereEnabled, setLocalAtmosphereEnabled] = useState(true);
  const [localFiresEnabled, setLocalFiresEnabled] = useState(firesEnabledProp);
  const [localAircraftEnabled, setLocalAircraftEnabled] = useState(aircraftEnabledProp);
  const [localMarketsEnabled, setLocalMarketsEnabled] = useState(marketsEnabledProp);

  const cloudsEnabled = localCloudsEnabled;
  const weatherEnabled = localWeatherEnabled;
  const firesEnabled = localFiresEnabled;
  const aircraftEnabled = localAircraftEnabled;
  const marketsEnabled = localMarketsEnabled;

  const globeRef = useRef<any>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pointsData, setPointsData] = useState<UnifiedHotspotData[]>(DAO_BASE_HOTSPOTS);
  const [arcsData, setArcsData] = useState<any[]>([]);
  const [weatherHeat, setWeatherHeat] = useState<{ lat: number; lng: number; weight: number }[]>([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [altitude, setAltitude] = useState(2.2);
  const cloudsMeshRef = useRef<THREE.Mesh | null>(null);
  const sceneEnhanced = useRef(false);
  const auroraRef = useRef<THREE.Group | null>(null);
  const vanAllenRef = useRef<THREE.Group | null>(null);
  const telluricRef = useRef<THREE.Group | null>(null);
  const magneticRef = useRef<THREE.Group | null>(null);
  const atmosphereShellRef = useRef<THREE.Mesh | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const { kpIndex } = useSpaceWeather();

  const atmosphereColor = kpIndex >= 4 ? "#ff00ff" : "#00ffff";
  const atmosphereAlt = kpIndex >= 6 ? 0.45 : kpIndex >= 4 ? 0.35 : 0.25;
  const auroraRings = getAuroraRings(kpIndex);

  const globeImageUrl = altitude < 0.6
    ? "https://eoimages.gsfc.nasa.gov/images/imagerecords/74000/74218/world.200412.3x21600x10800.jpg"
    : altitude < 1.2
    ? "https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg"
    : "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg";

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

  const enhanceScene = useCallback(() => {
    if (!globeRef.current || sceneEnhanced.current) return;
    const scene = globeRef.current.scene();
    const renderer = globeRef.current.renderer();
    if (!scene || !renderer) return;
    sceneEnhanced.current = true;

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const toRemove: THREE.Object3D[] = [];
    scene.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.AmbientLight || child instanceof THREE.DirectionalLight) {
        toRemove.push(child);
      }
    });
    toRemove.forEach(l => scene.remove(l));

    addSunLight(scene);
    addMoon(scene);

    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";
    const cloudsGeo = new THREE.SphereGeometry(100.6, 64, 64);
    const gibsUrl = getGIBSCloudTexture();
    const cloudTex = loader.load(gibsUrl, undefined, undefined, () => {
      const fallback = loader.load("https://unpkg.com/three-globe/example/img/earth-clouds.png");
      if (cloudsMeshRef.current) {
        (cloudsMeshRef.current.material as THREE.MeshPhongMaterial).map = fallback;
        (cloudsMeshRef.current.material as THREE.MeshPhongMaterial).needsUpdate = true;
      }
    });
    const cloudsMat = new THREE.MeshPhongMaterial({ map: cloudTex, transparent: true, opacity: 0.5, depthWrite: false });
    const cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
    cloudsMesh.name = "meteosat_clouds";
    scene.add(cloudsMesh);
    cloudsMeshRef.current = cloudsMesh;

    const atmosphereShell = createAtmosphereShell(1, atmosphereColor);
    scene.add(atmosphereShell);
    atmosphereShellRef.current = atmosphereShell;

    const auroras = createAuroraCurtains(kpIndex);
    scene.add(auroras);
    auroraRef.current = auroras;

    const vanAllen = createVanAllenBelts();
    scene.add(vanAllen);
    vanAllenRef.current = vanAllen;

    const telluric = createTelluricGrid();
    scene.add(telluric);
    telluricRef.current = telluric;

    const magnetic = createMagneticFlux();
    scene.add(magnetic);
    magneticRef.current = magnetic;

    const animateClouds = () => {
      if (cloudsMeshRef.current) cloudsMeshRef.current.rotation.y += 0.0003;
      if (auroraRef.current) auroraRef.current.rotation.y += 0.0006;
      if (vanAllenRef.current) vanAllenRef.current.rotation.y -= 0.0004;
      if (telluricRef.current) telluricRef.current.rotation.y += 0.0002;
      requestAnimationFrame(animateClouds);
    };
    animateClouds();
  }, [atmosphereColor, kpIndex]);

  useEffect(() => {
    const pairs = [[0, 5], [2, 8], [11, 13], [14, 6], [9, 1], [15, 7], [4, 12], [10, 3]];
    const newArcs: any[] = pairs.map(([a, b]) => {
      const start = DAO_BASE_HOTSPOTS[a];
      const end = DAO_BASE_HOTSPOTS[b];
      if (!start || !end) return null;
      return { startLat: start.lat, startLng: start.lon, endLat: end.lat, endLng: end.lon, color: [start.color + "cc", end.color + "cc"] };
    }).filter(Boolean);

    const zaragoza = DAO_BASE_HOTSPOTS[DAO_BASE_HOTSPOTS.length - 1];
    [5, 8, 12, 11].forEach(idx => {
      const target = DAO_BASE_HOTSPOTS[idx];
      if (target) newArcs.push({ startLat: zaragoza.lat, startLng: zaragoza.lon, endLat: target.lat, endLng: target.lon, color: ["#00ff4188", "#00ff4133"] });
    });
    setArcsData(newArcs);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    (async () => {
      try {
        const res = await fetch('https://opensky-network.org/api/states/all?lamin=20&lamax=60&lomin=-30&lomax=60', { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.states) return;
        const aircraft: UnifiedHotspotData[] = data.states.slice(0, 80).map((s: any[]) => ({
          lat: s[6] || 0, lon: s[5] || 0, intensity: 0.15, color: "#ffffff",
          name: (s[1] || "").trim() || s[0] || "Aircraft", country: s[2] || "Unknown",
          marketVolume: `${Math.round(s[7] || 0)}m alt`, trend: `${Math.round(s[9] || 0)}m/s`, topTokens: [], type: "aircraft" as const,
        })).filter((a: UnifiedHotspotData) => a.lat !== 0 && a.lon !== 0);
        setPointsData(prev => [...prev.filter(p => p.type !== 'aircraft'), ...aircraft]);
      } catch {} finally { clearTimeout(timeoutId); }
    })();
    return () => { clearTimeout(timeoutId); controller.abort(); };
  }, []);

  useEffect(() => {
    if (!externalMarkers) return;
    setPointsData(prev => [...DAO_BASE_HOTSPOTS, ...externalMarkers, ...prev.filter(p => p.type === 'aircraft')]);
  }, [externalMarkers]);

  useEffect(() => {
    if (!globeRef.current) return;
    const t = setTimeout(() => {
      if (!globeRef.current) return;
      globeRef.current.pointOfView({ lat: 25, lng: 30, altitude: 2.2 }, 1500);
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = true; controls.autoRotateSpeed = 0.35;
        controls.enableDamping = true; controls.dampingFactor = 0.1;
        controls.enableZoom = true; controls.enableRotate = true; controls.enablePan = true;
        controls.minDistance = 101; controls.maxDistance = 500;
        controls.addEventListener("change", () => {
          const pov = globeRef.current?.pointOfView();
          if (pov && typeof pov.altitude === "number") setAltitude(prev => Math.abs(pov.altitude - prev) > 0.15 ? pov.altitude : prev);
        });
      }
      enhanceScene();
      if (onReadyRef.current) onReadyRef.current((lat, lng, alt) => globeRef.current?.pointOfView({ lat, lng, altitude: alt }, 1500));
    }, 800);
    return () => clearTimeout(t);
  }, [enhanceScene]);

  useEffect(() => { if (cloudsMeshRef.current) cloudsMeshRef.current.visible = cloudsEnabled; }, [cloudsEnabled]);
  useEffect(() => { if (atmosphereShellRef.current) atmosphereShellRef.current.visible = localAtmosphereEnabled; }, [localAtmosphereEnabled]);

  useEffect(() => {
    if (!weatherEnabled) { setWeatherHeat([]); return; }
    setWeatherHeat(Array.from({ length: 15 }, () => ({
      lat: ZARAGOZA.lat + (Math.random() - 0.5) * 8,
      lng: ZARAGOZA.lon + (Math.random() - 0.5) * 8,
      weight: Math.random() * 0.6 + 0.2,
    })));
  }, [weatherEnabled]);

  const visiblePoints = pointsData.filter((p: any) => {
    if (p.type === 'aircraft') return aircraftEnabled;
    if (p.type === 'nasa') return firesEnabled;
    if (p.type === 'finance') return marketsEnabled;
    return true;
  });

  const getPointColor = useCallback((d: any) => d.type === 'aircraft' ? '#ffffff' : d.type === 'quake' ? '#facc15' : d.type === 'dao_node' ? '#ffffff' : d.color, []);
  const getPointAlt = useCallback((d: any) => d.type === 'aircraft' ? 0.06 : d.type === 'quake' ? 0.008 : d.type === 'dao_node' ? 0.03 : 0.02 + d.intensity * 0.01, []);
  const getPointRadius = useCallback((d: any) => d.type === 'aircraft' ? 0.08 : d.type === 'quake' ? d.intensity * 0.5 : d.type === 'dao_node' ? 0.6 : d.intensity * 0.35, []);

  // Glass Toggle Button
  const GlassToggle = ({ icon: Icon, label, checked, onChange, ledColor }: { icon: React.ElementType; label: string; checked: boolean; onChange: (v: boolean) => void; ledColor?: string }) => (
    <button
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[10px] font-medium uppercase tracking-wider transition-all duration-200 border backdrop-blur-lg ${
        checked
          ? 'bg-slate-800/40 border-slate-600/50 text-slate-200 shadow-[0_0_12px_rgba(100,116,139,0.1)]'
          : 'bg-slate-900/30 border-slate-700/30 text-slate-500 hover:text-slate-400 hover:border-slate-600/40'
      }`}
    >
      <Icon className={`w-3.5 h-3.5 ${checked ? 'text-slate-300' : 'text-slate-600'}`} />
      <span className="flex-1 text-left">{label}</span>
      <LedIndicator color={ledColor || '#00ff41'} active={checked} size="sm" />
    </button>
  );

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] overflow-hidden bg-black">

      {/* Globe container */}
      <div ref={containerRef} className="absolute inset-0 z-10">
        {dimensions.width > 0 && (
          <Globe
            ref={globeRef}
            width={dimensions.width}
            height={dimensions.height}
            globeImageUrl={globeImageUrl}
            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
            backgroundImageUrl="https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/ESO_-_Milky_Way.jpg/1280px-ESO_-_Milky_Way.jpg"
            {...{ nightImageUrl: "//unpkg.com/three-globe/example/img/earth-night.jpg" } as any}
            showGraticules={true}
            showAtmosphere={true}
            atmosphereColor={atmosphereColor}
            atmosphereAltitude={atmosphereAlt}
            pointsData={visiblePoints}
            pointLat="lat"
            pointLng="lon"
            pointColor={getPointColor}
            pointAltitude={getPointAlt}
            pointRadius={getPointRadius}
            onPointClick={(point: any) => onHotspotClick?.(point as UnifiedHotspotData)}
            labelsData={visiblePoints.filter(d => d.type !== 'quake' && d.type !== 'aircraft')}
            labelLat="lat"
            labelLng="lon"
            labelText="name"
            labelSize={0.4}
            labelDotRadius={0.1}
            labelColor={() => 'rgba(0, 255, 65, 0.9)'}
            labelResolution={2}
            arcsData={arcsData}
            arcStartLat="startLat"
            arcStartLng="startLng"
            arcEndLat="endLat"
            arcEndLng="endLng"
            arcColor="color"
            arcDashLength={0.4}
            arcDashGap={0.2}
            arcDashAnimateTime={() => 800 + Math.random() * 2000}
            arcStroke={0.4}
            ringsData={auroraRings}
            ringLat="lat"
            ringLng="lng"
            ringMaxRadius="maxR"
            ringPropagationSpeed="propagationSpeed"
            ringRepeatPeriod="repeatPeriod"
            ringColor="color"
            {...{
              heatmapsData: weatherEnabled && weatherHeat.length ? [weatherHeat] : [],
              heatmapPointLat: "lat",
              heatmapPointLng: "lng",
              heatmapPointWeight: "weight",
              heatmapBandwidth: 2.5,
              heatmapColorSaturation: 3.0,
              heatmapBaseAltitude: 0.01,
              heatmapTopAltitude: 0.08,
            } as any}
          />
        )}
      </div>

      {/* MOBILE: Floating layers button */}
      <button onClick={() => setMobilePanelOpen(!mobilePanelOpen)}
        className="block lg:hidden absolute bottom-6 right-6 z-30 w-14 h-14 rounded-2xl bg-slate-900/60 border border-slate-600/40 backdrop-blur-xl flex items-center justify-center shadow-lg shadow-black/30 transition-transform active:scale-95">
        <Layers className="w-6 h-6 text-slate-300" />
      </button>

      {/* MOBILE: Bottom Sheet */}
      <div className={`block lg:hidden absolute bottom-0 left-0 right-0 z-40 bg-slate-900/80 border-t border-slate-700/40 backdrop-blur-2xl rounded-t-3xl transition-transform duration-300 ${mobilePanelOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="flex justify-center py-3"><div className="w-10 h-1 bg-slate-600 rounded-full" /></div>
        <div className="flex items-center justify-between px-5 pb-3 border-b border-slate-700/30">
          <div className="flex items-center gap-2">
            <Radar className="w-5 h-5 text-slate-400" />
            <span className="text-sm font-semibold text-white/90">Layer Control</span>
          </div>
          <button onClick={() => setMobilePanelOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-700/40"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="px-5 py-3 border-b border-slate-700/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-300">Global Tension</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">{Array.from({ length: 3 }).map((_, i) => <LedIndicator key={i} color="#34d399" active={i === 0} size="sm" />)}</div>
              <span className="text-sm text-white/90 font-semibold font-mono">Kp {kpIndex.toFixed(1)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 p-4">
          <GlassToggle icon={Shield} label="ATMOS" checked={localAtmosphereEnabled} onChange={setLocalAtmosphereEnabled} ledColor="#22d3ee" />
          <GlassToggle icon={Cloud} label="WEATHER" checked={localWeatherEnabled} onChange={setLocalWeatherEnabled} ledColor="#38bdf8" />
          <GlassToggle icon={Flame} label="FIRES" checked={localFiresEnabled} onChange={setLocalFiresEnabled} ledColor="#fb923c" />
          <GlassToggle icon={Plane} label="AIRCRAFT" checked={localAircraftEnabled} onChange={setLocalAircraftEnabled} ledColor="#e2e8f0" />
          <GlassToggle icon={Radio} label="CLOUDS" checked={localCloudsEnabled} onChange={setLocalCloudsEnabled} ledColor="#94a3b8" />
          <GlassToggle icon={TrendingUp} label="MARKETS" checked={localMarketsEnabled} onChange={setLocalMarketsEnabled} ledColor="#34d399" />
        </div>

        <div className="px-5 pb-6">
          <div className="flex items-center justify-between py-2.5 px-3.5 bg-slate-800/40 border border-slate-700/30 rounded-xl">
            <span className="text-[10px] text-slate-400 uppercase">Active Nodes</span>
            <span className="text-xl font-bold text-white/90 font-mono">{visiblePoints.length}</span>
          </div>
        </div>
      </div>

    </div>
  );
}
