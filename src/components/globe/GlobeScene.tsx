import { useEffect, useRef, useState, useCallback } from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";
import { useSpaceWeather } from "@/hooks/useSpaceWeather";
import { supabase } from "@/integrations/supabase/client";
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

// Dense world grid for live weather sampling (within OWM 60 req/min cap).
const WEATHER_GRID: [number, number][] = [
  [60, -150], [60, -100], [60, -50], [60, 0], [60, 50], [60, 100], [60, 150],
  [40, -120], [40, -80], [40, -40], [40, 0], [40, 40], [40, 80], [40, 120],
  [20, -100], [20, -60], [20, -20], [20, 20], [20, 60], [20, 100], [20, 140],
  [0, -80], [0, -40], [0, 0], [0, 40], [0, 80], [0, 120], [0, 160],
  [-20, -70], [-20, -30], [-20, 30], [-20, 100], [-20, 140],
  [-40, -70], [-40, -20], [-40, 20], [-40, 60], [-40, 140], [-40, 170],
];

function tempColor(t: number | null): string {
  if (t == null) return "#94a3b8";
  // -20°C cold blue → 0 cyan → 15 green → 25 yellow → 35 red
  if (t <= -10) return "#1e3a8a";
  if (t <= 0) return "#3b82f6";
  if (t <= 10) return "#06b6d4";
  if (t <= 20) return "#22c55e";
  if (t <= 28) return "#facc15";
  if (t <= 34) return "#f97316";
  return "#ef4444";
}

interface WeatherPoint {
  lat: number; lon: number;
  clouds: number; rain: number;
  temp: number | null; wind: number | null; desc: string | null;
}

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
  const [localCloudsEnabled, setLocalCloudsEnabled] = useState(cloudsEnabledProp);
  const [localWeatherEnabled, setLocalWeatherEnabled] = useState(weatherEnabledProp);
  const [localAtmosphereEnabled, setLocalAtmosphereEnabled] = useState(true);
  const [localFiresEnabled, setLocalFiresEnabled] = useState(firesEnabledProp);
  const [localAircraftEnabled, setLocalAircraftEnabled] = useState(aircraftEnabledProp);
  const [localMarketsEnabled, setLocalMarketsEnabled] = useState(marketsEnabledProp);
  // OpenWeatherMap raster tile overlays (semitransparent shells).
  const [owmLayers, setOwmLayers] = useState({
    clouds: true,
    precipitation: true,
    wind: true,
    pressure: true,
  });

  const cloudsEnabled = localCloudsEnabled;
  const weatherEnabled = localWeatherEnabled;
  const firesEnabled = localFiresEnabled;
  const aircraftEnabled = localAircraftEnabled;
  const marketsEnabled = localMarketsEnabled;

  const globeRef = useRef<any>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pointsData, setPointsData] = useState<UnifiedHotspotData[]>(DAO_BASE_HOTSPOTS);
  const [arcsData, setArcsData] = useState<any[]>([]);
  const [weatherPoints, setWeatherPoints] = useState<WeatherPoint[]>([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [altitude, setAltitude] = useState(2.2);
  const cloudsMeshRef = useRef<THREE.Mesh | null>(null);
  const owmMeshesRef = useRef<Record<string, THREE.Mesh | null>>({
    clouds: null, precipitation: null, wind: null, pressure: null,
  });
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

  // ---- OpenWeatherMap tile overlays --------------------------------------
  // Build one transparent sphere shell per OWM layer, textured by stitching
  // z=2 (16 tiles) into a 1024x512 equirectangular canvas via the
  // openweather edge-function tile proxy. Layers toggle independently.
  useEffect(() => {
    if (!globeRef.current) return;
    const scene = globeRef.current.scene?.();
    if (!scene) return;

    const Z = 2;
    const N = 1 << Z; // 4
    const TILE = 256;
    const W = TILE * N; // 1024
    const H = TILE * N; // 1024 — Web Mercator square; we crop poles when wrapping
    const PROXY = "https://wkdtvrxavkhbifjtvvdw.supabase.co/functions/v1/openweather";

    type LayerKey = "clouds" | "precipitation" | "wind" | "pressure";
    const LAYER_PARAM: Record<LayerKey, string> = {
      clouds: "clouds_new",
      precipitation: "precipitation_new",
      wind: "wind_new",
      pressure: "pressure_new",
    };
    const RADII: Record<LayerKey, number> = {
      clouds: 100.9,
      precipitation: 101.0,
      wind: 101.1,
      pressure: 101.2,
    };

    let disposed = false;
    const loaded = new Set<LayerKey>();

    async function buildLayer(key: LayerKey) {
      if (disposed || loaded.has(key) || owmMeshesRef.current[key]) return;
      loaded.add(key);
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // Transparent background.
      ctx.clearRect(0, 0, W, H);
      const tasks: Promise<void>[] = [];
      for (let x = 0; x < N; x++) {
        for (let y = 0; y < N; y++) {
          const url = `${PROXY}?tile=${LAYER_PARAM[key]}&z=${Z}&x=${x}&y=${y}`;
          tasks.push(new Promise<void>((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => { try { ctx.drawImage(img, x * TILE, y * TILE); } catch { /* ignore */ } resolve(); };
            img.onerror = () => resolve();
            img.src = url;
          }));
        }
      }
      await Promise.all(tasks);
      if (disposed) return;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      const geo = new THREE.SphereGeometry(RADII[key], 96, 64);
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = `owm_${key}`;
      mesh.visible = owmLayers[key];
      // Web Mercator tiles align with equator when rotated -90° around Y in
      // three-globe's coordinate frame.
      mesh.rotation.y = -Math.PI / 2;
      scene.add(mesh);
      owmMeshesRef.current[key] = mesh;
    }

    (Object.keys(owmLayers) as LayerKey[]).forEach((k) => {
      if (owmLayers[k]) buildLayer(k);
      const mesh = owmMeshesRef.current[k];
      if (mesh) mesh.visible = owmLayers[k];
    });

    return () => { disposed = true; };
  }, [owmLayers, sceneEnhanced.current]);

  // Expose OWM layer toggles on window so the existing layer-control panel
  // can flip them without prop drilling. (Picked up by LegendPanel button.)
  useEffect(() => {
    (window as any).__owmToggle = (key: "clouds" | "precipitation" | "wind" | "pressure") => {
      setOwmLayers((s) => ({ ...s, [key]: !s[key] }));
    };
    (window as any).__owmState = owmLayers;
    return () => { /* keep handler — globe persists for app lifetime */ };
  }, [owmLayers]);
  // ------------------------------------------------------------------------

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
    // Cinematic intro: start far + spinning, then ease in toward the action.
    globeRef.current.pointOfView({ lat: 15, lng: -30, altitude: 3.8 }, 0);
    const t = setTimeout(() => {
      if (!globeRef.current) return;
      globeRef.current.pointOfView({ lat: 25, lng: 30, altitude: 2.2 }, 2600);
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = true; controls.autoRotateSpeed = 0.9;
        controls.enableDamping = true; controls.dampingFactor = 0.1;
        controls.enableZoom = true; controls.enableRotate = true; controls.enablePan = true;
        controls.minDistance = 101; controls.maxDistance = 500;
        controls.addEventListener("change", () => {
          const pov = globeRef.current?.pointOfView();
          if (pov && typeof pov.altitude === "number") setAltitude(prev => Math.abs(pov.altitude - prev) > 0.15 ? pov.altitude : prev);
        });
        // Slow the spin once the user has had their cinematic moment.
        setTimeout(() => { if (controls) controls.autoRotateSpeed = 0.35; }, 4000);
      }
      enhanceScene();
      if (onReadyRef.current) onReadyRef.current((lat, lng, alt) => globeRef.current?.pointOfView({ lat, lng, altitude: alt }, 1500));
    }, 400);
    return () => clearTimeout(t);
  }, [enhanceScene]);

  useEffect(() => { if (cloudsMeshRef.current) cloudsMeshRef.current.visible = cloudsEnabled; }, [cloudsEnabled]);
  useEffect(() => { if (atmosphereShellRef.current) atmosphereShellRef.current.visible = localAtmosphereEnabled; }, [localAtmosphereEnabled]);

  useEffect(() => {
    if (!weatherEnabled) { setWeatherPoints([]); return; }
    let cancelled = false;
    const pts = WEATHER_GRID.map(([lat, lon]) => `${lat},${lon}`).join(";");
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token;
        const anonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string)
          || (import.meta.env.VITE_SUPABASE_ANON_KEY as string)
          || "";
        const url = `https://wkdtvrxavkhbifjtvvdw.supabase.co/functions/v1/openweather?points=${encodeURIComponent(pts)}`;
        const res = await fetch(url, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${token || anonKey}`,
          },
        });
        if (!res.ok) throw new Error(String(res.status));
        const arr = await res.json();
        if (cancelled || !Array.isArray(arr)) return;
        setWeatherPoints(arr.map((p: any) => ({
          lat: Number(p.lat), lon: Number(p.lon),
          clouds: Number(p.clouds ?? 0),
          rain: Number(p.rain ?? 0),
          temp: typeof p.temp === "number" ? p.temp : null,
          wind: typeof p.wind === "number" ? p.wind : null,
          desc: p.desc ?? null,
        })));
      } catch {
        // Synthetic fallback
        if (cancelled) return;
        setWeatherPoints(WEATHER_GRID.map(([lat, lon]) => ({
          lat, lon,
          clouds: Math.round(Math.random() * 100),
          rain: Math.random() < 0.3 ? Math.random() * 3 : 0,
          temp: 30 - Math.abs(lat) * 0.6 + (Math.random() - 0.5) * 6,
          wind: Math.random() * 12,
          desc: null,
        })));
      }
    })();
    return () => { cancelled = true; };
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

  // Build three weather visualization datasets:
  // - cloudHeat (white) for cloud cover
  // - rainHeat  (blue)  for precipitation
  // - tempHtml  per-point colored badge for temperature
  const cloudHeat = weatherEnabled
    ? weatherPoints.filter(p => p.clouds > 10).map(p => ({ lat: p.lat, lng: p.lon, weight: Math.max(0.15, p.clouds / 100) }))
    : [];
  const rainHeat = weatherEnabled
    ? weatherPoints.filter(p => p.rain > 0).map(p => ({ lat: p.lat, lng: p.lon, weight: Math.min(1, 0.4 + p.rain * 0.3) }))
    : [];
  const tempHtml = weatherEnabled
    ? weatherPoints.filter(p => p.temp != null).map(p => ({ lat: p.lat, lng: p.lon, temp: p.temp as number }))
    : [];

  const heatmapsData = [
    ...(cloudHeat.length ? [cloudHeat] : []),
    ...(rainHeat.length ? [rainHeat] : []),
  ];

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] overflow-hidden bg-black animate-fade-in">

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
              heatmapsData,
              heatmapPointLat: "lat",
              heatmapPointLng: "lng",
              heatmapPointWeight: "weight",
              heatmapBandwidth: 3.0,
              heatmapColorSaturation: 2.4,
              heatmapBaseAltitude: 0.01,
              heatmapTopAltitude: 0.1,
              htmlElementsData: tempHtml,
              htmlLat: "lat",
              htmlLng: "lng",
              htmlAltitude: 0.04,
              htmlElement: (d: any) => {
                const el = document.createElement("div");
                const c = tempColor(d.temp);
                el.style.cssText = `pointer-events:none;font:600 9px/1 ui-monospace,monospace;color:#fff;background:${c};padding:2px 5px;border-radius:8px;box-shadow:0 0 8px ${c}aa,0 0 2px #000;transform:translate(-50%,-50%);opacity:0;animation:fade-in .6s ease-out forwards;`;
                el.textContent = `${Math.round(d.temp)}°`;
                return el;
              },
            } as any}
          />
        )}
      </div>

      {/* Panels managed by GlobeDashboard.tsx - GlobeScene only renders the 3D globe */}

      {/* Mobile controls handled by GlobeDashboard */}

    </div>
  );
}
