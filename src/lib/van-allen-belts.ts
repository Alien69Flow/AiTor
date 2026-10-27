/**
 * Geometría de los cinturones de Van Allen, para poder dibujarlos y probarlos
 * sin abrir Cesium.
 *
 * Los cinturones son dos toroides de partículas atrapadas por el campo
 * magnético. Su forma real es la de un dipolo terrestre: no giran con el
 * ecuador geográfico, sino con el ecuador **magnético**, que está inclinado
 * unos 9,4° respecto al eje de rotación (el polo geomagnético está a 80,65° N,
 * esa es su colatitud) y desplazado del centro. Aquí se dibuja la sección de
 * cada cinturón en ese plano, que es la vista que se reconoce de todas las
 * ilustraciones y la única que se puede dibujar con medidas reales.
 *
 * El cinturón exterior (3 a 8 radios terrestres) lo mide GOES a diario: el
 * satélite está en la órbita geoestacionaria, a 6,6 R⊕, dentro de él. El
 * interior (1,2 a 2,5 R⊕) es de protones y no tiene una fuente abierta con la
 * misma cadencia, así que se dibuja con su geometría y sin intensidad propia:
 * pintarlo del color de una medida que no existe sería inventarla.
 *
 * Referencias usadas: radios 1,2–2,5 R⊕ (interior) y 3–8 R⊕ (exterior) del
 * modelo estándar de radiación; polo magnético del IGRF, 80,65° N 72,68° O.
 */

export interface RingPoint {
  /** Coordenadas en radios terrestres, sistema fijo a la Tierra (ECEF). */
  x: number;
  y: number;
  z: number;
}

export interface BeltRing {
  /** Radio del anillo, en radios terrestres. */
  radiusEarth: number;
  /** Puntos del anillo completo, en radios terrestres (ECEF). */
  points: RingPoint[];
}

export type BeltId = "inner" | "outer";

export interface BeltRange {
  id: BeltId;
  label: string;
  /** Radio interior y exterior del cinturón, en radios terrestres. */
  fromEarth: number;
  toEarth: number;
}

export const BELT_RANGES: BeltRange[] = [
  { id: "inner", label: "Cinturón interior", fromEarth: 1.2, toEarth: 2.5 },
  { id: "outer", label: "Cinturón exterior", fromEarth: 3.0, toEarth: 8.0 },
];

/** Polo norte magnético (IGRF, época 2020). */
export const MAGNETIC_POLE = { lat: 80.65, lon: -72.68 };

/** Anillos que se dibujan de cada cinturón, de dentro afuera. */
export const RING_RADII: Record<BeltId, number[]> = {
  inner: [1.5, 2.0, 2.5],
  outer: [3.5, 5.5, 8.0],
};

const DEG = Math.PI / 180;

/** Vector unitario del eje del dipolo en coordenadas fijas a la Tierra. */
export function dipoleAxis(pole = MAGNETIC_POLE): RingPoint {
  const lat = pole.lat * DEG;
  const lon = pole.lon * DEG;
  return {
    x: Math.cos(lat) * Math.cos(lon),
    y: Math.cos(lat) * Math.sin(lon),
    z: Math.sin(lat),
  };
}

/**
 * Base ortonormal del plano del ecuador magnético: `u` y `v` son perpendiculares
 * al eje del dipolo y entre sí, así que un punto `r·(u·cosθ + v·sinθ)` recorre el
 * anillo de radio `r` sobre ese plano.
 */
export function dipoleEquatorBasis(axis = dipoleAxis()): { u: RingPoint; v: RingPoint } {
  // El eje Z geográfico nunca es paralelo al eje magnético (hay ~9,5° de
  // diferencia), pero si algún día se pasara un polo imposible se degrada a un
  // plano perpendicular válido en lugar de dividir por cero.
  const reference = Math.abs(axis.z) > 0.999 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 0, z: 1 };
  const u = normalize(cross(reference, axis));
  const v = normalize(cross(axis, u));
  return { u, v };
}

export function beltRing(radiusEarth: number, samples = 120, axis = dipoleAxis()): BeltRing {
  const { u, v } = dipoleEquatorBasis(axis);
  const points: RingPoint[] = [];
  for (let i = 0; i < samples; i++) {
    const theta = (i / samples) * Math.PI * 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    points.push({
      x: radiusEarth * (u.x * cos + v.x * sin),
      y: radiusEarth * (u.y * cos + v.y * sin),
      z: radiusEarth * (u.z * cos + v.z * sin),
    });
  }
  return { radiusEarth, points };
}

/** Todos los anillos de un cinturón, de dentro afuera. */
export function beltRings(id: BeltId, samples = 120, axis = dipoleAxis()): BeltRing[] {
  return RING_RADII[id].map((radius) => beltRing(radius, samples, axis));
}

/** Radio del cinturón que corresponde a una altitud medida en radios terrestres. */
export function beltForRadius(radiusEarth: number): BeltId | null {
  const match = BELT_RANGES.find((b) => radiusEarth >= b.fromEarth && radiusEarth <= b.toEarth);
  return match?.id ?? null;
}

function cross(a: RingPoint, b: RingPoint): RingPoint {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function normalize(v: RingPoint): RingPoint {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}
