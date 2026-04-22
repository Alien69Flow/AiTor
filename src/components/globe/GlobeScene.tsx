import { useEffect, useRef, useState, useCallback } from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";
import { useSpaceWeather } from "@/hooks/useSpaceWeather";
import {
  createAtmosphereShell,
  createAuroraCurtains,
  createVanAllenBelts,
  createMagneticFlux,
  createTelluricGrid,
  getGIBSCloudTexture,
} from "./layers/HighFidelityLayers";

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
}

export function GlobeScene({ onHotspotClick, onReady, externalMarkers, cloudsEnabled = true }: GlobeSceneProps) {
  const globeRef = useRef<any>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pointsData, setPointsData] = useState<UnifiedHotspotData[]>(DAO_BASE_HOTSPOTS);
  const [arcsData, setArcsData] = useState<any[]>([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [altitude, setAltitude] = useState(2.2);
  const cloudsMeshRef = useRef<THREE.Mesh | null>(null);
  const sceneEnhanced = useRef(false);
  const auroraRef = useRef<THREE.Group | null>(null);
  const atmosphereRef = useRef<THREE.Mesh | null>(null);
  const vanAllenRef = useRef<THREE.Group | null>(null);
  const telluricRef = useRef<THREE.Group | null>(null);
  const magneticRef = useRef<THREE.Group | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const { kpIndex } = useSpaceWeather();

  const atmosphereColor = kpIndex >= 4 ? "#ff00ff" : "#00ff41";
  const atmosphereAlt = kpIndex >= 6 ? 0.45 : kpIndex >= 4 ? 0.35 : 0.25;
  const auroraRings = getAuroraRings(kpIndex);

  // Zoom-aware NASA Blue Marble resolution (Google Earth style)
  // altitude < 0.6 = ultra-close, < 1.2 = close, else default
  const globeImageUrl = altitude < 0.6
    ? "https://eoimages.gsfc.nasa.gov/images/imagerecords/74000/74218/world.200412.3x21600x10800.jpg"
    : altitude < 1.2
    ? "https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg"
    : "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg";

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

    // Meteosat-style cloud layer (semi-transparent sphere wrapping the globe)
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";
    const cloudsGeo = new THREE.SphereGeometry(100.6, 64, 64);
    const cloudsMat = new THREE.MeshPhongMaterial({
      map: loader.load("https://unpkg.com/three-globe/example/img/earth-clouds.png"),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
    cloudsMesh.name = "meteosat_clouds";
    scene.add(cloudsMesh);
    cloudsMeshRef.current = cloudsMesh;

    // Animate cloud rotation (slow drift, like real atmosphere)
    let frame = 0;
    const animateClouds = () => {
      if (cloudsMeshRef.current) {
        cloudsMeshRef.current.rotation.y += 0.0003;
      }
      frame = requestAnimationFrame(animateClouds);
    };
    animateClouds();
  }, []);

  // Data: arcs + USGS + OpenSky
  useEffect(() => {
    const pairs = [[0, 5], [2, 8], [11, 13], [14, 6], [9, 1], [15, 7], [4, 12], [10, 3]];
    const newArcs: any[] = pairs.map(([a, b]) => {
      const start = DAO_BASE_HOTSPOTS[a];
      const end = DAO_BASE_HOTSPOTS[b];
      if (!start || !end) return null;
      return {
        startLat: start.lat, startLng: start.lon,
        endLat: end.lat, endLng: end.lon,
        color: [start.color + "cc", end.color + "cc"],
      };
    }).filter(Boolean);

    const zaragoza = DAO_BASE_HOTSPOTS[DAO_BASE_HOTSPOTS.length - 1];
    [5, 8, 12, 11].forEach(idx => {
      const target = DAO_BASE_HOTSPOTS[idx];
      if (target) {
        newArcs.push({
          startLat: zaragoza.lat, startLng: zaragoza.lon,
          endLat: target.lat, endLng: target.lon,
          color: ["#ffffff88", "#ffffff33"],
        });
      }
    });

    setArcsData(newArcs);

    // OpenSky aircraft layer (independent, lightweight ambient signal)
    fetch('https://opensky-network.org/api/states/all?lamin=20&lamax=60&lomin=-30&lomax=60')
      .then(res => res.json())
      .then(data => {
        if (!data.states) return;
        const aircraft: UnifiedHotspotData[] = data.states.slice(0, 80).map((s: any[]) => ({
          lat: s[6] || 0, lon: s[5] || 0,
          intensity: 0.15, color: "#ffffff",
          name: (s[1] || "").trim() || s[0] || "Aircraft",
          country: s[2] || "Unknown",
          marketVolume: `${Math.round(s[7] || 0)}m alt`,
          trend: `${Math.round(s[9] || 0)}m/s`,
          topTokens: [] as string[],
          type: "aircraft" as const,
        })).filter((a: UnifiedHotspotData) => a.lat !== 0 && a.lon !== 0);
        setPointsData(prev => {
          const base = prev.filter(p => p.type !== 'aircraft');
          return [...base, ...aircraft];
        });
      })
      .catch(e => console.warn("OpenSky fetch error:", e));
  }, []);

  // Unified external markers (USGS/NASA/UAP/OSINT) coming from useUnifiedIntel
  useEffect(() => {
    if (!externalMarkers) return;
    setPointsData(prev => {
      const aircraft = prev.filter(p => p.type === 'aircraft');
      const baseDao = DAO_BASE_HOTSPOTS;
      return [...baseDao, ...externalMarkers, ...aircraft];
    });
  }, [externalMarkers]);

  // Globe controls + scene enhancement + navigation callback
  useEffect(() => {
    if (!globeRef.current) return;
    const t = setTimeout(() => {
      if (!globeRef.current) return;
      globeRef.current.pointOfView({ lat: 25, lng: 30, altitude: 2.2 }, 1500);
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.35;
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        controls.enableZoom = true;
        controls.enableRotate = true;
        controls.enablePan = true;
        controls.minDistance = 101;
        controls.maxDistance = 500;
        // Track altitude changes for zoom-aware texture swapping
        controls.addEventListener("change", () => {
          const pov = globeRef.current?.pointOfView();
          if (pov && typeof pov.altitude === "number") {
            setAltitude(prev => {
              const next = pov.altitude;
              // throttle: only update if change > 0.15 to avoid texture thrashing
              return Math.abs(next - prev) > 0.15 ? next : prev;
            });
          }
        });
      }
      enhanceScene();

      // Expose navigation function via ref to avoid stale closures
      if (onReadyRef.current) {
        onReadyRef.current((lat: number, lng: number, altitude: number) => {
          globeRef.current?.pointOfView({ lat, lng, altitude }, 1500);
        });
      }
    }, 800);
    return () => clearTimeout(t);
  }, [enhanceScene]);

  // Toggle clouds visibility
  useEffect(() => {
    if (cloudsMeshRef.current) {
      cloudsMeshRef.current.visible = cloudsEnabled;
    }
  }, [cloudsEnabled]);

  const getPointColor = useCallback((d: any) => {
    if (d.type === 'aircraft') return '#ffffff';
    if (d.type === 'quake') return '#ffff00';
    if (d.type === 'dao_node') return '#ffffff';
    return d.color;
  }, []);

  const getPointAlt = useCallback((d: any) => {
    if (d.type === 'aircraft') return 0.06;
    if (d.type === 'quake') return 0.008;
    if (d.type === 'dao_node') return 0.03;
    return 0.02 + d.intensity * 0.01;
  }, []);

  const getPointRadius = useCallback((d: any) => {
    if (d.type === 'aircraft') return 0.08;
    if (d.type === 'quake') return d.intensity * 0.5;
    if (d.type === 'dao_node') return 0.6;
    return d.intensity * 0.35;
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full" style={{ background: '#000008' }}>
      {dimensions.width > 0 && (
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}

          globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          {...{ nightImageUrl: "//unpkg.com/three-globe/example/img/earth-night.jpg" } as any}

          showGraticules={true}

          showAtmosphere={true}
          atmosphereColor={atmosphereColor}
          atmosphereAltitude={atmosphereAlt}

          pointsData={pointsData}
          pointLat="lat"
          pointLng="lon"
          pointColor={getPointColor}
          pointAltitude={getPointAlt}
          pointRadius={getPointRadius}
          onPointClick={(point: any) => onHotspotClick?.(point as UnifiedHotspotData)}

          labelsData={pointsData.filter(d => d.type !== 'quake' && d.type !== 'aircraft')}
          labelLat="lat"
          labelLng="lon"
          labelText="name"
          labelSize={0.5}
          labelDotRadius={0.15}
          labelColor={() => 'rgba(255, 255, 255, 0.85)'}
          labelResolution={2}

          arcsData={arcsData}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcColor="color"
          arcDashLength={0.6}
          arcDashGap={0.25}
          arcDashAnimateTime={() => 1200 + Math.random() * 2500}
          arcStroke={0.5}

          ringsData={auroraRings}
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
