import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Sphere } from "@react-three/drei";
import * as THREE from "three";

function Earth() {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const arcsRef = useRef<THREE.Group>(null);

  const hotspots = useMemo(() => {
    const points: { pos: THREE.Vector3; intensity: number; color: string }[] = [];
    const hotspotData = [
      { lat: 35.7, lon: 51.4, intensity: 1, color: "#ff4444" },
      { lat: 32.0, lon: 34.8, intensity: 0.9, color: "#ff6644" },
      { lat: 29.3, lon: 47.9, intensity: 0.7, color: "#ff8844" },
      { lat: 26.2, lon: 50.5, intensity: 0.6, color: "#ff8844" },
      { lat: 24.4, lon: 54.6, intensity: 0.5, color: "#ffaa44" },
      { lat: 51.5, lon: -0.1, intensity: 0.4, color: "#00ff41" },
      { lat: 48.8, lon: 2.3, intensity: 0.3, color: "#00ff41" },
      { lat: 52.5, lon: 13.4, intensity: 0.3, color: "#00ff41" },
      { lat: 40.7, lon: -74.0, intensity: 0.5, color: "#00ff41" },
      { lat: 38.9, lon: -77.0, intensity: 0.6, color: "#00ff41" },
      { lat: 34.0, lon: -118.2, intensity: 0.3, color: "#00ff41" },
      { lat: 39.9, lon: 116.4, intensity: 0.7, color: "#ffdd44" },
      { lat: 35.6, lon: 139.6, intensity: 0.4, color: "#00ff41" },
      { lat: 37.5, lon: 127.0, intensity: 0.3, color: "#00ff41" },
      { lat: 55.7, lon: 37.6, intensity: 0.5, color: "#ff6644" },
      { lat: 48.7, lon: 37.5, intensity: 0.8, color: "#ff4444" },
    ];

    hotspotData.forEach(({ lat, lon, intensity, color }) => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lon + 180) * (Math.PI / 180);
      const r = 2.02;
      const x = -(r * Math.sin(phi) * Math.cos(theta));
      const z = r * Math.sin(phi) * Math.sin(theta);
      const y = r * Math.cos(phi);
      points.push({ pos: new THREE.Vector3(x, y, z), intensity, color });
    });
    return points;
  }, []);

  // Signal arcs between hotspots
  const arcGeometries = useMemo(() => {
    const arcs: THREE.BufferGeometry[] = [];
    const pairs = [
      [0, 5], [3, 8], [11, 13], [14, 6], [9, 1], [7, 12],
    ];
    pairs.forEach(([a, b]) => {
      if (!hotspots[a] || !hotspots[b]) return;
      const start = hotspots[a].pos;
      const end = hotspots[b].pos;
      const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      mid.normalize().multiplyScalar(3.2); // arc height
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const points = curve.getPoints(40);
      arcs.push(new THREE.BufferGeometry().setFromPoints(points));
    });
    return arcs;
  }, [hotspots]);

  const continentPoints = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const count = 6000;
    
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const r = 2.01;
      
      const lat = 90 - (phi * 180) / Math.PI;
      const lon = (theta * 180) / Math.PI - 180;
      
      const isLand = checkLand(lat, lon);
      if (!isLand) continue;
      
      const x = -(r * Math.sin(phi) * Math.cos(theta));
      const z = r * Math.sin(phi) * Math.sin(theta);
      const y = r * Math.cos(phi);
      
      positions.push(x, y, z);
      colors.push(0.0, 1.0, 0.25); // phosphorescent green
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geometry;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * 0.03;
    if (meshRef.current) meshRef.current.rotation.y = t;
    if (glowRef.current) glowRef.current.rotation.y = t;
    if (pointsRef.current) pointsRef.current.rotation.y = t;
    if (arcsRef.current) arcsRef.current.rotation.y = t;
  });

  return (
    <group>
      {/* Main sphere - dark ocean */}
      <Sphere ref={meshRef} args={[2, 64, 64]}>
        <meshPhongMaterial color="#050d18" transparent opacity={0.95} shininess={20} />
      </Sphere>

      {/* Atmosphere glow - green */}
      <Sphere ref={glowRef} args={[2.08, 64, 64]}>
        <meshPhongMaterial color="#003a10" transparent opacity={0.15} side={THREE.BackSide} />
      </Sphere>

      {/* Outer glow */}
      <Sphere args={[2.2, 32, 32]}>
        <meshBasicMaterial color="#00ff41" transparent opacity={0.03} side={THREE.BackSide} />
      </Sphere>

      {/* Continent dots */}
      <points ref={pointsRef} geometry={continentPoints}>
        <pointsMaterial size={0.018} vertexColors transparent opacity={0.7} sizeAttenuation />
      </points>

      {/* Signal arcs */}
      <group ref={arcsRef}>
        {arcGeometries.map((geo, i) => (
          <primitive
            key={`arc-${i}`}
            object={new THREE.Line(geo, new THREE.LineBasicMaterial({ color: "#00ff41", transparent: true, opacity: 0.25 }))}
          />
        ))}
      </group>

      {/* Hotspot markers */}
      {hotspots.map((spot, i) => (
        <HotspotMarker key={i} position={spot.pos} intensity={spot.intensity} color={spot.color} />
      ))}

      {/* Grid lines */}
      <GridLines />
    </group>
  );
}

function HotspotMarker({ position, intensity, color }: { position: THREE.Vector3; intensity: number; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  
  useFrame(({ clock }) => {
    if (ref.current) {
      const scale = 1 + Math.sin(clock.getElapsedTime() * 2 + intensity * 10) * 0.3;
      ref.current.scale.setScalar(scale);
    }
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.03 * intensity + 0.02, 8, 8]} />
      <meshBasicMaterial color={color} transparent opacity={0.8} />
    </mesh>
  );
}

function GridLines() {
  const lines = useMemo(() => {
    const group: JSX.Element[] = [];
    const r = 2.015;
    
    for (let lat = -60; lat <= 60; lat += 30) {
      const points: THREE.Vector3[] = [];
      const phi = (90 - lat) * (Math.PI / 180);
      for (let lon = 0; lon <= 360; lon += 5) {
        const theta = lon * (Math.PI / 180);
        const x = -(r * Math.sin(phi) * Math.cos(theta));
        const z = r * Math.sin(phi) * Math.sin(theta);
        const y = r * Math.cos(phi);
        points.push(new THREE.Vector3(x, y, z));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      group.push(
        <primitive key={`lat-${lat}`} object={new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: "#003a10", transparent: true, opacity: 0.2 }))} />
      );
    }

    for (let lon = 0; lon < 360; lon += 30) {
      const points: THREE.Vector3[] = [];
      const theta = lon * (Math.PI / 180);
      for (let lat = -90; lat <= 90; lat += 5) {
        const phi = (90 - lat) * (Math.PI / 180);
        const x = -(r * Math.sin(phi) * Math.cos(theta));
        const z = r * Math.sin(phi) * Math.sin(theta);
        const y = r * Math.cos(phi);
        points.push(new THREE.Vector3(x, y, z));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      group.push(
        <primitive key={`lon-${lon}`} object={new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: "#003a10", transparent: true, opacity: 0.15 }))} />
      );
    }

    return group;
  }, []);

  return <>{lines}</>;
}

function checkLand(lat: number, lon: number): boolean {
  if (lat > 25 && lat < 70 && lon > -130 && lon < -60) return Math.random() > 0.4;
  if (lat > -55 && lat < 12 && lon > -80 && lon < -35) return Math.random() > 0.45;
  if (lat > 35 && lat < 70 && lon > -10 && lon < 40) return Math.random() > 0.4;
  if (lat > -35 && lat < 37 && lon > -20 && lon < 50) return Math.random() > 0.4;
  if (lat > 12 && lat < 42 && lon > 25 && lon < 65) return Math.random() > 0.35;
  if (lat > 10 && lat < 55 && lon > 60 && lon < 145) return Math.random() > 0.4;
  if (lat > 50 && lat < 75 && lon > 40 && lon < 180) return Math.random() > 0.45;
  if (lat > -40 && lat < -10 && lon > 110 && lon < 155) return Math.random() > 0.5;
  return false;
}

export function GlobeScene() {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 1.5, 5], fov: 45 }}
        style={{ background: "transparent" }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 3, 5]} intensity={0.6} color="#00ff41" />
        <directionalLight position={[-5, -2, -5]} intensity={0.2} color="#003a10" />
        <pointLight position={[3, 2, 4]} intensity={0.4} color="#00ff41" />
        
        <Earth />
        
        <OrbitControls
          enableZoom={true}
          enablePan={false}
          minDistance={3.5}
          maxDistance={8}
          autoRotate={false}
          rotateSpeed={0.5}
          zoomSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}
