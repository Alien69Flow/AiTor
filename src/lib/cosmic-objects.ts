/**
 * Catálogos reales del zoom cósmico.
 *
 * Todo lo que se dibuja más allá del sistema solar eran antes posiciones
 * inventadas a ojo: cinco manchas para el Grupo Local y una esfera de puntos con
 * pinta de tela de araña para el universo. Aquí van las coordenadas y las
 * distancias publicadas (J2000) para que cada escalón enseñe lo que hay de
 * verdad: las estrellas del vecindario solar con Próxima a 4,24 al, las galaxias
 * del Grupo Local con Andrómeda a 2,54 Mal, el cúmulo de Virgo a 16,5 Mpc y los
 * nodos del supercúmulo hasta Coma.
 *
 * Puro y sin three.js a propósito: se puede comprobar con un script que Próxima
 * cae a 4,24 al del origen y que Virgo está 20 veces más lejos que Andrómeda.
 */

/** Año luz en metros. */
export const LIGHT_YEAR_M = 9.4607304725808e15;
/** Megaparsec en millones de años luz (3,2616 Mal). */
export const MPC_IN_MLY = 3.2616;

/**
 * Coordenadas ecuatoriales → vector tridimensional.
 *
 * Equivalente a lo que hace cualquier atlas estelar: ascensión recta y
 * declinación son dos ángulos, la distancia es el radio. Se devuelve con el eje
 * Y hacia el polo norte celeste para que la escena gire alrededor del eje
 * correcto.
 */
export function equatorialToCartesian(
  raHours: number,
  decDegrees: number,
  distance: number,
): [number, number, number] {
  const ra = (raHours / 24) * Math.PI * 2;
  const dec = (decDegrees * Math.PI) / 180;
  const x = distance * Math.cos(dec) * Math.cos(ra);
  const z = distance * Math.cos(dec) * Math.sin(ra);
  const y = distance * Math.sin(dec);
  return [x, y, z];
}

export interface LocalStar {
  name: string;
  /** Ascensión recta J2000 en horas. */
  ra: number;
  /** Declinación J2000 en grados. */
  dec: number;
  /** Distancia en años luz (Gaia/ Hipparcos). */
  ly: number;
  color: string;
}

/**
 * Estrellas a menos de 17 al del Sol. Las distancias son las publicadas por
 * Gaia DR3 / Hipparcos; las de tipo M dominan el vecindario, que es justo lo
 * que hace que el cielo nocturno no se parezca a un póster de constelaciones.
 */
export const LOCAL_STARS: LocalStar[] = [
  { name: "Próxima Centauri", ra: 14.4959, dec: -62.6795, ly: 4.246, color: "#ff7a5c" },
  { name: "Alfa Centauri A/B", ra: 14.6601, dec: -60.834, ly: 4.37, color: "#ffe0b0" },
  { name: "Estrella de Barnard", ra: 17.9633, dec: 4.6933, ly: 5.96, color: "#ff8f6e" },
  { name: "Wolf 359", ra: 10.9439, dec: 7.0144, ly: 7.86, color: "#ff6f58" },
  { name: "Lalande 21185", ra: 11.0564, dec: 35.97, ly: 8.31, color: "#ffa47c" },
  { name: "Sirio A/B", ra: 6.7525, dec: -16.7161, ly: 8.6, color: "#d8ebff" },
  { name: "Luyten 726-8", ra: 1.6472, dec: -17.95, ly: 8.73, color: "#ff7a60" },
  { name: "Ross 154", ra: 18.8311, dec: -23.8361, ly: 9.7, color: "#ff8f70" },
  { name: "Ross 248", ra: 23.6997, dec: 44.1775, ly: 10.3, color: "#ff8064" },
  { name: "Épsilon Eridani", ra: 3.5483, dec: -9.4581, ly: 10.5, color: "#ffd39c" },
  { name: "Lacaille 9352", ra: 23.095, dec: -35.8531, ly: 10.74, color: "#ff9c80" },
  { name: "Ross 128", ra: 11.7989, dec: 0.8047, ly: 11.0, color: "#ff8a72" },
  { name: "EZ Aquarii", ra: 22.645, dec: -15.3031, ly: 11.1, color: "#ff7760" },
  { name: "61 Cygni A/B", ra: 21.1147, dec: 38.7494, ly: 11.4, color: "#ffb28a" },
  { name: "Prócyon A/B", ra: 7.6551, dec: 5.225, ly: 11.46, color: "#eaf2ff" },
  { name: "Groombridge 34", ra: 0.3247, dec: 44.0225, ly: 11.62, color: "#ff8f76" },
  { name: "Tau Ceti", ra: 1.7343, dec: -15.9375, ly: 11.9, color: "#ffd7a8" },
  { name: "Gliese 1061", ra: 3.6025, dec: -44.5125, ly: 11.98, color: "#ff8f70" },
  { name: "Estrella de Teegarden", ra: 2.8922, dec: 16.8797, ly: 12.5, color: "#ff8a70" },
  { name: "Estrella de Kapteyn", ra: 5.1978, dec: -44.9994, ly: 12.83, color: "#ffa88a" },
  { name: "Kruger 60", ra: 22.4667, dec: 57.7, ly: 13.08, color: "#ff9478" },
  { name: "Estrella de Van Maanen", ra: 0.8192, dec: 5.3931, ly: 14.07, color: "#ffdcc4" },
  { name: "Gliese 1", ra: 0.0917, dec: -37.3589, ly: 14.22, color: "#ff8a72" },
  { name: "Gliese 687", ra: 17.6067, dec: 68.3381, ly: 14.79, color: "#ff8068" },
  { name: "Altair", ra: 19.8464, dec: 8.8681, ly: 16.73, color: "#e8f1ff" },
];

export interface LocalGroupGalaxy {
  name: string;
  ra: number;
  dec: number;
  /** Distancia en millones de años luz. */
  mly: number;
  /** Diámetro en miles de años luz, para escalar el sprite. */
  kly: number;
  tint: string;
}

/** Grupo Local: todo lo que está gravitacionalmente atado a nosotros (~10 Mal). */
export const LOCAL_GROUP: LocalGroupGalaxy[] = [
  { name: "Vía Láctea", ra: 0, dec: 0, mly: 0, kly: 100, tint: "rgba(226,240,255,0.6)" },
  { name: "Andrómeda (M31)", ra: 0.7123, dec: 41.269, mly: 2.537, kly: 220, tint: "rgba(240,225,255,0.55)" },
  { name: "Triángulo (M33)", ra: 1.5642, dec: 30.66, mly: 2.73, kly: 60, tint: "rgba(215,240,255,0.5)" },
  { name: "M32", ra: 0.7127, dec: 40.8653, mly: 2.49, kly: 6.5, tint: "rgba(255,235,215,0.45)" },
  { name: "NGC 6822 (Barnard)", ra: 19.7492, dec: -14.8031, mly: 1.63, kly: 7, tint: "rgba(255,240,220,0.45)" },
  { name: "IC 10", ra: 0.3392, dec: 59.3031, mly: 2.2, kly: 5, tint: "rgba(235,245,255,0.4)" },
  { name: "Leo A", ra: 9.9858, dec: 30.7447, mly: 2.6, kly: 5, tint: "rgba(225,240,255,0.4)" },
  { name: "Nube Mayor de Magallanes", ra: 5.3925, dec: -69.756, mly: 0.163, kly: 14, tint: "rgba(240,235,255,0.5)" },
  { name: "Nube Menor de Magallanes", ra: 0.8771, dec: -72.829, mly: 0.2, kly: 7, tint: "rgba(235,240,255,0.45)" },
  { name: "Enana de Sagitario", ra: 18.9167, dec: -30.5, mly: 0.07, kly: 10, tint: "rgba(255,235,220,0.35)" },
];

/** Centro del cúmulo de Virgo (Virgo A / M87). */
export const VIRGO_CENTER = { ra: 12.5137, dec: 12.391, mpc: 16.5 };

/** Miembros nombrados del cúmulo, con sus coordenadas reales. */
export const VIRGO_MEMBERS: { name: string; ra: number; dec: number }[] = [
  { name: "M87 (Virgo A)", ra: 12.5137, dec: 12.391 },
  { name: "M49", ra: 12.4967, dec: 8.0003 },
  { name: "M86", ra: 12.4362, dec: 12.9462 },
  { name: "M84", ra: 12.4367, dec: 12.8876 },
  { name: "M60", ra: 12.7275, dec: 11.5526 },
  { name: "M59", ra: 12.7, dec: 11.6467 },
  { name: "M89", ra: 12.5942, dec: 12.5561 },
  { name: "M90", ra: 12.6136, dec: 13.1628 },
  { name: "NGC 4526", ra: 12.5683, dec: 7.7 },
  { name: "NGC 4365", ra: 12.4053, dec: 7.3172 },
];

export interface ClusterNode {
  name: string;
  ra: number;
  dec: number;
  /** Distancia en millones de años luz. */
  mly: number;
  /** Tamaño relativo para el sprite. */
  size: number;
  tint: string;
}

/**
 * Nodos del supercúmulo de Virgo y de su entorno inmediato (Laniakea). Las
 * distancias son las publicadas para cada cúmulo: Fornax 62 Mal, Centaurus
 * 160 Mal, el Gran Atractor ~220 Mal y Coma 321 Mal, ya fuera de Laniakea.
 */
export const SUPERCLUSTER_NODES: ClusterNode[] = [
  { name: "Grupo Local", ra: 0, dec: 0, mly: 0, size: 2.2, tint: "rgba(200,225,255,0.45)" },
  { name: "Virgo", ra: 12.5137, dec: 12.391, mly: 53.8, size: 3.6, tint: "rgba(255,236,190,0.6)" },
  { name: "Fornax", ra: 3.6333, dec: -35.45, mly: 62, size: 2.4, tint: "rgba(255,225,200,0.5)" },
  { name: "Eridanus", ra: 3.5, dec: -21, mly: 75, size: 2.0, tint: "rgba(230,235,255,0.45)" },
  { name: "Centaurus", ra: 12.8, dec: -41, mly: 160, size: 3.0, tint: "rgba(255,230,210,0.5)" },
  { name: "Gran Atractor", ra: 16.5, dec: -60, mly: 220, size: 3.2, tint: "rgba(255,214,170,0.45)" },
  { name: "Coma", ra: 12.9833, dec: 27.95, mly: 321, size: 2.6, tint: "rgba(215,232,255,0.4)" },
];

export interface StageFact {
  title: string;
  rows: { label: string; value: string }[];
  note?: string;
}

/**
 * Panel de datos por escalón: la cifra que hace verificable lo que se ve.
 * Sólo los peldaños que no tenían panel propio (el sistema solar ya lo tiene
 * con las efemérides del JPL).
 */
export const STAGE_FACTS: Record<string, StageFact> = {
  oort: {
    title: "Nube de Oort",
    rows: [
      { label: "Borde interior", value: "2 000 UA · 0,03 al" },
      { label: "Borde exterior", value: "100 000 UA · 1,58 al" },
      { label: "Cuerpos estimados", value: "10¹¹–10¹² cometas" },
      { label: "Origen", value: "eyección del disco joven" },
    ],
    note: "La sonda más lejana (Voyager 1) está a 167 UA: aún dentro del sistema solar.",
  },
  neighborhood: {
    title: "Vecindario solar · brazo de Orión",
    rows: [
      { label: "Estrella más cercana", value: "Próxima Centauri · 4,24 al" },
      { label: "Sistema doble más cercano", value: "Alfa Centauri · 4,37 al" },
      { label: "Estrella más brillante", value: "Sirio · 8,60 al · −1,46 mag" },
      { label: "Densidad local", value: "~0,004 estrellas / al³" },
      { label: "Brazo", value: "Orión–Cygnus · ~10 000 al de largo" },
    ],
    note: "Posiciones reales (J2000) en escala lineal: 1 unidad de escena = 1 año luz.",
  },
  localgroup: {
    title: "Grupo Local",
    rows: [
      { label: "Miembros", value: "> 80 galaxias conocidas" },
      { label: "Diámetro", value: "~10 Mal" },
      { label: "Andrómeda (M31)", value: "2,54 Mal · 220 kal de diámetro" },
      { label: "Triángulo (M33)", value: "2,73 Mal" },
      { label: "Nubes de Magallanes", value: "163 y 200 kal" },
      { label: "Destino", value: "M31 y Vía Láctea se fusionarán" },
    ],
    note: "Distancias reales; el tamaño de cada sprite es proporcional a su diámetro.",
  },
  virgo: {
    title: "Cúmulo de Virgo",
    rows: [
      { label: "Distancia", value: "16,5 Mpc · 53,8 Mal" },
      { label: "Galaxias", value: "~1 300" },
      { label: "Diámetro del núcleo", value: "~2,2 Mpc" },
      { label: "Galaxia dominante", value: "M87 · agujero negro de 6,5 × 10⁹ M☉" },
      { label: "Centro del supercúmulo", value: "El Grupo Local está en el borde" },
    ],
    note: "Miembros nombrados colocados con sus coordenadas J2000 reales.",
  },
  supercluster: {
    title: "Supercúmulo de Virgo · Laniakea",
    rows: [
      { label: "Supercúmulo de Virgo", value: "110 Mal · 33 Mpc" },
      { label: "Laniakea", value: "520 Mal · 160 Mpc" },
      { label: "Fornax", value: "62 Mal" },
      { label: "Gran Atractor", value: "~220 Mal · norma del cúmulo" },
      { label: "Coma", value: "321 Mal · fuera de Laniakea" },
    ],
    note: "Los nodos se dibujan a su distancia real; las líneas sólo sugieren la red.",
  },
  universe: {
    title: "Universo observable",
    rows: [
      { label: "Diámetro", value: "93 000 Mal · 28,5 Gpc" },
      { label: "Radio (horizonte)", value: "46 500 Mal" },
      { label: "Edad", value: "13 787 Ma" },
      { label: "Galaxias estimadas", value: "~2 × 10¹²" },
    ],
    note: "El borde es el horizonte de luz, no el final del universo.",
  },
};
