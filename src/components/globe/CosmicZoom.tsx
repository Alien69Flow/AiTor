import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { ArrowDown, ArrowUp, MousePointer2, X } from "lucide-react";
import {
  COSMIC_STEP,
  EARTH_SCALE,
  SCALE_MAX,
  SCALE_MIN,
  STAGES,
  formatScale,
  nextCosmicScale,
  stageOpacity,
  type CosmicDirection,
} from "@/lib/cosmic-scale";
import {
  LOCAL_GROUP,
  LOCAL_STARS,
  STAGE_FACTS,
  SUPERCLUSTER_NODES,
  VIRGO_CENTER,
  VIRGO_MEMBERS,
  equatorialToCartesian,
} from "@/lib/cosmic-objects";
import {
  PLANETS,
  SUN,
  auToMillionKm,
  displayRadius,
  orbitPath,
  scenePosition,
  solarSystemState,
  type PlanetState,
  type SolarElements,
} from "@/lib/solar-system";

/**
 * Continuous "powers of ten" zoom out from the globe.
 *
 * The whole experience is driven by ONE number: `scale` = log10(metres).
 * Earth sits near 7 (10 Mm), the observable universe near 27. Each stage is a
 * self-contained scene rendered at its own working scale and cross-faded with
 * its neighbours, which is the only way to show 10^7 and 10^27 m at once.
 * The scale model itself lives in `@/lib/cosmic-scale`.
 */

// ---------------------------------------------------------------- textures

function radialTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.25, "rgba(255,236,190,0.65)");
  gradient.addColorStop(0.55, "rgba(255,170,80,0.18)");
  gradient.addColorStop(1, "rgba(255,120,30,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function galaxySpriteTexture(tint: string): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.3, tint);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

const EARTH_MAP = "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg";
const EARTH_CLOUDS = "https://unpkg.com/three-globe/example/img/earth-clouds.png";

/** Fresnel rim so the planet reads as lit atmosphere rather than a flat ball. */
const ATMOSPHERE_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const ATMOSPHERE_FRAGMENT = /* glsl */ `
  uniform vec3 glowColor;
  uniform float intensity;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float rim = pow(1.0 - abs(dot(vNormal, vView)), 3.0);
    gl_FragColor = vec4(glowColor, rim * intensity);
  }
`;

// ---------------------------------------------------------------- stages

function EarthStage({ opacity }: { opacity: number }) {
  const textures = useMemo(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    const map = loader.load(EARTH_MAP);
    map.colorSpace = THREE.SRGBColorSpace;
    const clouds = loader.load(EARTH_CLOUDS);
    clouds.colorSpace = THREE.SRGBColorSpace;
    return { map, clouds };
  }, []);
  const cloudRef = useRef<THREE.Mesh>(null);
  const atmosphereProps = useMemo(
    () => ({
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    }),
    [],
  );
  const atmosphereUniforms = useMemo(
    () => ({ glowColor: { value: new THREE.Color("#4aa8ff") }, intensity: { value: 1 } }),
    [],
  );

  useFrame((_, delta) => {
    if (cloudRef.current) cloudRef.current.rotation.y += delta * 0.01;
  });

  return (
    <group visible={opacity > 0.01}>
      <mesh>
        <sphereGeometry args={[1, 96, 96]} />
        <meshStandardMaterial map={textures.map} roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh ref={cloudRef} scale={1.006}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial map={textures.clouds} transparent opacity={0.42 * opacity} depthWrite={false} />
      </mesh>
      <mesh scale={1.09}>
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial
          vertexShader={ATMOSPHERE_VERTEX}
          fragmentShader={ATMOSPHERE_FRAGMENT}
          uniforms={atmosphereUniforms}
          {...atmosphereProps}
        />
      </mesh>
    </group>
  );
}

function CislunarStage({ opacity }: { opacity: number }) {
  const moonRef = useRef<THREE.Group>(null);
  const moonDistance = 6.4; // scene units ≈ 384 400 km at this working scale
  useFrame(({ clock }) => {
    if (moonRef.current) {
      const angle = clock.elapsedTime * 0.08;
      moonRef.current.position.set(Math.cos(angle) * moonDistance, 0, Math.sin(angle) * moonDistance);
    }
  });
  return (
    <group visible={opacity > 0.01}>
      <mesh>
        <sphereGeometry args={[0.16, 48, 48]} />
        <meshStandardMaterial color="#2f6fb0" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[moonDistance - 0.012, moonDistance + 0.012, 128]} />
        <meshBasicMaterial color="#2a4a6b" transparent opacity={0.5 * opacity} side={THREE.DoubleSide} />
      </mesh>
      <group ref={moonRef}>
        <mesh>
          <sphereGeometry args={[0.045, 32, 32]} />
          <meshStandardMaterial color="#b9b6ae" roughness={1} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Nube de Oort: la cáscara de núcleos helados que cierra el sistema solar.
 *
 * Va de 2 000 a 100 000 UA del Sol —0,03 a 1,58 años luz—, así que es el primer
 * escalón que ya se mide en años luz. La densidad cae hacia fuera: los puntos se
 * reparten con raíz cúbica para que el borde interior se vea mucho más poblado
 * que el exterior, como en los modelos de la nube.
 */
function OortStage({ opacity }: { opacity: number }) {
  const geometry = useMemo(() => {
    const count = 7000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const inner = 1.5;
    const outer = 7.2;
    const icy = new THREE.Color("#9fd4ff");
    const dust = new THREE.Color("#ffe2b8");
    for (let i = 0; i < count; i += 1) {
      const t = Math.cbrt(Math.random());
      const r = inner + (outer - inner) * t;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      const color = icy
        .clone()
        .lerp(dust, Math.random() * 0.5)
        .multiplyScalar(0.45 + Math.random() * 0.6);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);

  return (
    <group visible={opacity > 0.01}>
      <points geometry={geometry}>
        <pointsMaterial
          size={0.022}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.7 * opacity}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

/** 1 año luz de escena. A esta escala Próxima queda a 2,3 unidades del Sol. */
const LY_UNITS = 0.55;

/**
 * Vecindario solar: las 25 estrellas a menos de 17 años luz, en sus posiciones
 * reales.
 *
 * Ascensión recta, declinación y distancia son las de Gaia DR3/Hipparcos, y la
 * escala es lineal (1 unidad = 1 año luz): por eso Alfa Centauri y Próxima salen
 * casi pegadas y Altair, a 16,7 al, es la más lejana del grupo. El Sol es la
 * esfera dorada del centro.
 */
function NeighborhoodStage({ opacity }: { opacity: number }) {
  const glow = useMemo(() => radialTexture(), []);
  const stars = useMemo(
    () =>
      LOCAL_STARS.map((star) => ({
        ...star,
        position: equatorialToCartesian(star.ra, star.dec, star.ly * LY_UNITS),
      })),
    [],
  );

  return (
    <group visible={opacity > 0.01}>
      <sprite scale={[0.55, 0.55, 1]}>
        <spriteMaterial
          map={glow}
          color="#ffe9a8"
          transparent
          opacity={0.9 * opacity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      {stars.map((star) => (
        <group key={star.name} position={star.position as unknown as THREE.Vector3Tuple}>
          <mesh>
            <sphereGeometry args={[0.04, 12, 12]} />
            <meshBasicMaterial color={star.color} transparent opacity={0.9 * opacity} />
          </mesh>
          <sprite scale={[0.3, 0.3, 1]}>
            <spriteMaterial
              map={glow}
              color={star.color}
              transparent
              opacity={0.45 * opacity}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </sprite>
        </group>
      ))}
    </group>
  );
}

/**
 * Órbita real: la elipse se calcula con la ecuación de Kepler del planeta, así
 * que Mercurio y Plutón salen con su excentricidad y su perihelio orientado, en
 * vez de círculos concéntricos iguales.
 */
function OrbitPath({ planet, opacity }: { planet: SolarElements; opacity: number }) {
  // `THREE.Line` como objeto primitivo: en JSX, `<line>` colisiona con el
  // elemento SVG del mismo nombre y TypeScript no deja pasar `geometry`.
  const line = useMemo(() => {
    const points = orbitPath(planet, 180).map(([x, z]) => new THREE.Vector3(x, 0, z));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: "#26405c", transparent: true, opacity: 0.55 });
    const object = new THREE.Line(geometry, material);
    object.rotation.x = -Math.PI / 2;
    return object;
  }, [planet]);

  useEffect(() => {
    (line.material as THREE.LineBasicMaterial).opacity = 0.55 * opacity;
  }, [line, opacity]);

  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );

  return <primitive object={line} />;
}

/**
 * Sistema solar con posiciones reales.
 *
 * Las distancias son las medidas —1 unidad de escena = 3,33 UA— y los planetas
 * están donde los pone la ecuación de Kepler para la fecha de apertura, no
 * girando con el reloj. Los tamaños son simbólicos (a escala real la Tierra
 * mediría 4·10⁻⁵ UA): conservan el orden real de tamaños y el panel del
 * overlay escribe el diámetro y la distancia verdaderos al lado.
 */
function SolarStage({
  opacity,
  glow,
  states,
}: {
  opacity: number;
  glow: THREE.Texture;
  states: PlanetState[];
}) {
  return (
    <group visible={opacity > 0.01} rotation={[0.32, 0, 0.1]}>
      <pointLight position={[0, 0, 0]} intensity={2.4 * opacity} distance={0} color="#fff2d0" />
      <mesh>
        <sphereGeometry args={[displayRadius(SUN.radiusKm), 48, 48]} />
        <meshBasicMaterial color={SUN.color} />
      </mesh>
      <sprite scale={[6.5, 6.5, 1]}>
        <spriteMaterial map={glow} transparent opacity={0.8 * opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      {PLANETS.map((planet) => (
        <OrbitPath key={`orbit-${planet.id}`} planet={planet} opacity={opacity} />
      ))}
      {states.map((state) => {
        const { x, z } = scenePosition(state);
        const size = displayRadius(state.radiusKm);
        return (
          <group key={state.id} position={[x, 0, z]}>
            <mesh>
              <sphereGeometry args={[size, 32, 32]} />
              <meshStandardMaterial color={state.color} roughness={0.75} />
            </mesh>
            {state.ring && (
              <mesh rotation={[-Math.PI / 2.4, 0, 0]}>
                <ringGeometry args={[size * 1.45, size * 2.3, 64]} />
                <meshBasicMaterial color="#d9cba8" transparent opacity={0.7 * opacity} side={THREE.DoubleSide} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

/** Spiral galaxy built from points: warm core, blue-white arms, dust lanes. */
function GalaxyStage({ opacity }: { opacity: number }) {
  const coreGlow = useMemo(() => radialTexture(), []);
  const geometry = useMemo(() => {
    const arms = 4;
    const perArm = 12000;
    const count = arms * perArm + 2000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const core = new THREE.Color("#fff0c8");
    const armInner = new THREE.Color("#ffd9a0");
    const armOuter = new THREE.Color("#7fb4ff");
    let cursor = 0;
    const push = (x: number, y: number, z: number, color: THREE.Color, dim: number) => {
      positions[cursor * 3] = x;
      positions[cursor * 3 + 1] = y;
      positions[cursor * 3 + 2] = z;
      colors[cursor * 3] = color.r * dim;
      colors[cursor * 3 + 1] = color.g * dim;
      colors[cursor * 3 + 2] = color.b * dim;
      cursor += 1;
    };
    const jitter = (amount: number) => (Math.random() - 0.5) * amount;
    for (let arm = 0; arm < arms; arm += 1) {
      const armOffset = (arm / arms) * Math.PI * 2;
      for (let i = 0; i < perArm; i += 1) {
        const t = Math.pow(Math.random(), 0.55);
        const radius = 0.25 + t * 5.6;
        const spiral = armOffset + t * 3.5;
        const spread = 0.16 + t * 0.5;
        const x = Math.cos(spiral) * radius + jitter(spread);
        const z = Math.sin(spiral) * radius + jitter(spread);
        const y = jitter(0.28 * (1 - t * 0.7));
        const mixed = armInner.clone().lerp(armOuter, t);
        push(x, y, z, mixed, 0.65 + Math.random() * 0.5);
      }
    }
    // Bulge
    for (let i = 0; i < 2000; i += 1) {
      const r = Math.pow(Math.random(), 2.2) * 1.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi) * 0.55,
        r * Math.sin(phi) * Math.sin(theta),
        core,
        1.0,
      );
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);

  return (
    <group visible={opacity > 0.01} rotation={[0.42, 0, 0.12]}>
      <points geometry={geometry}>
        <pointsMaterial
          size={0.032}
          sizeAttenuation
          vertexColors
          transparent
          opacity={opacity}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <sprite scale={[7, 7, 1]}>
        <spriteMaterial map={coreGlow} transparent opacity={0.35 * opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
    </group>
  );
}

/** 1 millón de años luz de escena: Andrómeda queda a 3,9 unidades. */
const MLY_UNITS = 1.55;

/**
 * Grupo Local con las galaxias en su sitio: antes eran cinco manchas
 * inventadas. Ahora cada sprite está en la dirección y a la distancia
 * publicadas (M31 a 2,54 Mal, M33 a 2,73 Mal, las Nubes de Magallanes a 163 y
 * 200 kal) y su tamaño es proporcional al diámetro real de la galaxia, no un
 * número arbitrario.
 */
function LocalGroupStage({ opacity }: { opacity: number }) {
  const galaxies = useMemo(
    () =>
      LOCAL_GROUP.map((galaxy) => ({
        ...galaxy,
        position:
          galaxy.mly === 0
            ? ([0, 0, 0] as [number, number, number])
            : equatorialToCartesian(galaxy.ra, galaxy.dec, galaxy.mly * MLY_UNITS),
        scale: Math.max(1.1, Math.sqrt(galaxy.kly) * 0.55),
      })),
    [],
  );
  const textures = useMemo(() => galaxies.map((galaxy) => galaxySpriteTexture(galaxy.tint)), [galaxies]);
  return (
    <group visible={opacity > 0.01}>
      {galaxies.map((galaxy, index) => (
        <sprite
          key={galaxy.name}
          position={galaxy.position as unknown as THREE.Vector3Tuple}
          scale={[galaxy.scale, galaxy.scale * 0.62, 1]}
        >
          <spriteMaterial
            map={textures[index]}
            transparent
            opacity={0.85 * opacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            rotation={index * 0.7}
          />
        </sprite>
      ))}
    </group>
  );
}

/** Eslabón que une dos nodos del supercúmulo, para insinuar la red cósmica. */
function Filament({ a, b, opacity }: { a: THREE.Vector3; b: THREE.Vector3; opacity: number }) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints([a, b]);
    const material = new THREE.LineBasicMaterial({ color: "#2f7fa8", transparent: true, opacity: 0.35 });
    return new THREE.Line(geometry, material);
  }, [a, b]);

  useEffect(() => {
    (line.material as THREE.LineBasicMaterial).opacity = 0.35 * opacity;
  }, [line, opacity]);

  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );

  return <primitive object={line} />;
}

/**
 * Cúmulo de Virgo: ~1 300 galaxias a 16,5 Mpc, con el núcleo de ~2,2 Mpc.
 *
 * Los miembros con nombre (M87, M49, M86…) van en sus coordenadas J2000 y el
 * resto son puntos de relleno repartidos en el elipsoide del núcleo, más denso
 * hacia M87: dibujar 1 300 galaxias una a una no aporta y cuesta GPU.
 */
function VirgoStage({ opacity }: { opacity: number }) {
  const glow = useMemo(() => galaxySpriteTexture("rgba(255,232,190,0.55)"), []);
  const MPC_UNITS = 2.4;

  const named = useMemo(() => {
    const center = equatorialToCartesian(VIRGO_CENTER.ra, VIRGO_CENTER.dec, VIRGO_CENTER.mpc);
    return VIRGO_MEMBERS.map((member) => {
      const point = equatorialToCartesian(member.ra, member.dec, VIRGO_CENTER.mpc);
      return {
        name: member.name,
        position: new THREE.Vector3(
          (point[0] - center[0]) * MPC_UNITS,
          (point[1] - center[1]) * MPC_UNITS,
          (point[2] - center[2]) * MPC_UNITS,
        ),
      };
    });
  }, []);

  const field = useMemo(() => {
    const count = 260;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      // Elipsoide con más peso en el plano del cúmulo.
      const r = Math.cbrt(Math.random()) * 1.05;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) * 0.6;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  return (
    <group visible={opacity > 0.01}>
      <points geometry={field}>
        <pointsMaterial
          size={0.05}
          sizeAttenuation
          transparent
          color="#ffe8c0"
          opacity={0.5 * opacity}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {named.map((member) => (
        <sprite key={member.name} position={member.position} scale={[0.85, 0.85, 1]}>
          <spriteMaterial
            map={glow}
            transparent
            opacity={0.75 * opacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      ))}
    </group>
  );
}

/**
 * Supercúmulo de Virgo y Laniakea: los cúmulos a su distancia real (53,8 Mal
 * Virgo, 62 Fornax, 160 Centaurus, 220 el Gran Atractor, 321 Coma) unidos por
 * filamentos. Es el peldaño que faltaba entre el Grupo Local y el universo.
 */
function SuperclusterStage({ opacity }: { opacity: number }) {
  const glow = useMemo(() => galaxySpriteTexture("rgba(255,226,180,0.5)"), []);
  /** 1 Mal de escena: Coma, el nodo más lejano, cae a 6,4 unidades. */
  const NODE_UNITS = 0.02;

  const nodes = useMemo(
    () =>
      SUPERCLUSTER_NODES.map((node) => ({
        ...node,
        position: new THREE.Vector3(
          ...(equatorialToCartesian(node.ra, node.dec, node.mly * NODE_UNITS) as [number, number, number]),
        ),
      })),
    [],
  );

  // La red se dibuja desde Virgo (el nodo que da nombre al supercúmulo) hacia el
  // resto; es la forma en que se suele representar el flujo de Laniakea.
  const hub = nodes.find((node) => node.name === "Virgo") ?? nodes[0];

  return (
    <group visible={opacity > 0.01}>
      {nodes
        .filter((node) => node !== hub)
        .map((node) => (
          <Filament key={`link-${node.name}`} a={hub.position} b={node.position} opacity={opacity} />
        ))}
      {nodes.map((node) => (
        <sprite
          key={node.name}
          position={node.position}
          scale={[node.size, node.size, 1]}
        >
          <spriteMaterial
            map={glow}
            color={node.tint}
            transparent
            opacity={0.8 * opacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      ))}
    </group>
  );
}

/** Observable universe as a cosmic web: filaments of clusters in a sphere. */
function UniverseStage({ opacity }: { opacity: number }) {
  const geometry = useMemo(() => {
    const filaments = 190;
    const perFilament = 260;
    const count = filaments * perFilament;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const warm = new THREE.Color("#ffe0a8");
    const cool = new THREE.Color("#9ec8ff");
    let cursor = 0;
    const randomPointInSphere = (radius: number) => {
      const u = Math.random();
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * Math.cbrt(u);
      return new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta),
      );
    };
    for (let f = 0; f < filaments; f += 1) {
      const start = randomPointInSphere(9);
      const end = randomPointInSphere(9);
      for (let i = 0; i < perFilament; i += 1) {
        const t = i / perFilament;
        const x = start.x + (end.x - start.x) * t + (Math.random() - 0.5) * 0.55;
        const y = start.y + (end.y - start.y) * t + (Math.random() - 0.5) * 0.55;
        const z = start.z + (end.z - start.z) * t + (Math.random() - 0.5) * 0.55;
        const color = warm.clone().lerp(cool, Math.random());
        positions[cursor * 3] = x;
        positions[cursor * 3 + 1] = y;
        positions[cursor * 3 + 2] = z;
        colors[cursor * 3] = color.r;
        colors[cursor * 3 + 1] = color.g;
        colors[cursor * 3 + 2] = color.b;
        cursor += 1;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);

  return (
    <group visible={opacity > 0.01}>
      <points geometry={geometry}>
        <pointsMaterial
          size={0.06}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.75 * opacity}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

// ---------------------------------------------------------------- scene

function CosmicScene({
  scale,
  drag,
  solarStates,
}: {
  scale: number;
  drag: React.MutableRefObject<{ x: number; y: number }>;
  solarStates: PlanetState[];
}) {
  const root = useRef<THREE.Group>(null);
  const glow = useMemo(() => radialTexture(), []);
  useFrame((_, delta) => {
    if (!root.current) return;
    root.current.rotation.y += delta * 0.02;
    root.current.rotation.x += (drag.current.y - root.current.rotation.x) * 0.06;
    root.current.rotation.z += (drag.current.x * 0.4 - root.current.rotation.z) * 0.04;
  });

  const op = (id: string) => {
    const stage = STAGES.find((s) => s.id === id)!;
    return stageOpacity(scale, stage);
  };

  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[5, 3, 5]} intensity={1.4} />
      <Stars radius={120} depth={60} count={5000} factor={4} saturation={0} fade speed={0.4} />
      <group ref={root}>
        <EarthStage opacity={op("earth")} />
        <CislunarStage opacity={op("cislunar")} />
        <SolarStage opacity={op("solar")} glow={glow} states={solarStates} />
        <OortStage opacity={op("oort")} />
        <NeighborhoodStage opacity={op("neighborhood")} />
        <GalaxyStage opacity={op("milkyway")} />
        <LocalGroupStage opacity={op("localgroup")} />
        <VirgoStage opacity={op("virgo")} />
        <SuperclusterStage opacity={op("supercluster")} />
        <UniverseStage opacity={op("universe")} />
      </group>
    </>
  );
}

// ---------------------------------------------------------------- shell

interface CosmicZoomProps {
  /** log10(metres) to start at — seeded from the globe altitude so it is seamless. */
  initialScale?: number;
  onExit: () => void;
}

export function CosmicZoom({ initialScale = EARTH_SCALE + 1.2, onExit }: CosmicZoomProps) {
  const [scale, setScale] = useState(() => Math.min(SCALE_MAX, Math.max(SCALE_MIN, initialScale)));
  // Efemérides al abrir el overlay: la posición es la de este instante, no una
  // animación, así que se calcula una vez y se dice la fecha en el panel.
  const solarStates = useMemo(() => solarSystemState(new Date()), []);
  const solarDateLabel = useMemo(
    () =>
      new Date().toLocaleString("es-ES", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
        timeZone: "UTC",
      }) + " UTC",
    [],
  );
  const [entered, setEntered] = useState(false);
  const drag = useRef({ x: 0, y: 0 });
  const dragging = useRef<{ active: boolean; x: number; y: number } | null>(null);
  const pinch = useRef<number | null>(null);
  const format = useCallback((value: number) => formatScale(value), []);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Wheel / keys own the zoom while the overlay is up.
  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setScale((current) => {
        const next = Math.min(SCALE_MAX, Math.max(SCALE_MIN, current + event.deltaY * 0.0016));
        if (next <= SCALE_MIN + 0.02) onExit();
        return next;
      });
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onExit();
      if (event.key === "ArrowDown" || event.key === "PageDown") {
        setScale((current) => Math.min(SCALE_MAX, current + COSMIC_STEP));
      }
      if (event.key === "ArrowUp" || event.key === "PageUp") setScale((current) => Math.max(SCALE_MIN, current - COSMIC_STEP));
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, [onExit]);

  const onPointerDown = (event: React.PointerEvent) => {
    dragging.current = { active: true, x: event.clientX, y: event.clientY };
  };
  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragging.current?.active) return;
    const dx = (event.clientX - dragging.current.x) / window.innerWidth;
    const dy = (event.clientY - dragging.current.y) / window.innerHeight;
    drag.current = { x: Math.max(-1, Math.min(1, drag.current.x + dx * 2)), y: Math.max(-0.9, Math.min(0.9, drag.current.y + dy * 2)) };
  };
  const onPointerUp = () => {
    dragging.current = null;
  };

  const onTouchMove = (event: React.TouchEvent) => {
    if (event.touches.length !== 2) return;
    const [a, b] = [event.touches[0], event.touches[1]];
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (pinch.current !== null) {
      const delta = (pinch.current - distance) * 0.004;
      setScale((current) => Math.min(SCALE_MAX, Math.max(SCALE_MIN, current + delta)));
    }
    pinch.current = distance;
  };

  const activeStage = [...STAGES].reverse().find((stage) => scale >= stage.from) ?? STAGES[0];
  const stageFacts = STAGE_FACTS[activeStage.id];
  const exponent = Math.floor(scale);
  const progress = (scale - SCALE_MIN) / (SCALE_MAX - SCALE_MIN);
  const canZoomOut = nextCosmicScale(scale, "out") !== null;

  /**
   * Mismo salto que las flechas del teclado. Al llegar al suelo del rango el
   * acercamiento devuelve al globo, igual que hace la rueda, en vez de quedarse
   * pulsando un botón que no puede seguir.
   */
  const step = (direction: CosmicDirection) => {
    const next = nextCosmicScale(scale, direction);
    if (next === null) {
      if (direction === "in") onExit();
      return;
    }
    if (direction === "in" && next <= SCALE_MIN + 0.02) {
      onExit();
      return;
    }
    setScale(next);
  };

  return (
    <div
      className={`absolute inset-0 z-40 cursor-grab bg-black transition-opacity duration-700 ${entered ? "opacity-100" : "opacity-0"}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onTouchMove={onTouchMove}
      onTouchEnd={() => { pinch.current = null; }}
      role="application"
      aria-label="Zoom cósmico: de la Tierra a la nube de Oort, el vecindario solar, la Vía Láctea, el Grupo Local, Virgo y el universo observable"
    >
      <Canvas
        camera={{ position: [0, 1.2, 9], fov: 50 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
        fallback={<div className="flex h-full items-center justify-center text-[11px] uppercase text-primary/70">WebGL no disponible en este dispositivo</div>}
      >
        <CosmicScene scale={scale} drag={drag} solarStates={solarStates} />
      </Canvas>

      {/* Scale ladder */}
      {/* La barra mide el rango completo del overlay, no la ventana de cada
          escena: con diez peldaños, etiquetar por `from` deja todos los saltos
          equidistantes en log10, que es la única forma de que se puedan leer. */}
      <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 md:left-6">
        <div className="relative h-[46vh] w-px bg-gradient-to-b from-transparent via-primary/30 to-transparent">
          <div
            className="absolute -left-1 h-2 w-2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_12px_#00FF41]"
            style={{ top: `${(1 - progress) * 100}%` }}
          />
          {STAGES.map((stage) => {
            const top = (1 - (stage.from - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
            const isActive = stage.id === activeStage.id;
            return (
              <div key={stage.id} className="absolute -translate-y-1/2" style={{ top: `${top}%` }}>
                <div className={`h-px ${isActive ? "w-4 bg-primary" : "w-2 bg-primary/30"}`} />
                <span
                  className={`absolute left-5 top-1/2 -translate-y-1/2 whitespace-nowrap text-[9px] uppercase tracking-[0.18em] ${
                    isActive ? "text-primary" : "text-primary/35"
                  }`}
                >
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Readout */}
      <div className="pointer-events-none absolute bottom-4 left-3 right-3 flex items-end justify-between gap-3 md:bottom-6 md:left-6 md:right-6">
        <div className="rounded-sm border border-primary/25 bg-black/60 px-3 py-2 backdrop-blur-md">
          <div className="text-[9px] uppercase tracking-[0.22em] text-primary/70">Escala</div>
          <div className="font-mono text-lg text-primary md:text-2xl">{format(scale)}</div>
          <div className="font-mono text-[10px] text-primary/50">10^{exponent} m</div>
        </div>
        <div className="hidden max-w-[46ch] rounded-sm border border-border/40 bg-black/60 px-3 py-2 text-right backdrop-blur-md sm:block">
          <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/90">{activeStage.label}</div>
          <div className="text-[10px] text-muted-foreground">{activeStage.caption}</div>
        </div>
      </div>

      {/*
        Panel de datos del peldaño. En el sistema solar son las efemérides del
        JPL; en el resto, las cifras publicadas de cada objeto (distancias,
        tamaños, número de galaxias) para que lo dibujado se pueda contrastar.
      */}
      {stageFacts && (
        <div className="pointer-events-none absolute right-3 top-16 w-[15rem] rounded-sm border border-primary/25 bg-black/65 p-2 backdrop-blur-md md:right-6 md:top-20">
          <div className="mb-1 text-[8px] uppercase tracking-[0.18em] text-primary/70">
            {stageFacts.title}
          </div>
          <ul className="space-y-0.5">
            {stageFacts.rows.map((row) => (
              <li
                key={row.label}
                className="flex items-baseline justify-between gap-2 font-mono text-[9px] text-primary/85"
              >
                <span className="text-primary/55">{row.label}</span>
                <span className="text-right">{row.value}</span>
              </li>
            ))}
          </ul>
          {stageFacts.note && (
            <p className="mt-1 text-[7px] leading-relaxed text-primary/40">{stageFacts.note}</p>
          )}
        </div>
      )}

      {/*
        Datos reales del sistema solar. Las distancias son las de la fecha de
        apertura y salen de los elementos del JPL; el diámetro va al lado para
        que se vea que el tamaño dibujado es simbólico y no una mentira oculta.
      */}
      {activeStage.id === "solar" && (
        <div className="pointer-events-none absolute right-3 top-16 w-[15rem] rounded-sm border border-primary/25 bg-black/65 p-2 backdrop-blur-md md:right-6 md:top-20">
          <div className="mb-1 text-[8px] uppercase tracking-[0.18em] text-primary/70">
            Sistema solar · {solarDateLabel}
          </div>
          <ul className="space-y-0.5">
            {solarStates.map((state) => (
              <li
                key={state.id}
                className="flex items-baseline justify-between gap-2 font-mono text-[9px] text-primary/85"
              >
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: state.color }} />
                  {state.name}
                </span>
                <span className="text-primary/60">
                  {state.au.toFixed(2)} UA
                  <span className="ml-1 text-primary/35"> · {Math.round(auToMillionKm(state.au))} M km</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[7px] leading-relaxed text-primary/40">
            Distancias a escala real · tamaños simbólicos · posición con elementos del JPL (proyección sobre la eclíptica)
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="absolute right-3 top-3 flex items-center gap-1.5 md:right-6 md:top-6">
        <div className="hidden items-center gap-2 rounded-sm border border-border/40 bg-black/60 px-2.5 py-1.5 text-[9px] uppercase tracking-[0.16em] text-muted-foreground backdrop-blur-md sm:flex">
          <MousePointer2 className="h-3 w-3 text-primary" /> rueda para alejar · arrastra para orbitar
        </div>
        <button
          onClick={onExit}
          className="flex h-8 items-center gap-1.5 rounded-sm border border-primary/30 bg-black/60 px-2.5 text-[9px] uppercase tracking-[0.16em] text-primary backdrop-blur-md transition-colors hover:bg-primary/15"
          aria-label="Volver al globo"
        >
          <X className="h-3.5 w-3.5" /> Volver al globo
        </button>
      </div>

      {/* Zoom por botones: mismo gesto que en la barra de escala del globo, para
          que el overlay no dependa de la rueda ni del trackpad. */}
      <div className="absolute inset-x-0 bottom-24 flex justify-center gap-2 md:bottom-28">
        <button
          type="button"
          onClick={() => step("out")}
          onPointerDown={(event) => event.stopPropagation()}
          disabled={!canZoomOut}
          aria-label="Alejar"
          title={`Alejar · hasta ${formatScale(SCALE_MAX)}`}
          className="flex items-center gap-1 rounded-sm border border-primary/30 bg-black/60 px-2 py-1 text-[8px] uppercase tracking-[0.16em] text-primary backdrop-blur-md transition-colors hover:bg-primary/15 disabled:cursor-default disabled:border-border/20 disabled:text-primary/25"
        >
          <ArrowDown className="h-3 w-3" aria-hidden="true" /> alejar
        </button>
        <button
          type="button"
          onClick={() => step("in")}
          onPointerDown={(event) => event.stopPropagation()}
          aria-label="Acercar"
          title={`Acercar · al llegar a ${formatScale(SCALE_MIN)} vuelve al globo`}
          className="flex items-center gap-1 rounded-sm border border-primary/30 bg-black/60 px-2 py-1 text-[8px] uppercase tracking-[0.16em] text-primary backdrop-blur-md transition-colors hover:bg-primary/15"
        >
          <ArrowUp className="h-3 w-3" aria-hidden="true" /> acercar
        </button>
      </div>
    </div>
  );
}
