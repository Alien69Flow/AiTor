import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Globe from "react-globe.gl";
import * as THREE from 'three';

// ARQUITECTURA DE DATOS: Unificación de Fuerzas de la DAO
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
  type: "conflict" | "finance" | "tech" | "geopolitical" | "quake" | "dao_node";
}

// RESTAURACIÓN TOTAL: Las 16 Ciudades Originales de la DAO (Hotspots)
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

interface GlobeSceneProps {
  onHotspotClick?: (data: UnifiedHotspotData | null) => void;
}

export function GlobeScene({ onHotspotClick }: GlobeSceneProps) {
  const globeRef = useRef<any>();
  const [pointsData, setPointsData] = useState<UnifiedHotspotData[]>(DAO_BASE_HOTSPOTS);
  const [arcsData, setArcsData] = useState<any[]>([]);

  // EFECTO 1: SISTEMA COSMOS, LUZ SOLAR Y CAMPO TESLA
  useEffect(() => {
    if (globeRef.current) {
      const globeScene = globeRef.current.getGlobe().scene;

      // 1. Cosmos Skybox (NASA Deep Space con Vía Láctea, Luna y Sol integrados en textura)
      const loader = new THREE.TextureLoader();
      const skyTexture = loader.load('//unpkg.com/three-globe/example/img/night-sky.png');
      globeScene.background = skyTexture;

      // 2. Campo Tesla Cyan (Aura de Convección de Neutrinos)
      const teslaAuraGeometry = new THREE.SphereGeometry(2.35, 64, 64);
      const teslaAuraMaterial = new THREE.MeshPhongMaterial({
        color: "#00aaff", // Cyan/Azul potente de la interfaz de referencia
        transparent: true,
        opacity: 0.12,
        side: THREE.BackSide,
        shininess: 50,
        emissive: "#00aaff",
        emissiveIntensity: 0.4
      });
      const teslaAuraMesh = new THREE.Mesh(teslaAuraGeometry, teslaAuraMaterial);
      globeScene.add(teslaAuraMesh);

      // 3. Iluminación Pro (Sol simulado como Luz Direccional)
      const sunLight = new THREE.DirectionalLight("#ffffff", 0.7);
      sunLight.position.set(5, 3, 5); // Simular posición solar
      globeScene.add(sunLight);
      
      // Configuración de vista inicial (África/Medio Oriente)
      globeRef.current.pointOfView({ lat: 25, lng: 30, altitude: 2.3 });
      globeRef.current.controls().autoRotate = true;
      globeRef.current.controls().autoRotateSpeed = 0.4;
    }
  }, []);

  // EFECTO 2: UNIFICACIÓN DE DATOS (Restauración de Arcos y USGS Terremotos)
  useEffect(() => {
    // A. RESTAURACIÓN DE ARCOS DE FLUJO TESLA entre Hotspots de la DAO
    // Usamos los índices originales: Tehran-London, Kuwait-NewYork, Beijing-Seoul, etc.
    const pairs = [[0, 5], [2, 8], [11, 13], [14, 6], [9, 1], [15, 7]];
    const newArcs = pairs.map(([a, b]) => {
      const start = DAO_BASE_HOTSPOTS[a];
      const end = DAO_BASE_HOTSPOTS[b];
      if (!start || !end) return null;
      return {
        startLat: start.lat,
        startLng: start.lon,
        endLat: end.lat,
        endLng: end.lon,
        color: start.color, // Color del emisor (Tehran=Rojo, Kuwait=Naranja)
      };
    }).filter(Boolean);
    setArcsData(newArcs);

    // B. INYECCIÓN DE DATOS EN TIEMPO REAL: USGS Earthquakes
    const quakeApiUrl = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson';
    fetch(quakeApiUrl)
      .then(response => response.json())
      .then(quakeData => {
        // Mapeo de USGS a UnifiedHotspotData
        const quakes = quakeData.features.map((feat: any) => ({
          lat: feat.geometry.coordinates[1],
          lon: feat.geometry.coordinates[0],
          intensity: feat.properties.mag / 9,
          color: "#ffff00", // Amarillo para terremotos M4.5+
          name: `TERREMOTO Mag ${feat.properties.mag} - ${feat.properties.title}`,
          country: "USGS Real-time",
          marketVolume: "N/A",
          trend: "N/A",
          topTokens: [],
          type: "quake"
        }));

        // Unificación final: Static 16 + Dynamic USGS
        setPointsData([...DAO_BASE_HOTSPOTS, ...quakes]);
        console.log(`Unificación Delta completada: ${quakes.length} Terremotos USGS inyectados.`);
      })
      .catch(err => console.error("Fuga de datos tectónica: ", err));
  }, []);

  // Función de mapeo de Tooltip para el fotorrealismo táctico
  const getTooltip = useCallback((point: UnifiedHotspotData) => {
    if (point.type === 'quake') {
      return `<div class="bg-black/90 p-3 border border-yellow-400 rounded-lg shadow-[0_0_10px_#ffff00]">
        <h4 class="text-yellow-400 font-bold">${point.name}</h4>
      </div>`;
    }
    return `<div class="bg-black/90 p-3 border border-primary/30 rounded-lg shadow-[0_0_10px_#00ff00]">
      <h4 class="text-primary font-bold">${point.name}, ${point.country}</h4>
      <p class="text-xs text-white">Volumen: ${point.marketVolume}</p>
      <p class="text-xs text-white">Tendencia: <span class="${point.trend.startsWith('+') ? 'text-green-400' : 'text-red-400'}">${point.trend}</span></p>
    </div>`;
  }, []);

  return (
    <div className="w-full h-full relative bg-transparent flex items-center justify-center">
      <Globe
        ref={globeRef}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundColor="rgba(0,0,0,0)" // Transparente para usar el Skybox de Three.js
        
        // Fotorrealismo Táctico (NASA night lights y topología)
        showGraticules={true}
        graticulesColor="rgba(0, 255, 65, 0.05)"
        
        // Puntos de Flujo Unificados (DAO 16 + Quakes)
        pointsData={pointsData}
        pointLat="lat"
        pointLng="lon"
        pointColor="color"
        pointRadius={(d: any) => d.type === 'quake' ? d.intensity * 0.7 : d.intensity * 0.45}
        onPointClick={(point: any) => onHotspotClick?.(point as UnifiedHotspotData)}
        labelColor={() => 'rgba(255, 255, 255, 0.8)'}
        labelsData={pointsData.filter(d => d.type !== 'quake')} // No etiquetar terremotos
        labelSize={0.5}
        labelLat="lat"
        labelLng="lon"
        labelText="name"
        labelDotRadius={0}
        
        // Arcos de Transferencia Energética (Tesla Pairs)
        arcsData={arcsData}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor="color"
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={2500}
        arcStroke={0.5}

        // Atmósfera de Neón Verde (Tesla Field)
        showAtmosphere={true}
        atmosphereColor="#00ff41" 
        atmosphereAltitude={0.15}
      />
    </div>
  );
}
