/**
 * Sistema solar real: elementos orbitales keplerianos del JPL y geometría a
 * escala, para que el zoom cósmico enseñe dónde están los planetas **hoy** y a
 * qué distancia, no ocho bolas girando a un ritmo inventado.
 *
 * Los elementos son los de la tabla «Keplerian elements for approximate
 * positions of the major planets» del JPL (válidos 1800-2050): semieje mayor,
 * excentricidad y longitud media con su tasa por siglo juliano. Con eso la
 * longitud heliocéntrica sale con error de minutos de arco, que para un orrery
 * es de sobra. Se ignora la inclinación: el dibujo es la proyección sobre la
 * eclíptica, y decirlo es parte de ser honesto con lo que se enseña.
 *
 * Escalas: las **distancias son reales** (1 unidad de escena = `AU_PER_UNIT`
 * AU); los **tamaños son simbólicos** porque a esa escala la Tierra mediría
 * 4·10⁻⁵ UA, es decir, un píxel de menos. El radio dibujado conserva el orden
 * real entre planetas y el panel dice el diámetro verdadero al lado.
 */

/** Unidad astronómica en metros (IAU 2012). */
export const AU_M = 1.495978707e11;
/** Unidad astronómica en kilómetros. */
export const AU_KM = AU_M / 1000;
/** Días por siglo juliano. */
const DAYS_PER_CENTURY = 36525;
/** Época J2000.0 en días julianos. */
const J2000_JD = 2451545.0;

export interface SolarElements {
  id: string;
  name: string;
  /** Radio medio real, km (NASA planetary fact sheet). */
  radiusKm: number;
  /** Color del marcador, sin prentensión fotográfica. */
  color: string;
  /** Semieje mayor, UA. */
  semiMajorAu: number;
  /** Excentricidad. */
  eccentricity: number;
  /** Longitud media en J2000, grados. */
  meanLongitudeDeg: number;
  /** Tasa de la longitud media, grados por siglo juliano. */
  meanLongitudeRatePerCentury: number;
  /** Longitud del perihelio, grados. */
  perihelionDeg: number;
  ring?: boolean;
}

export const SUN = {
  name: "Sol",
  radiusKm: 695_700,
  color: "#ffd28a",
};

/** Los ocho planetas y Plutón, con sus elementos J2000. */
export const PLANETS: SolarElements[] = [
  {
    id: "mercury", name: "Mercurio", radiusKm: 2439.7, color: "#a89a8c",
    semiMajorAu: 0.38709893, eccentricity: 0.20563069,
    meanLongitudeDeg: 252.25084, meanLongitudeRatePerCentury: 149_472.67411175,
    perihelionDeg: 77.45645,
  },
  {
    id: "venus", name: "Venus", radiusKm: 6051.8, color: "#e6c188",
    semiMajorAu: 0.72333199, eccentricity: 0.00677323,
    meanLongitudeDeg: 181.97973, meanLongitudeRatePerCentury: 58_517.81538729,
    perihelionDeg: 131.53298,
  },
  {
    id: "earth", name: "Tierra", radiusKm: 6371.0, color: "#3f7fd0",
    semiMajorAu: 1.00000011, eccentricity: 0.01671022,
    meanLongitudeDeg: 100.46435, meanLongitudeRatePerCentury: 35_999.37314116,
    perihelionDeg: 102.94719,
  },
  {
    id: "mars", name: "Marte", radiusKm: 3389.5, color: "#c1502e",
    semiMajorAu: 1.52366231, eccentricity: 0.09341233,
    meanLongitudeDeg: 355.45332, meanLongitudeRatePerCentury: 19_140.30268499,
    perihelionDeg: 336.04084,
  },
  {
    id: "jupiter", name: "Júpiter", radiusKm: 69_911, color: "#d8b48b",
    semiMajorAu: 5.20336301, eccentricity: 0.04839266,
    meanLongitudeDeg: 34.40438, meanLongitudeRatePerCentury: 3034.74612775,
    perihelionDeg: 14.75385,
  },
  {
    id: "saturn", name: "Saturno", radiusKm: 58_232, color: "#e0cfa2",
    semiMajorAu: 9.53707032, eccentricity: 0.0541506,
    meanLongitudeDeg: 49.94432, meanLongitudeRatePerCentury: 1222.49362201,
    perihelionDeg: 92.43194, ring: true,
  },
  {
    id: "uranus", name: "Urano", radiusKm: 25_362, color: "#9fd8e0",
    semiMajorAu: 19.19126393, eccentricity: 0.04716771,
    meanLongitudeDeg: 313.23218, meanLongitudeRatePerCentury: 428.48202785,
    perihelionDeg: 170.96424,
  },
  {
    id: "neptune", name: "Neptuno", radiusKm: 24_622, color: "#4a6fd0",
    semiMajorAu: 30.06896348, eccentricity: 0.00858587,
    meanLongitudeDeg: 304.88003, meanLongitudeRatePerCentury: 218.45945325,
    perihelionDeg: 44.97135,
  },
  {
    id: "pluto", name: "Plutón", radiusKm: 1188.3, color: "#b3a99c",
    semiMajorAu: 39.48168677, eccentricity: 0.24880766,
    meanLongitudeDeg: 238.92881, meanLongitudeRatePerCentury: 145.20780515,
    perihelionDeg: 224.06676,
  },
];

/** Días julianos de una fecha. */
export function julianDay(date: Date): number {
  return date.getTime() / 86_400_000 + 2440587.5;
}

/** Siglos julianos desde J2000.0. */
export function centuriesSinceJ2000(date: Date): number {
  return (julianDay(date) - J2000_JD) / DAYS_PER_CENTURY;
}

const TWO_PI = Math.PI * 2;

/** Normaliza un ángulo a [0, 360). */
export function normaliseDegrees(value: number): number {
  const wrapped = value % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/**
 * Resuelve la ecuación de Kepler `E - e·sin E = M` por Newton-Raphson.
 * Converge en cuatro o cinco iteraciones para las excentricidades del sistema
 * solar (la mayor, Plutón, es 0,249).
 */
export function solveKepler(meanAnomalyRad: number, eccentricity: number): number {
  let eccentricAnomaly = eccentricity < 0.8 ? meanAnomalyRad : Math.PI;
  for (let i = 0; i < 8; i += 1) {
    const delta =
      (eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomalyRad) /
      (1 - eccentricity * Math.cos(eccentricAnomaly));
    eccentricAnomaly -= delta;
    if (Math.abs(delta) < 1e-12) break;
  }
  return eccentricAnomaly;
}

export interface PlanetState {
  id: string;
  name: string;
  color: string;
  /** Distancia heliocéntrica real ese día, UA. */
  au: number;
  /** Longitud heliocéntrica en la eclíptica, radianes desde el equinoccio de J2000. */
  longitudeRad: number;
  /** Radio medio real, km. */
  radiusKm: number;
  ring?: boolean;
}

/** Posición heliocéntrica de un planeta en una fecha. */
export function planetState(planet: SolarElements, date: Date): PlanetState {
  const centuries = centuriesSinceJ2000(date);
  const meanLongitude = planet.meanLongitudeDeg + planet.meanLongitudeRatePerCentury * centuries;
  const meanAnomalyDeg = normaliseDegrees(meanLongitude - planet.perihelionDeg);
  const meanAnomaly = (meanAnomalyDeg * Math.PI) / 180;
  const eccentricAnomaly = solveKepler(meanAnomaly, planet.eccentricity);

  const trueAnomaly = Math.atan2(
    Math.sqrt(1 - planet.eccentricity ** 2) * Math.sin(eccentricAnomaly),
    Math.cos(eccentricAnomaly) - planet.eccentricity,
  );
  const radiusAu = planet.semiMajorAu * (1 - planet.eccentricity * Math.cos(eccentricAnomaly));
  const longitude = trueAnomaly + (planet.perihelionDeg * Math.PI) / 180;

  return {
    id: planet.id,
    name: planet.name,
    color: planet.color,
    au: radiusAu,
    longitudeRad: ((longitude % TWO_PI) + TWO_PI) % TWO_PI,
    radiusKm: planet.radiusKm,
    ring: planet.ring,
  };
}

/** Estado de todos los planetas en una fecha. */
export function solarSystemState(date: Date = new Date()): PlanetState[] {
  return PLANETS.map((planet) => planetState(planet, date));
}

/** Unidades de escena por AU: Neptuno (30 UA) cae en 9 unidades. */
export const AU_PER_UNIT = 30 / 9;

/** Posición en el plano de la eclíptica, en unidades de escena. */
export function scenePosition(state: PlanetState): { x: number; z: number } {
  const radius = state.au / AU_PER_UNIT;
  return {
    x: Math.cos(state.longitudeRad) * radius,
    z: -Math.sin(state.longitudeRad) * radius,
  };
}

/**
 * Radio dibujado. Es simbólico —a escala real no se vería— pero conserva el
 * orden de tamaño real entre planetas mediante una raíz: Júpiter queda cinco
 * veces más grande que la Tierra, no once, porque once lo sacaría de la escena.
 */
export function displayRadius(radiusKm: number): number {
  const ratio = Math.max(0.05, radiusKm / 6371);
  return Math.min(0.4, Math.max(0.014, 0.03 * ratio ** 0.7));
}

/**
 * Órbita completa como polilínea en unidades de escena. Se calcula con la misma
 * ecuación de Kepler, así que las elipses salen con su excentricidad y con el
 * perihelio en su sitio: Mercurio y Plutón no parecen círculos.
 */
export function orbitPath(planet: SolarElements, samples = 180): [number, number][] {
  const points: [number, number][] = [];
  const { eccentricity, semiMajorAu, perihelionDeg } = planet;
  for (let i = 0; i <= samples; i += 1) {
    const eccentricAnomaly = (i / samples) * TWO_PI;
    const radiusAu = semiMajorAu * (1 - eccentricity * Math.cos(eccentricAnomaly));
    const trueAnomaly = Math.atan2(
      Math.sqrt(1 - eccentricity ** 2) * Math.sin(eccentricAnomaly),
      Math.cos(eccentricAnomaly) - eccentricity,
    );
    const longitude = trueAnomaly + (perihelionDeg * Math.PI) / 180;
    const radius = radiusAu / AU_PER_UNIT;
    points.push([Math.cos(longitude) * radius, -Math.sin(longitude) * radius]);
  }
  return points;
}

/** Distancia real en millones de km, para el panel. */
export function auToMillionKm(au: number): number {
  return (au * AU_KM) / 1_000_000;
}
