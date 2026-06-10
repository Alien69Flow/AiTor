import { useEffect, useRef, useState, useCallback } from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";
import { Layers, X, Cloud, Radio, Flame, Plane, TrendingUp, Zap, Shield, Activity } from "lucide-react";
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
  weatherEnabled?: boolean;
  firesEnabled?: boolean;
  aircraftEnabled?: boolean;
  marketsEnabled?: boolean;
}

const ZARAGOZA = { lat: 41.65, lon: -0.88 };

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
  // Local toggle states (UI-only, no API calls)
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [localCloudsEnabled, setLocalCloudsEnabled] = useState(cloudsEnabledProp);
  const [localWeatherEnabled, setLocalWeatherEnabled] = useState(weatherEnabledProp);
  const [localAtmosphereEnabled, setLocalAtmosphereEnabled] = useState(true);
  const [localFiresEnabled, setLocalFiresEnabled] = useState(firesEnabledProp);
  const [localAircraftEnabled, setLocalAircraftEnabled] = useState(aircraftEnabledProp);
  const [localMarketsEnabled, setLocalMarketsEnabled] = useState(marketsEnabledProp);

  // Derive effective toggle states from local UI state
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

  // Zoom-aware NASA Blue Marble resolution
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
    // Try real-time NASA GIBS first; fallback to static cloud map on error
    const gibsUrl = getGIBSCloudTexture();
    const cloudTex = loader.load(
      gibsUrl,
      undefined,
      undefined,
      () => {
        // GIBS failed (CORS / date), swap to static
        const fallback = loader.load("https://unpkg.com/three-globe/example/img/earth-clouds.png");
        if (cloudsMeshRef.current) {
          (cloudsMeshRef.current.material as THREE.MeshPhongMaterial).map = fallback;
          (cloudsMeshRef.current.material as THREE.MeshPhongMaterial).needsUpdate = true;
        }
      },
    );
    const cloudsMat = new THREE.MeshPhongMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
    cloudsMesh.name = "meteosat_clouds";
    scene.add(cloudsMesh);
    cloudsMeshRef.current = cloudsMesh;

    // ── High-fidelity layers (Rango 1) ─────────────────────────
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

    // Animate cloud rotation (slow drift, like real atmosphere)
    let frame = 0;
    const animateClouds = () => {
      if (cloudsMeshRef.current) {
        cloudsMeshRef.current.rotation.y += 0.0003;
      }
      if (auroraRef.current) {
        auroraRef.current.rotation.y += 0.0006;
      }
      if (vanAllenRef.current) {
        vanAllenRef.current.rotation.y -= 0.0004;
      }
      if (telluricRef.current) {
        telluricRef.current.rotation.y += 0.0002;
      }
      frame = requestAnimationFrame(animateClouds);
    };
    animateClouds();
  }, [atmosphereColor, kpIndex]);

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

    // OpenSky aircraft layer — non-blocking. CORS/network failures must NOT break the globe.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    (async () => {
      try {
        const res = await fetch(
          'https://opensky-network.org/api/states/all?lamin=20&lamax=60&lomin=-30&lomax=60',
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.states) return;
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
      } catch {
      } finally {
        clearTimeout(timeoutId);
      }
    })();
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
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

  // Toggle atmosphere shell visibility
  useEffect(() => {
    if (atmosphereShellRef.current) {
      atmosphereShellRef.current.visible = localAtmosphereEnabled;
    }
  }, [localAtmosphereEnabled]);

  // Mock weather heat data (UI-only, no API calls)
  useEffect(() => {
    if (!weatherEnabled) {
      setWeatherHeat([]);
      return;
    }
    // Generate mock heat data around Zaragoza
    const mockHeat = [];
    for (let i = 0; i < 15; i++) {
      mockHeat.push({
        lat: ZARAGOZA.lat + (Math.random() - 0.5) * 8,
        lng: ZARAGOZA.lon + (Math.random() - 0.5) * 8,
        weight: Math.random() * 0.6 + 0.2,
      });
    }
    setWeatherHeat(mockHeat);
  }, [weatherEnabled]);

  // Apply layer toggles by filtering points
  const visiblePoints = pointsData.filter((p: any) => {
    if (p.type === 'aircraft') return aircraftEnabled;
    if (p.type === 'nasa') return firesEnabled;
    if (p.type === 'finance') return marketsEnabled;
    return true;
  });

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

  // Toggle component for both mobile and desktop
  const LayerToggle = ({
    icon: Icon,
    label,
    checked,
    onChange
  }: {
    icon: React.ElementType;
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void
  }) => (
    <button
      onClick={() => onChange(!checked)}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
        transition-all duration-200 border
        ${checked
          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
          : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:border-zinc-600'
        }
      `}
    >
      <Icon className={`w-4 h-4 ${checked ? 'text-emerald-400' : 'text-zinc-500'}`} />
      <span>{label}</span>
      <div className={`ml-auto w-2 h-2 rounded-full ${checked ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
    </button>
  );

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] overflow-hidden bg-black">
      {/* Globe container - absolute inset */}
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

      {/* Desktop: Side panels (hidden on mobile) */}
      <div className="hidden lg:flex flex-col gap-3 absolute top-4 left-4 z-20 max-w-xs">
        {/* Space Weather Panel */}
        <div className="bg-zinc-900/80 border border-zinc-700/50 rounded-xl p-4 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-zinc-200">Space Weather</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Kp Index</span>
              <span className={`font-mono ${kpIndex >= 5 ? 'text-red-400' : kpIndex >= 3 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                {kpIndex.toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Activity</span>
              <span className={`font-medium ${kpIndex >= 5 ? 'text-red-400' : kpIndex >= 3 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                {kpIndex >= 5 ? 'SEVERE' : kpIndex >= 3 ? 'ACTIVE' : 'QUIET'}
              </span>
            </div>
          </div>
        </div>

        {/* Layer Controls */}
        <div className="bg-zinc-900/80 border border-zinc-700/50 rounded-xl p-4 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-zinc-200">Layers</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <LayerToggle icon={Shield} label="Atmosphere" checked={localAtmosphereEnabled} onChange={setLocalAtmosphereEnabled} />
            <LayerToggle icon={Cloud} label="Weather" checked={localWeatherEnabled} onChange={setLocalWeatherEnabled} />
            <LayerToggle icon={Flame} label="Fires" checked={localFiresEnabled} onChange={setLocalFiresEnabled} />
            <LayerToggle icon={Plane} label="Aircraft" checked={localAircraftEnabled} onChange={setLocalAircraftEnabled} />
          </div>
        </div>
      </div>

      {/* Desktop: Legend panel (hidden on mobile) */}
      <div className="hidden lg:block absolute bottom-4 left-4 z-20">
        <div className="bg-zinc-900/80 border border-zinc-700/50 rounded-xl p-4 backdrop-blur-md max-w-xs">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-zinc-200">Legend</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-zinc-300">Conflict</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-zinc-300">Finance</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="text-zinc-300">Tech</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-400" />
              <span className="text-zinc-300">Earthquake</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white" />
              <span className="text-zinc-300">DAO Node</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <span className="text-zinc-300">Geopolitical</span>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: Market stats (hidden on mobile) */}
      <div className="hidden lg:block absolute top-4 right-4 z-20">
        <div className="bg-zinc-900/80 border border-zinc-700/50 rounded-xl p-4 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-zinc-200">Hotspots</span>
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-400">{visiblePoints.length}</div>
          <div className="text-xs text-zinc-400">active nodes</div>
        </div>
      </div>

      {/* Mobile: Floating layers button */}
      <button
        onClick={() => setMobilePanelOpen(!mobilePanelOpen)}
        className="block lg:hidden absolute bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-zinc-900/90 border border-emerald-500/30 backdrop-blur-md flex items-center justify-center shadow-lg shadow-emerald-500/10 transition-transform duration-200 active:scale-95"
      >
        <Layers className="w-6 h-6 text-emerald-400" />
      </button>

      {/* Mobile: Bottom Sheet */}
      <div
        className={`
          block lg:hidden absolute bottom-0 left-0 right-0 z-40
          bg-zinc-950/95 border-t border-zinc-800 rounded-t-2xl backdrop-blur-lg
          transition-transform duration-300 ease-out
          ${mobilePanelOpen ? 'translate-y-0' : 'translate-y-full'}
        `}
      >
        {/* Drag handle */}
        <div className="flex justify-center py-3">
          <div className="w-10 h-1 bg-zinc-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            <span className="text-base font-semibold text-zinc-200">Layer Controls</span>
          </div>
          <button
            onClick={() => setMobilePanelOpen(false)}
            className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Space Weather (compact) */}
        <div className="px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-zinc-300">Space Weather</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`font-mono text-sm ${kpIndex >= 5 ? 'text-red-400' : kpIndex >= 3 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                Kp {kpIndex.toFixed(1)}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                kpIndex >= 5 ? 'bg-red-500/20 text-red-400' :
                kpIndex >= 3 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {kpIndex >= 5 ? 'SEVERE' : kpIndex >= 3 ? 'ACTIVE' : 'QUIET'}
              </span>
            </div>
          </div>
        </div>

        {/* Layer toggles grid */}
        <div className="grid grid-cols-2 gap-2 p-4">
          <LayerToggle icon={Shield} label="Atmosphere" checked={localAtmosphereEnabled} onChange={setLocalAtmosphereEnabled} />
          <LayerToggle icon={Cloud} label="Weather" checked={localWeatherEnabled} onChange={setLocalWeatherEnabled} />
          <LayerToggle icon={Flame} label="Fires" checked={localFiresEnabled} onChange={setLocalFiresEnabled} />
          <LayerToggle icon={Plane} label="Aircraft" checked={localAircraftEnabled} onChange={setLocalAircraftEnabled} />
          <LayerToggle icon={Radio} label="Clouds" checked={localCloudsEnabled} onChange={setLocalCloudsEnabled} />
          <LayerToggle icon={TrendingUp} label="Markets" checked={localMarketsEnabled} onChange={setLocalMarketsEnabled} />
        </div>

        {/* Active points count */}
        <div className="px-4 pb-6">
          <div className="flex items-center justify-between py-2 px-3 bg-zinc-800/50 rounded-lg">
            <span className="text-xs text-zinc-400">Active Nodes</span>
            <span className="font-mono text-sm text-emerald-400">{visiblePoints.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
