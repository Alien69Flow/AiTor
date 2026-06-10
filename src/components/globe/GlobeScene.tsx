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
  Zap,
  Shield,
  Activity,
  Radar,
  Satellite,
  Cpu,
  Database,
  Signal,
  Gauge,
  Wifi,
  Crosshair,
  RadioTower,
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

// Mock real-time indices for telemetry display
const MOCK_LIVE_INDICES = [
  { id: "BTC-SPOT", value: "94,521", delta: "+2.34%", status: "stable" },
  { id: "ETH-SPOT", value: "3,847", delta: "+1.12%", status: "stable" },
  { id: "SOL-SPOT", value: "178.32", delta: "-0.45%", status: "warn" },
  { id: "GEO-CN1", value: "8.2", delta: "0.00", status: "stable" },
  { id: "GEO-CN2", value: "3.1", delta: "+0.10", status: "warn" },
  { id: "CNFLT-IX", value: "47", delta: "+5", status: "alert" },
  { id: "NK-MIL", value: "ACTIVE", delta: "", status: "alert" },
  { id: "US-MIL", value: "STANDBY", delta: "", status: "stable" },
  { id: "RADAR-N1", value: "ONLINE", delta: "", status: "stable" },
];

// Mock data feeds
const MOCK_FEEDS = [
  { sourceId: "OSINT-INTL-01", label: "INTEL NETWORK", status: "live", color: "#00ff41" },
  { sourceId: "NASA-FIRMS-02", label: "THERMAL IMAGERY", status: "live", color: "#ff6b35" },
  { sourceId: "USGS-SEIS-03", label: "SEISMIC ARRAY", status: "live", color: "#facc15" },
  { sourceId: "OPSKY-RDR-04", label: "FLIGHT TRACKER", status: "standby", color: "#38bdf8" },
];

// LED Segment indicator component
const LedSegment = ({ active, color, size = "md" }: { active: boolean; color?: string; size?: "sm" | "md" | "lg" }) => {
  const sizeClasses = size === "sm" ? "w-2 h-4" : size === "lg" ? "w-4 h-6" : "w-3 h-5";
  return (
    <div
      className={`${sizeClasses} rounded-sm transition-all duration-300`}
      style={{
        backgroundColor: active ? (color || '#00ff41') : 'rgba(39, 39, 42, 0.5)',
        boxShadow: active ? `0 0 10px ${color || '#00ff41'}, 0 0 20px ${color || '#00ff41'}60, inset 0 0 8px rgba(255,255,255,0.3)` : 'none',
      }}
    />
  );
};

// Blinking LED indicator
const BlinkingLed = ({ color, size = "sm", active = true }: { color: string; size?: "sm" | "md"; active?: boolean }) => (
  <div
    className={`rounded-full ${active ? 'animate-pulse' : ''} ${size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2"}`}
    style={{
      backgroundColor: active ? color : 'rgba(39, 39, 42, 0.5)',
      boxShadow: active ? `0 0 6px ${color}, 0 0 12px ${color}60` : 'none',
    }}
  />
);

// Tactical corner decorations for panels
const TacticalCorners = ({ size = "md" }: { size?: "sm" | "md" | "lg" }) => {
  const s = size === "sm" ? "w-2 h-2" : size === "lg" ? "w-4 h-4" : "w-3 h-3";
  return (
    <>
      <div className={`absolute top-0 left-0 ${s} border-t border-l border-emerald-500/40`} />
      <div className={`absolute top-0 right-0 ${s} border-t border-r border-emerald-500/40`} />
      <div className={`absolute bottom-0 left-0 ${s} border-b border-l border-emerald-500/40`} />
      <div className={`absolute bottom-0 right-0 ${s} border-b border-r border-emerald-500/40`} />
    </>
  );
};

// Scanner sweep animation overlay
const ScannerSweep = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
    <div
      className="absolute w-full h-px bg-gradient-to-r from-transparent via-emerald-400 to-transparent"
      style={{
        animation: 'scanSweep 4s linear infinite',
        top: '0%',
      }}
    />
  </div>
);

// CRT scanline overlay
const CRTOverlay = () => (
  <div
    className="absolute inset-0 pointer-events-none opacity-[0.02] z-50"
    style={{
      background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.4) 2px, rgba(0,0,0,0.4) 4px)',
    }}
  />
);

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
  const [blinkState, setBlinkState] = useState(true);
  const [activeTab, setActiveTab] = useState<'FEED' | 'MARKETS' | 'FLIGHTS'>('FEED');

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

  // Blink animation
  useEffect(() => {
    const interval = setInterval(() => setBlinkState(s => !s), 700);
    return () => clearInterval(interval);
  }, []);

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

  // Tactical Toggle Button
  const TacticalToggle = ({ icon: Icon, label, checked, onChange, ledColor }: { icon: React.ElementType; label: string; checked: boolean; onChange: (v: boolean) => void; ledColor?: string }) => (
    <button
      onClick={() => onChange(!checked)}
      className={`relative flex items-center gap-2 px-3 py-2 text-[10px] font-medium uppercase tracking-wider transition-all duration-200 border bg-zinc-950/40 backdrop-blur-md ${
        checked ? 'border-emerald-500/30 text-emerald-400' : 'border-zinc-700/30 text-zinc-500 hover:text-zinc-400'
      }`}
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-emerald-500/30" />
      <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-emerald-500/30" />
      <Icon className={`w-3.5 h-3.5 ${checked ? 'text-emerald-400' : 'text-zinc-600'}`} />
      <span className="flex-1 text-left">{label}</span>
      <div className={`w-2 h-2 rounded-full transition-all ${checked ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: checked ? (ledColor || '#00ff41') : '#27272a', boxShadow: checked ? `0 0 6px ${ledColor || '#00ff41'}` : 'none' }}
      />
    </button>
  );

  // Telemetry Data Card
  const TelemetryCard = ({ id, value, delta, status }: { id: string; value: string; delta: string; status: string }) => (
    <div className="relative flex flex-col gap-0.5 p-1.5 bg-zinc-900/60 border border-emerald-500/10 backdrop-blur-sm">
      <div className="absolute top-0 left-0 w-1 h-1 border-t border-l border-emerald-500/30" />
      <div className="absolute bottom-0 right-0 w-1 h-1 border-b border-r border-emerald-500/30" />
      <span className="text-[7px] uppercase tracking-widest text-zinc-600" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{id}</span>
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-semibold text-zinc-200" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{value}</span>
        <BlinkingLed color={status === 'stable' ? '#00ff41' : status === 'warn' ? '#facc15' : '#ef4444'} />
      </div>
      {delta && <span className={`text-[8px] ${delta.startsWith('+') ? 'text-emerald-400' : delta.startsWith('-') ? 'text-red-400' : 'text-zinc-500'}`}>{delta}</span>}
    </div>
  );

  // Feed Source Item
  const FeedSourceItem = ({ sourceId, label, status, color }: { sourceId: string; label: string; status: string; color: string }) => (
    <div className="flex items-center gap-2 px-2 py-1.5 bg-zinc-900/50 border border-zinc-800/50">
      <div className="w-0.5 h-full rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
      <div className="flex-1 min-w-0">
        <div className="text-[7px] text-zinc-600 uppercase tracking-wider truncate" style={{ fontFamily: "'JetBrains Mono', monospace" }}>SOURCE ID: {sourceId}</div>
        <div className="text-[9px] text-zinc-300 truncate" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{label}</div>
      </div>
      <BlinkingLed color={status === 'live' ? '#00ff41' : '#facc15'} active={status === 'live'} />
    </div>
  );

  // Tactical Tab Button
  const TacticalTab = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`relative px-3 py-1.5 text-[9px] uppercase tracking-wider border transition-all duration-200 ${
        active ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-zinc-900/50 border-zinc-700/30 text-zinc-500 hover:border-zinc-600'
      }`}
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-emerald-500/30" />
      <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-emerald-500/30" />
      {label}
    </button>
  );

  // Filter Pill with tech corners
  const FilterPill = ({ label, active }: { label: string; active?: boolean }) => (
    <button className={`relative px-2 py-1 text-[8px] uppercase tracking-wider border transition-all duration-200 ${
      active ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-zinc-900/50 border-zinc-700/20 text-zinc-500 hover:border-zinc-600'
    }`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      <div className="absolute top-0 left-0 w-1 h-1 border-t border-l border-emerald-500/30" />
      <div className="absolute bottom-0 right-0 w-1 h-1 border-b border-r border-emerald-500/30" />
      {label}
    </button>
  );

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] overflow-hidden bg-black" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      <CRTOverlay />

      {/* Globe container */}
      <div ref={containerRef} className="absolute inset-0 z-10">
        {dimensions.width > 0 && (
          <Globe
            ref={globeRef}
            width={dimensions.width}
            height={dimensions.height}
            globeImageUrl={globeImageUrl}
            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
            backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
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

      {/* DESKTOP: Left Panel - Telemetry Console */}
      <div className="hidden lg:flex flex-col gap-2 absolute top-3 left-3 z-20 w-72">
        {/* Global Tension Header */}
        <div className="relative bg-zinc-950/40 border border-emerald-500/20 backdrop-blur-md p-3">
          <TacticalCorners />
          <ScannerSweep />
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-400">GLOBAL TENSION</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 bg-zinc-900/50 border border-emerald-500/20">
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span className={`text-[8px] uppercase tracking-wider ${blinkState ? 'text-emerald-400' : 'text-emerald-400/40'}`}
                style={{ textShadow: blinkState ? '0 0 8px #00ff41' : 'none' }}
              >[ONLINE]</span>
            </div>
          </div>

          {/* LED Segment Indicator */}
          <div className="flex items-center justify-center gap-1 mb-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <LedSegment key={i} active={i === 0} color="#00ff41" size="lg" />
            ))}
          </div>
          <div className="text-center text-[8px] uppercase tracking-widest text-zinc-500">
            [TELEMETRY: ESTABLE]
          </div>
          <div className="text-center text-[9px] text-zinc-600 mt-1">
            Kp Index: <span className="text-emerald-400 font-semibold">{kpIndex.toFixed(1)}</span>
          </div>
        </div>

        {/* SENSING LIVE DATA STREAM */}
        <div className="relative bg-zinc-950/40 border border-emerald-500/20 backdrop-blur-md p-2.5">
          <TacticalCorners size="sm" />
          <div className="flex items-center gap-2 mb-2">
            <Signal className="w-3 h-3 text-cyan-400 animate-pulse" />
            <span className="text-[8px] uppercase tracking-[0.15em] text-cyan-400">SENSING LIVE DATA STREAM</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MOCK_LIVE_INDICES.slice(0, 6).map((item, i) => (
              <TelemetryCard key={i} {...item} />
            ))}
          </div>
        </div>

        {/* ARCHIVED TELEMETRY */}
        <div className="relative bg-zinc-950/40 border border-emerald-500/20 backdrop-blur-md p-2.5">
          <TacticalCorners size="sm" />
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-3 h-3 text-zinc-500" />
            <span className="text-[8px] uppercase tracking-[0.15em] text-zinc-500">ARCHIVED TELEMETRY</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MOCK_LIVE_INDICES.slice(6).map((item, i) => (
              <TelemetryCard key={i} {...item} />
            ))}
          </div>
        </div>

        {/* Layer Control */}
        <div className="relative bg-zinc-950/40 border border-emerald-500/20 backdrop-blur-md p-2.5">
          <TacticalCorners size="sm" />
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-3 h-3 text-emerald-400" />
            <span className="text-[8px] uppercase tracking-[0.15em] text-emerald-400">LAYER CONTROL</span>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <TacticalToggle icon={Shield} label="ATMOS" checked={localAtmosphereEnabled} onChange={setLocalAtmosphereEnabled} ledColor="#00ffff" />
            <TacticalToggle icon={Cloud} label="WEATHER" checked={localWeatherEnabled} onChange={setLocalWeatherEnabled} ledColor="#38bdf8" />
            <TacticalToggle icon={Flame} label="FIRES" checked={localFiresEnabled} onChange={setLocalFiresEnabled} ledColor="#ff6b35" />
            <TacticalToggle icon={Plane} label="AIRCRAFT" checked={localAircraftEnabled} onChange={setLocalAircraftEnabled} ledColor="#ffffff" />
            <TacticalToggle icon={Radio} label="CLOUDS" checked={localCloudsEnabled} onChange={setLocalCloudsEnabled} ledColor="#71717a" />
            <TacticalToggle icon={TrendingUp} label="MARKETS" checked={localMarketsEnabled} onChange={setLocalMarketsEnabled} ledColor="#00ff41" />
          </div>
        </div>
      </div>

      {/* DESKTOP: Right Panel - Feeds Console */}
      <div className="hidden lg:flex flex-col gap-2 absolute top-3 right-3 z-20 w-64">
        {/* Node Status */}
        <div className="relative bg-zinc-950/40 border border-emerald-500/20 backdrop-blur-md p-3">
          <TacticalCorners />
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-3 h-3 text-emerald-400" />
              <span className="text-[8px] uppercase tracking-[0.15em] text-emerald-400">NODE STATUS</span>
            </div>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${blinkState ? 'bg-emerald-400' : 'bg-emerald-400/40'}`}
                style={{ boxShadow: blinkState ? '0 0 8px #00ff41' : 'none' }}
              />
              <span className="text-[7px] text-emerald-400 uppercase">ACTIVE</span>
            </div>
          </div>
          <div className="text-4xl font-bold text-emerald-400" style={{ textShadow: '0 0 20px #00ff4140, 0 0 40px #00ff4120' }}>
            {visiblePoints.length}
          </div>
          <div className="text-[8px] uppercase tracking-widest text-zinc-500">ACTIVE DATA NODES</div>
        </div>

        {/* Data Feeds */}
        <div className="relative bg-zinc-950/40 border border-emerald-500/20 backdrop-blur-md p-2.5">
          <TacticalCorners size="sm" />
          <div className="flex items-center gap-2 mb-2">
            <Satellite className="w-3 h-3 text-cyan-400" />
            <span className="text-[8px] uppercase tracking-[0.15em] text-cyan-400">DATA FEEDS</span>
          </div>
          <div className="space-y-1">
            {MOCK_FEEDS.map((feed, i) => (
              <FeedSourceItem key={i} {...feed} />
            ))}
          </div>
        </div>

        {/* Data Filters */}
        <div className="relative bg-zinc-950/40 border border-emerald-500/20 backdrop-blur-md p-2.5">
          <TacticalCorners size="sm" />
          <div className="flex items-center gap-2 mb-2">
            <Gauge className="w-3 h-3 text-emerald-400" />
            <span className="text-[8px] uppercase tracking-[0.15em] text-emerald-400">DATA FILTERS</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {['OSINT', 'NASA', 'QUAKES', 'FLIGHTS', 'MARKETS'].map((f, i) => (
              <FilterPill key={i} label={f} active={i < 3} />
            ))}
          </div>
        </div>

        {/* Tactical Tabs */}
        <div className="relative bg-zinc-950/40 border border-emerald-500/20 backdrop-blur-md p-2.5">
          <TacticalCorners size="sm" />
          <div className="flex gap-1 mb-2">
            {(['FEED', 'MARKETS', 'FLIGHTS'] as const).map((tab) => (
              <TacticalTab key={tab} label={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)} />
            ))}
          </div>
          <div className="text-[8px] text-zinc-500 uppercase tracking-wider">
            {activeTab === 'FEED' && 'Real-time intelligence stream active'}
            {activeTab === 'MARKETS' && 'Global market data pipeline online'}
            {activeTab === 'FLIGHTS' && 'Aircraft tracking radar enabled'}
          </div>
        </div>
      </div>

      {/* DESKTOP: Bottom - Telemetry Matrix */}
      <div className="hidden lg:block absolute bottom-3 left-3 z-20">
        <div className="relative bg-zinc-950/40 border border-emerald-500/20 backdrop-blur-md p-2.5 w-72">
          <TacticalCorners size="sm" />
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-3 h-3 text-emerald-400" />
            <span className="text-[8px] uppercase tracking-[0.15em] text-emerald-400">TELEMETRY MATRIX</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {[
              { label: 'CONFLICT', color: '#ef4444', glow: '#ff0000' },
              { label: 'FINANCE', color: '#facc15', glow: '#facc15' },
              { label: 'TECH', color: '#22d3ee', glow: '#00ffff' },
              { label: 'GEOPOL', color: '#f97316', glow: '#ff8800' },
              { label: 'QUAKE', color: '#facc15', glow: '#ffdd00' },
              { label: 'DAO NODE', color: '#ffffff', glow: '#ffffff' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 p-1.5 bg-zinc-900/60 border border-emerald-500/10">
                <div className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.glow}, 0 0 16px ${item.glow}40` }}
                />
                <span className="text-[7px] uppercase tracking-wider text-zinc-400">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MOBILE: Floating layers button */}
      <button onClick={() => setMobilePanelOpen(!mobilePanelOpen)}
        className="block lg:hidden absolute bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-zinc-900/90 border border-emerald-500/30 backdrop-blur-md flex items-center justify-center shadow-lg shadow-emerald-500/10 transition-transform active:scale-95">
        <Layers className="w-6 h-6 text-emerald-400" />
      </button>

      {/* MOBILE: Bottom Sheet */}
      <div className={`block lg:hidden absolute bottom-0 left-0 right-0 z-40 bg-zinc-950/95 border-t border-emerald-500/20 backdrop-blur-lg transition-transform duration-300 ${mobilePanelOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="flex justify-center py-3"><div className="w-10 h-1 bg-zinc-600 rounded-full" /></div>
        <div className="flex items-center justify-between px-4 pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Radar className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-semibold text-zinc-200">TACTICAL CONTROL</span>
          </div>
          <button onClick={() => setMobilePanelOpen(false)} className="p-1.5 rounded hover:bg-zinc-800"><X className="w-5 h-5 text-zinc-400" /></button>
        </div>

        <div className="px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-zinc-300">GLOBAL TENSION</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">{Array.from({ length: 3 }).map((_, i) => <LedSegment key={i} active={i === 0} color="#00ff41" size="sm" />)}</div>
              <span className="text-sm text-emerald-400 font-semibold">Kp {kpIndex.toFixed(1)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 p-4">
          <TacticalToggle icon={Shield} label="ATMOS" checked={localAtmosphereEnabled} onChange={setLocalAtmosphereEnabled} />
          <TacticalToggle icon={Cloud} label="WEATHER" checked={localWeatherEnabled} onChange={setLocalWeatherEnabled} />
          <TacticalToggle icon={Flame} label="FIRES" checked={localFiresEnabled} onChange={setLocalFiresEnabled} />
          <TacticalToggle icon={Plane} label="AIRCRAFT" checked={localAircraftEnabled} onChange={setLocalAircraftEnabled} />
          <TacticalToggle icon={Radio} label="CLOUDS" checked={localCloudsEnabled} onChange={setLocalCloudsEnabled} />
          <TacticalToggle icon={TrendingUp} label="MARKETS" checked={localMarketsEnabled} onChange={setLocalMarketsEnabled} />
        </div>

        <div className="px-4 pb-6">
          <div className="flex items-center justify-between py-2 px-3 bg-zinc-800/50 border border-emerald-500/20">
            <span className="text-[10px] text-zinc-400 uppercase">Active Nodes</span>
            <span className="text-xl font-bold text-emerald-400" style={{ textShadow: '0 0 12px #00ff4140' }}>{visiblePoints.length}</span>
          </div>
        </div>
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes scanSweep {
          0% { top: 0%; opacity: 1; }
          50% { opacity: 0.5; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
