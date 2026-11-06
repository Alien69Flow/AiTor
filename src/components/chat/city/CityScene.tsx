import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Html, Lightformer, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { CITY_DISTRICTS, type CityDistrict } from "./districts";

function readPalette() {
  const css = getComputedStyle(document.documentElement);
  const read = (name: string) => {
    const [h, s, l] = css.getPropertyValue(`--city-${name}`).trim().split(/\s+/);
    return new THREE.Color(`hsl(${h}, ${s}, ${l})`);
  };
  return { background: read("background"), surface: read("surface"), lime: read("lime"), gold: read("gold"), cyan: read("cyan") };
}
type Palette = ReturnType<typeof readPalette>;

function CityFloor({ palette }: { palette: Palette }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = palette.background.getStyle();
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = palette.surface.clone().multiplyScalar(2.5).getStyle();
      ctx.lineWidth = 1;
      for (let i = 0; i <= 512; i += 32) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
      }
      ctx.strokeStyle = palette.cyan.getStyle();
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 16; i++) {
        const x = (i * 73) % 480; const y = (i * 137) % 480;
        ctx.strokeRect(x, y, 12, 12);
      }
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(3, 3);
    return map;
  }, [palette]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh rotation-x={-Math.PI / 2} position-y={-0.06}><circleGeometry args={[19, 96]} /><meshStandardMaterial map={texture} metalness={0.7} roughness={0.5} /></mesh>;
}

function Skyline({ palette }: { palette: Palette }) {
  const instance = useRef<THREE.InstancedMesh>(null);
  const blocks = useMemo(() => Array.from({ length: 60 }, (_, i) => {
    const a = i * 2.39996;
    const radius = 11 + (i % 5) * 1.05;
    return { x: Math.cos(a) * radius, z: Math.sin(a) * radius, h: 0.7 + ((i * 17) % 13) * 0.19, w: 0.45 + (i % 3) * 0.18 };
  }), []);
  useEffect(() => {
    if (!instance.current) return;
    const dummy = new THREE.Object3D();
    blocks.forEach((b, i) => {
      dummy.position.set(b.x, b.h / 2, b.z); dummy.scale.set(b.w, b.h, b.w); dummy.updateMatrix();
      instance.current?.setMatrixAt(i, dummy.matrix);
    });
    instance.current.instanceMatrix.needsUpdate = true;
  }, [blocks]);
  const edges = useMemo(() => {
    const vertices: number[] = [];
    const edge = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    const attr = edge.getAttribute("position");
    blocks.forEach(b => { for (let i = 0; i < attr.count; i++) vertices.push(attr.getX(i) * b.w + b.x, attr.getY(i) * b.h + b.h / 2, attr.getZ(i) * b.w + b.z); });
    edge.dispose();
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)); return geo;
  }, [blocks]);
  useEffect(() => () => edges.dispose(), [edges]);
  return <>
    <instancedMesh ref={instance} args={[undefined, undefined, blocks.length]}><boxGeometry /><meshStandardMaterial color={palette.surface} metalness={0.6} roughness={0.4} /></instancedMesh>
    <lineSegments geometry={edges}><lineBasicMaterial color={palette.cyan} transparent opacity={0.35} /></lineSegments>
  </>;
}

function District({ district, selected, onSelect, palette }: { district: CityDistrict; selected: boolean; onSelect: (id: string) => void; palette: Palette }) {
  const color = palette[district.color];
  const central = district.id === "nexus";
  const height = central ? 6 : district.id === "forge" ? 3.6 : 2.6;
  const width = central ? 1.2 : 1.05;
  return <group position={[...district.position]}>
    <mesh onClick={e => { e.stopPropagation(); onSelect(district.id); }} position-y={0.15}>
      <cylinderGeometry args={[2.1, 2.3, 0.3, 6]} />
      <meshStandardMaterial color={palette.surface} emissive={color} emissiveIntensity={selected ? 0.22 : 0.04} metalness={0.8} roughness={0.3} />
    </mesh>
    <mesh position-y={0.32} rotation-x={-Math.PI / 2}><ringGeometry args={[1.85, selected ? 2.02 : 1.91, 6]} /><meshBasicMaterial color={color} side={THREE.DoubleSide} /></mesh>
    <mesh position-y={height / 2 + 0.3} onClick={e => { e.stopPropagation(); onSelect(district.id); }}>
      <cylinderGeometry args={[central ? 0.25 : width * 0.75, width, height, central ? 6 : 4]} />
      <meshPhysicalMaterial color={color} transparent opacity={selected ? 0.38 : 0.2} metalness={0.5} roughness={0.2} depthWrite={false} />
    </mesh>
    <mesh position-y={height / 2 + 0.3}>
      <cylinderGeometry args={[central ? 0.25 : width * 0.75, width, height, central ? 6 : 4]} />
      <meshBasicMaterial color={color} wireframe transparent opacity={0.75} />
    </mesh>
    {[0.8, 1.5, 2.2].map(y => <mesh key={y} position-y={y} rotation-x={-Math.PI / 2}><ringGeometry args={[width * 0.9, width * 0.93, central ? 6 : 4]} /><meshBasicMaterial color={color} side={THREE.DoubleSide} /></mesh>)}
    {central && <mesh position-y={4.3} rotation-x={Math.PI / 2}><torusGeometry args={[1.7, 0.025, 6, 64]} /><meshBasicMaterial color={color} /></mesh>}
    <Html position={[0, height + 0.9, 0]} center zIndexRange={[5, 0]}>
      <button type="button" aria-label={`Seleccionar ${district.name}`} onClick={() => onSelect(district.id)} className={`whitespace-nowrap border bg-background/90 px-2 py-1 font-mono text-[9px] transition-colors ${selected ? "border-secondary/70 text-secondary" : "border-border/70 text-muted-foreground hover:text-foreground"}`}>
        {district.name}
      </button>
    </Html>
  </group>;
}

function Links({ palette, moving }: { palette: Palette; moving: boolean }) {
  const packets = useRef<THREE.InstancedMesh>(null);
  const time = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(() => {
    const points: number[] = [];
    CITY_DISTRICTS.slice(1).forEach(d => points.push(0, 0.36, 0, d.position[0], 0.36, d.position[2]));
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(points, 3)); return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, delta) => {
    if (!packets.current) return;
    if (moving) time.current += Math.min(delta, 0.05) * 0.24;
    CITY_DISTRICTS.slice(1).forEach((d, i) => {
      const t = (time.current + i * 0.21) % 1;
      dummy.position.set(d.position[0] * t, 0.4, d.position[2] * t); dummy.updateMatrix(); packets.current?.setMatrixAt(i, dummy.matrix);
    });
    packets.current.instanceMatrix.needsUpdate = true;
  });
  return <>
    <lineSegments geometry={geometry}><lineBasicMaterial color={palette.cyan} transparent opacity={0.45} /></lineSegments>
    <instancedMesh ref={packets} args={[undefined, undefined, 5]}><octahedronGeometry args={[0.08]} /><meshBasicMaterial color={palette.gold} /></instancedMesh>
  </>;
}

function CameraSetup() {
  const { camera, size } = useThree();
  useEffect(() => { camera.position.set(20, 21, 25); camera.lookAt(0, 0, 0); if (camera instanceof THREE.PerspectiveCamera) { camera.fov = size.width < size.height ? 52 : 42; camera.updateProjectionMatrix(); } }, [camera, size.width, size.height]);
  return null;
}

export default function CityScene({ selected, onSelect, moving, reset }: { selected: string; onSelect: (id: string) => void; moving: boolean; reset: number }) {
  const palette = useMemo(readPalette, []);
  return <Canvas key={reset} dpr={[1, 1.5]} camera={{ position: [20, 21, 25], fov: 42 }} gl={{ antialias: true }} aria-label="Ciudad holográfica AlienFlow.Space">
    <color attach="background" args={[palette.background]} />
    <fog attach="fog" args={[palette.background, 38, 75]} />
    <ambientLight intensity={0.8} />
    <directionalLight position={[5, 12, 5]} intensity={2} color={palette.cyan} />
    <Environment resolution={64}><Lightformer intensity={2} position={[0, 10, 0]} rotation-x={-Math.PI / 2} scale={[20, 20, 1]} /><Lightformer intensity={1} color={palette.gold} position={[-10, 4, 0]} rotation-y={Math.PI / 2} scale={[10, 5, 1]} /></Environment>
    <CameraSetup />
    <CityFloor palette={palette} /><Skyline palette={palette} /><Links palette={palette} moving={moving} />
    {CITY_DISTRICTS.map(d => <District key={d.id} district={d} selected={selected === d.id} onSelect={onSelect} palette={palette} />)}
    <OrbitControls makeDefault enablePan={false} minDistance={17} maxDistance={48} maxPolarAngle={Math.PI / 2.3} minPolarAngle={0.2} />
  </Canvas>;
}