#!/usr/bin/env node
/**
 * Genera los modelos 3D de transporte que usa el globo (`public/models/*.glb`).
 *
 *   node scripts/build-transport-models.mjs
 *
 * Por qué se generan aquí y no se descargan:
 *
 *  - Los modelos de referencia (FlightAirMap, Cesium-Sandcastle, los packs de
 *    Sketchfab) tienen licencias distintas y algunos pesan más que toda la app.
 *  - Se regeneran con `npm run models:transport` y quedan versionados, así que
 *    el build no depende de la red.
 *
 * La versión anterior apilaba cajas: a 20 px se leía «algo», pero al acercarse
 * el avión era un ladrillo con un ala rectangular y el barco un prisma. Aquí se
 * modela con **lofts**: cada pieza son secciones transversales que se van
 * encogiendo o desplazando, que es como se construye un fuselaje, un ala o un
 * casco de verdad. Con eso aparecen la proa afilada, la carena del ala, la
 * flecha y el diedro.
 *
 * Convención de ejes (glTF 2.0, que es lo que Cesium espera desde 1.47):
 *   +Y arriba, +Z hacia el morro (el morro apunta a +Z), +X a la izquierda.
 * Cesium gira el modelo (+Z→+X) para que `heading = 0` mire al este, que es lo
 * mismo que hace con cualquier avión de Cesium ion.
 *
 * Formato: GLB 2.0 con un único mesh, colores por vértice (COLOR_0) y material
 * PBR neutro. Sin texturas, sin animaciones, sin nodos con transformación.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, "../public/models");

/* ------------------------------------------------------------------------- */
/* Álgebra mínima                                                             */
/* ------------------------------------------------------------------------- */

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

function normalize(v) {
  const length = Math.hypot(v[0], v[1], v[2]);
  return length < 1e-9 ? [0, 1, 0] : [v[0] / length, v[1] / length, v[2] / length];
}

const centroid = (points) => {
  const sum = points.reduce((acc, p) => add(acc, p), [0, 0, 0]);
  return scale(sum, 1 / points.length);
};

/** Normal de un polígono por la regla de Newell: vale para quads no planos. */
function polygonNormal(points) {
  const n = [0, 0, 0];
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return normalize(n);
}

/* ------------------------------------------------------------------------- */
/* Constructor de geometría                                                   */
/* ------------------------------------------------------------------------- */

/**
 * Acumula triángulos con normal plana: cada cara repite sus vértices, que es lo
 * que da el sombreado facetado del low-poly.
 *
 * Todas las primitivas reciben un punto **interior** de la pieza y orientan la
 * cara hacia fuera respecto a él. Así no hay que acertar el orden de los
 * vértices a mano en cada loft (el error clásico: media pieza iluminada al
 * revés) y las normales salen correctas aunque una sección se genere en orden
 * inverso, como al reflejar un ala.
 */
function createBuilder() {
  const positions = [];
  const normals = [];
  const colors = [];
  const indices = [];
  const colorCache = new Map();

  const rgb = (hex) => {
    if (!colorCache.has(hex)) {
      const value = hex.replace("#", "");
      colorCache.set(hex, [
        parseInt(value.slice(0, 2), 16) / 255,
        parseInt(value.slice(2, 4), 16) / 255,
        parseInt(value.slice(4, 6), 16) / 255,
      ]);
    }
    return colorCache.get(hex);
  };

  const triangle = (a, b, c, color, normal) => {
    const n = normal ?? normalize(cross(sub(b, a), sub(c, a)));
    const base = positions.length / 3;
    for (const vertex of [a, b, c]) {
      positions.push(vertex[0], vertex[1], vertex[2]);
      normals.push(n[0], n[1], n[2]);
      colors.push(...rgb(color));
    }
    indices.push(base, base + 1, base + 2);
  };

  /** Polígono convexo en abanico, orientado hacia fuera desde `inside`. */
  const face = (points, color, inside) => {
    let ring = points;
    let n = polygonNormal(ring);
    if (inside && dot(n, sub(centroid(ring), inside)) < 0) {
      ring = [...ring].reverse();
      n = scale(n, -1);
    }
    for (let i = 1; i < ring.length - 1; i += 1) {
      triangle(ring[0], ring[i], ring[i + 1], color, n);
    }
  };

  /** Caja alineada con los ejes, centro y tamaño en metros. */
  const box = (cx, cy, cz, sx, sy, sz, color) => {
    const x0 = cx - sx / 2, x1 = cx + sx / 2;
    const y0 = cy - sy / 2, y1 = cy + sy / 2;
    const z0 = cz - sz / 2, z1 = cz + sz / 2;
    const inside = [cx, cy, cz];
    face([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], color, inside);
    face([[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], color, inside);
    face([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], color, inside);
    face([[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]], color, inside);
    face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], color, inside);
    face([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], color, inside);
  };

  /**
   * Une una lista de secciones (mismo número de puntos) con quads.
   *
   * `closed: false` deja la tira abierta: sirve para una cúpula de cristal o
   * una franja de pintura, que no dan la vuelta a la sección.
   */
  const loft = (rings, color, options = {}) => {
    const closed = options.closed !== false;
    for (let r = 0; r < rings.length - 1; r += 1) {
      const from = rings[r];
      const to = rings[r + 1];
      const inside = options.inside ?? centroid([...from, ...to]);
      const segments = closed ? from.length : from.length - 1;
      for (let i = 0; i < segments; i += 1) {
        const j = (i + 1) % from.length;
        const shade = typeof color === "function" ? color(i, r, from.length) : color;
        face([from[i], from[j], to[j], to[i]], shade, inside);
      }
    }
  };

  /** Placa plana con grosor: álabes, derivas, alas del puente. */
  const plate = (corners, thickness, color) => {
    const n = normalize(polygonNormal(corners));
    const half = (thickness ?? 0.1) / 2;
    const top = corners.map((p) => add(p, scale(n, half)));
    const bottom = corners.map((p) => add(p, scale(n, -half)));
    const inside = centroid(corners);
    face(top, color, inside);
    face(bottom, color, inside);
    for (let i = 0; i < corners.length; i += 1) {
      const j = (i + 1) % corners.length;
      face([bottom[i], bottom[j], top[j], top[i]], color, inside);
    }
  };

  return { positions, normals, colors, indices, face, box, loft, plate };
}

/* ------------------------------------------------------------------------- */
/* Secciones reutilizables                                                    */
/* ------------------------------------------------------------------------- */

/** Anillo elíptico en el plano XY, listo para loft a lo largo de Z. */
function ellipseRing(z, cy, rx, ry, sides, cx = 0, phase = Math.PI / 12) {
  const points = [];
  for (let i = 0; i < sides; i += 1) {
    const angle = phase + (i * 2 * Math.PI) / sides;
    points.push([cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry, z]);
  }
  return points;
}

/** Anillo de tubo cuadrado (patines, mástiles) girado 45°. */
function tubeRing(z, cy, radius, cx = 0) {
  return [
    [cx + radius, cy, z],
    [cx, cy + radius, z],
    [cx - radius, cy, z],
    [cx, cy - radius, z],
  ];
}

/**
 * Perfil alar: seis puntos (borde de ataque, extradós, borde de salida,
 * intradós). Se loft a lo largo de X para construir el ala: cambiando `y`
 * sale el diedro y desplazando `zLE`/`zTE` sale la flecha.
 */
function airfoilRing(x, y, zLE, zTE, thickness) {
  const chord = zLE - zTE;
  return [
    [x, y, zLE],
    [x, y + thickness, zLE - 0.3 * chord],
    [x, y + 0.55 * thickness, zTE + 0.12 * chord],
    [x, y, zTE],
    [x, y - 0.55 * thickness, zTE + 0.12 * chord],
    [x, y - thickness, zLE - 0.3 * chord],
  ];
}

/** Lo mismo, pero en vertical: se loft a lo largo de Y (deriva, estabilizador vertical). */
function finRing(y, zLE, zTE, thickness) {
  const chord = zLE - zTE;
  return [
    [0, y, zLE],
    [thickness, y, zLE - 0.3 * chord],
    [0.55 * thickness, y, zTE + 0.12 * chord],
    [0, y, zTE],
    [-0.55 * thickness, y, zTE + 0.12 * chord],
    [-thickness, y, zLE - 0.3 * chord],
  ];
}

/* ------------------------------------------------------------------------- */
/* Modelos                                                                    */
/* ------------------------------------------------------------------------- */

/**
 * Avión de pasillo único: 44 m de eslora y 38 de envergadura (A320).
 *
 * Lo que hace reconocible un avión a distancia no es el detalle sino la
 * silueta: morro redondo y afilado, ala en flecha (~25°) con diedro y punta
 * afinada, motores colgados por delante del ala, deriva barrida y carenado
 * dorsal. Todo eso está aquí.
 */
function airliner() {
  const b = createBuilder();
  const body = "#eef2f7";
  const belly = "#c3ccd8";
  const stripe = "#0ea5e9";
  const wing = "#dbe3ec";
  const metal = "#64748b";
  const dark = "#0f172a";

  /** Librea en el fuselaje: blanco arriba, franja azul a la altura de la cadena, panza gris. */
  const livery = (i, _r, sides) => {
    const angle = Math.PI / 12 + ((i + 0.5) * 2 * Math.PI) / sides;
    const sin = Math.sin(angle);
    if (sin >= 0.3) return body;
    if (sin >= 0) return stripe;
    return belly;
  };

  // Fuselaje: sección casi circular que se cierra en el morro y en el cono de cola.
  const fuselage = [
    { z: -22.0, cy: 0.55, rx: 0.06, ry: 0.06 },
    { z: -20.2, cy: 0.45, rx: 0.6, ry: 0.55 },
    { z: -17.3, cy: 0.3, rx: 1.3, ry: 1.2 },
    { z: -13.5, cy: 0.12, rx: 1.85, ry: 1.75 },
    { z: -6.0, cy: 0.0, rx: 2.0, ry: 1.95 },
    { z: 6.0, cy: 0.0, rx: 2.0, ry: 1.95 },
    { z: 12.0, cy: 0.02, rx: 1.96, ry: 1.88 },
    { z: 16.4, cy: -0.02, rx: 1.62, ry: 1.52 },
    { z: 19.2, cy: -0.08, rx: 1.05, ry: 0.96 },
    { z: 21.0, cy: -0.14, rx: 0.5, ry: 0.46 },
    { z: 22.0, cy: -0.18, rx: 0.06, ry: 0.06 },
  ].map((s) => ellipseRing(s.z, s.cy, s.rx, s.ry, 12));
  b.loft(fuselage, livery);

  // Carena ventral (wing-body fairing): el bulto donde el ala se funde con el fuselaje.
  const fairing = [
    { z: -9.0, rx: 0.6, ry: 0.25 },
    { z: -5.0, rx: 1.9, ry: 0.55 },
    { z: 1.0, rx: 2.35, ry: 0.8 },
    { z: 7.5, rx: 2.1, ry: 0.65 },
    { z: 11.5, rx: 1.2, ry: 0.35 },
  ].map((s) => ellipseRing(s.z, -1.35, s.rx, s.ry, 8));
  b.loft(fairing, belly);

  // Cabina: parabrisas partido y ventanas laterales del morro.
  b.face(
    [
      [-1.18, 0.5, 17.2],
      [-0.55, 1.02, 19.85],
      [0.55, 1.02, 19.85],
      [1.18, 0.5, 17.2],
    ],
    dark,
    [0, 0, 17],
  );
  for (const side of [-1, 1]) {
    b.face(
      [
        [side * 1.02, -0.3, 16.6],
        [side * 1.2, 0.42, 16.9],
        [side * 0.9, 1.0, 19.5],
        [side * 0.5, 0.45, 19.2],
      ],
      dark,
      [0, 0, 18],
    );
  }

  // Ala: raíz gruesa junto al fuselaje, punta fina 6 m más atrás (25° de flecha)
  // y 1,3 m más alta (diedro). El ala se loft de raíz a punta.
  const wingStations = [
    { x: 1.9, y: -0.55, zLE: 5.2, zTE: -3.4, t: 0.62 },
    { x: 7.0, y: -0.3, zLE: 3.4, zTE: -2.9, t: 0.48 },
    { x: 13.0, y: 0.25, zLE: 0.6, zTE: -2.5, t: 0.3 },
    { x: 17.6, y: 0.85, zLE: -2.3, zTE: -3.6, t: 0.15 },
    { x: 19.0, y: 1.05, zLE: -3.2, zTE: -4.0, t: 0.06 },
  ];
  for (const side of [-1, 1]) {
    b.loft(
      wingStations.map((s) => airfoilRing(side * s.x, s.y, s.zLE, s.zTE, s.t)),
      (_i, pair) => (pair >= 3 ? stripe : wing),
    );
    // Winglet: placa casi vertical en la punta, barrida hacia atrás.
    b.plate(
      [
        [side * 18.9, 1.0, -3.2],
        [side * 19.1, 1.0, -3.3],
        [side * 19.1, 3.4, -5.6],
        [side * 18.9, 3.4, -5.5],
      ],
      0.16,
      stripe,
    );
  }

  // Estabilizador horizontal: también en flecha, más pequeño y bajo la deriva.
  for (const side of [-1, 1]) {
    b.loft(
      [
        airfoilRing(side * 0.7, 0.3, -16.9, -23.4, 0.3),
        airfoilRing(side * 4.4, 0.42, -18.6, -23.3, 0.18),
        airfoilRing(side * 7.0, 0.5, -20.1, -23.0, 0.05),
      ],
      wing,
    );
  }

  // Deriva: borde de ataque barrido y punta redondeada, con la punta en azul.
  b.loft(
    [
      finRing(1.15, -15.8, -23.2, 0.42),
      finRing(4.2, -18.4, -23.4, 0.3),
      finRing(7.6, -20.6, -23.4, 0.16),
      finRing(8.5, -21.5, -23.1, 0.05),
    ],
    (pair) => (pair >= 2 ? stripe : body),
  );

  // Carenado dorsal: el triángulo que funde el cono de cola con la deriva.
  b.loft(
    [
      [
        [-0.45, 1.55, -11.0],
        [0.45, 1.55, -11.0],
        [0.45, 1.5, -16.0],
        [-0.45, 1.5, -16.0],
      ],
      [
        [-0.3, 2.4, -16.6],
        [0.3, 2.4, -16.6],
        [0.3, 2.3, -20.8],
        [-0.3, 2.3, -20.8],
      ],
    ],
    body,
  );

  // Motores: góndola con entrada oscura, carenado y pilón al ala.
  for (const side of [-1, 1]) {
    const cx = side * 6.9;
    b.loft(
      [
        ellipseRing(-2.4, -1.55, 0.55, 0.55, 8, cx),
        ellipseRing(-1.7, -1.55, 1.22, 1.18, 8, cx),
        ellipseRing(1.2, -1.55, 1.28, 1.22, 8, cx),
        ellipseRing(2.5, -1.5, 1.05, 1.02, 8, cx),
        ellipseRing(2.85, -1.5, 0.92, 0.9, 8, cx),
      ],
      (i) => (i === 0 ? metal : "#9aa7b6"),
    );
    b.face(ellipseRing(2.86, -1.5, 0.9, 0.88, 8, cx), dark, [cx, -1.5, 0]);
    b.box(cx, -0.62, 1.0, 0.36, 1.5, 4.2, "#9aa7b6");
  }

  // Luces de aterrizaje bajo el morro.
  b.box(0, -1.5, 15.6, 0.9, 0.24, 0.6, "#fde68a");
  return { name: "airliner", builder: b };
}

/**
 * Helicóptero ligero-medio, 13 m con el rotor.
 *
 * La silueta se reconoce por la cúpula acristalada, la viga de cola afinada, el
 * rotor de cuatro palas con cono y los patines. Un fuselaje cuadrado no se lee
 * como helicóptero por mucho rotor que tenga encima.
 */
function helicopter() {
  const b = createBuilder();
  const body = "#eef2f7";
  const accent = "#f97316";
  const metal = "#475569";
  const dark = "#0b1220";
  const glass = "#1e4b63";

  // Cabina: morro redondeado que se afina hacia arriba y hacia atrás.
  b.loft(
    [
      ellipseRing(-2.3, 0.15, 0.9, 1.05, 10),
      ellipseRing(-1.0, 0.2, 1.25, 1.38, 10),
      ellipseRing(1.6, 0.15, 1.36, 1.45, 10),
      ellipseRing(3.7, 0.02, 1.24, 1.24, 10),
      ellipseRing(5.0, -0.02, 0.92, 0.92, 10),
      ellipseRing(5.75, -0.1, 0.5, 0.5, 10),
      ellipseRing(6.1, -0.15, 0.1, 0.1, 10),
    ],
    (i, pair, sides) => {
      const angle = Math.PI / 12 + ((i + 0.5) * 2 * Math.PI) / sides;
      const sin = Math.sin(angle);
      // Cúpula: el cristal se pinta en las secciones del morro en vez de ser
      // una carcasa aparte. Una tira flotante deja ver las facetas del fuselaje
      // por debajo y desde el frente parece un casco roto.
      if (pair >= 3 && sin > 0.3) return glass;
      return sin < -0.35 ? "#cbd5e1" : body;
    },
  );

  // Franja de color a los lados del fuselaje, a la altura de las ventanillas.
  b.box(0, -0.55, 1.1, 2.72, 0.42, 6.6, accent);

  for (const side of [-1, 1]) {
    // Patín con la punta levantada, como el de un Bell 407.
    b.loft(
      [
        tubeRing(-1.9, -2.1, 0.14, side * 1.35),
        tubeRing(3.6, -2.1, 0.14, side * 1.35),
        tubeRing(4.9, -1.95, 0.14, side * 1.32),
        tubeRing(5.5, -1.65, 0.11, side * 1.3),
      ],
      metal,
    );
    // Montantes en V.
    b.box(side * 1.1, -1.3, 1.9, 0.16, 1.7, 0.16, metal);
    b.box(side * 1.1, -1.3, -0.4, 0.16, 1.7, 0.16, metal);
  }

  // Viga de cola: sección que se afina y sube ligeramente.
  b.loft(
    [
      tubeRing(-2.2, 0.45, 0.62),
      tubeRing(-4.2, 0.55, 0.48),
      tubeRing(-6.6, 0.62, 0.36),
      tubeRing(-7.6, 0.65, 0.3),
    ],
    body,
  );

  // Deriva barrida y estabilizador horizontal del tail boom.
  b.loft(
    [
      finRing(0.55, -6.9, -9.0, 0.16),
      finRing(1.5, -7.7, -9.5, 0.13),
      finRing(2.15, -8.4, -9.4, 0.05),
    ],
    accent,
  );
  for (const side of [-1, 1]) {
    b.plate(
      [
        [side * 0.2, 0.7, -6.7],
        [side * 1.35, 0.7, -7.3],
        [side * 1.35, 0.7, -8.0],
        [side * 0.2, 0.7, -7.6],
      ],
      0.1,
      body,
    );
  }

  // Rotor de cola: dos palas finas en cruz y el buje. Las palas se generan
  // sobre su propio eje (raíz → punta) para que ninguna esquina coincida.
  b.box(0.36, 1.35, -8.55, 0.22, 0.3, 0.3, metal);
  for (const angle of [0, Math.PI / 2]) {
    const dy = Math.cos(angle);
    const dz = Math.sin(angle);
    const cy = -dz;
    const cz = dy;
    const at = (r, offset) => [
      0.38,
      1.35 + dy * r + cy * offset,
      -8.55 + dz * r + cz * offset,
    ];
    b.plate(
      [at(0.16, -0.1), at(0.16, 0.1), at(1.3, 0.07), at(1.3, -0.07)],
      0.06,
      dark,
    );
  }

  // Mástil y rotor principal: cuatro palas con cono, más largas que anchas.
  b.loft(
    [
      tubeRing(-0.3, 1.15, 0.3),
      tubeRing(1.75, 2.0, 0.26),
    ],
    metal,
  );
  b.loft(
    [
      ellipseRing(1.55, 2.05, 0.34, 0.34, 8),
      ellipseRing(1.95, 2.08, 0.3, 0.3, 8),
    ],
    "#334155",
  );
  for (let k = 0; k < 4; k += 1) {
    const angle = (k * Math.PI) / 2 + Math.PI / 4;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const px = -dz;
    const pz = dx;
    b.plate(
      [
        [dx * 0.45 + px * 0.34, 2.1, dz * 0.45 + pz * 0.34],
        [dx * 0.45 - px * 0.34, 2.1, dz * 0.45 - pz * 0.34],
        [dx * 5.3 - px * 0.22, 2.32, dz * 5.3 - pz * 0.22],
        [dx * 5.3 + px * 0.22, 2.32, dz * 5.3 + pz * 0.22],
      ],
      0.09,
      dark,
    );
  }

  // Estabilizador vertical pequeño sobre la viga (antipar), escape y antena.
  b.box(0, 0.95, -5.4, 0.5, 0.32, 1.5, metal);
  b.box(0, 2.55, -0.2, 0.16, 0.9, 0.16, "#94a3b8");
  return { name: "helicopter", builder: b };
}

/**
 * Carguero tipo Panamax: 190 m de eslora y 28 de manga.
 *
 * La proa afilada es lo que distingue un barco de una caja flotante: el casco
 * se loft con la manga cerrándose de 28 m a casi cero y el codaste subiendo por
 * encima de la flotación. Encima, castillo a popa con puente y alas, chimenea y
 * las pilas de contenedores.
 */
function cargoShip() {
  const b = createBuilder();
  const hullRed = "#7f1d1d";
  const hullBlue = "#1e3a5f";
  const deck = "#94a3b8";
  const white = "#eef2f7";
  const dark = "#0f172a";
  const funnel = "#1f2937";
  const boxes = ["#f97316", "#0ea5e9", "#10b981", "#eab308"];

  const stations = [
    { z: -95.0, hb: 9.5, keel: 3.2, deck: 9.4 },
    { z: -88.0, hb: 11.5, keel: -5.5, deck: 9.2 },
    { z: -70.0, hb: 13.2, keel: -9.0, deck: 9.0 },
    { z: -20.0, hb: 14.0, keel: -9.4, deck: 9.0 },
    { z: 30.0, hb: 14.0, keel: -9.4, deck: 9.0 },
    { z: 58.0, hb: 12.8, keel: -8.6, deck: 9.2 },
    { z: 76.0, hb: 9.6, keel: -6.6, deck: 9.8 },
    { z: 87.0, hb: 5.6, keel: -3.4, deck: 10.8 },
    { z: 93.0, hb: 2.4, keel: 0.8, deck: 12.0 },
    { z: 96.5, hb: 0.35, keel: 5.4, deck: 13.2 },
  ];

  const hullRing = (s) => {
    const mid = s.keel + (s.deck - s.keel) * 0.55;
    return [
      [0, s.keel, s.z],
      [s.hb * 0.55, s.keel + 2.0, s.z],
      [s.hb * 0.96, mid, s.z],
      [s.hb, s.deck - 1.1, s.z],
      [s.hb * 0.86, s.deck, s.z],
      [-s.hb * 0.86, s.deck, s.z],
      [-s.hb, s.deck - 1.1, s.z],
      [-s.hb * 0.96, mid, s.z],
      [-s.hb * 0.55, s.keel + 2.0, s.z],
    ];
  };

  b.loft(
    stations.map(hullRing),
    (i) => {
      if (i === 4) return deck;              // la cubierta cruza de banda a banda
      if (i === 0 || i === 1 || i === 7 || i === 8) return hullRed; // obra viva
      return hullBlue;
    },
  );

  // Espejo de popa y roda de proa, en oscuro para que se lean como cantos.
  b.face(hullRing(stations[0]), hullBlue, [0, 5, -80]);
  b.face(hullRing(stations[stations.length - 1]), hullBlue, [0, 9, 90]);

  // Bulbo de proa: el bulto bajo la flotación que hoy llevan casi todos.
  b.loft(
    [
      ellipseRing(89.0, -3.2, 1.2, 2.0, 8),
      ellipseRing(93.0, -3.4, 2.4, 2.6, 8),
      ellipseRing(96.0, -3.4, 1.6, 1.9, 8),
      ellipseRing(97.0, -3.2, 0.4, 0.6, 8),
    ],
    hullRed,
  );

  // Castillo a popa: bloque de habilitación, puente con alas y chimenea.
  b.box(0, 17.5, -75, 21, 15, 20, white);
  b.box(0, 24.6, -70.5, 31, 0.8, 5.0, white); // alas del puente
  b.box(0, 22.4, -64.8, 19, 1.4, 0.5, dark);   // ventanas del puente
  b.box(11.2, 22.4, -75, 0.5, 1.4, 15, dark);
  b.box(-11.2, 22.4, -75, 0.5, 1.4, 15, dark);
  b.loft(
    [
      ellipseRing(-80.0, 25.4, 3.6, 4.4, 6),
      ellipseRing(-80.0, 33.0, 3.1, 3.8, 6),
    ],
    (i) => (i === 0 ? funnel : "#334155"),
  );
  b.box(0, 34.2, -80, 2.2, 2.6, 2.2, funnel);
  b.box(0, 34.6, -66, 0.2, 15, 0.2, "#cbd5e1"); // palo de radar
  b.box(0, 41.4, -66, 4.6, 0.16, 0.3, "#cbd5e1");

  // Carga: pilas de contenedores de dos alturas, escalonadas a lo largo de la cubierta.
  let slot = 0;
  for (let z = -56; z <= 50; z += 12) {
    for (const x of [-8.4, 0, 8.4]) {
      b.box(x, 10.6, z, 7.6, 3.0, 10.5, boxes[slot % boxes.length]);
      if (slot % 3 !== 1) {
        b.box(x, 13.7, z, 7.6, 3.0, 10.5, boxes[(slot + 2) % boxes.length]);
      }
      slot += 1;
    }
  }

  // Castillo de proa, molinete y palo.
  b.box(0, 10.4, 78, 16, 2.4, 14, white);
  b.box(0, 15.0, 80, 0.3, 8, 0.3, "#cbd5e1");
  b.box(0, 5.6, 88, 5.0, 3.2, 5.0, hullBlue);
  return { name: "cargo-ship", builder: b };
}

/* ------------------------------------------------------------------------- */
/* Contenedor GLB                                                             */
/* ------------------------------------------------------------------------- */

const MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a; // "JSON"
const BIN_CHUNK = 0x004e4942; // "BIN\0"

const pad4 = (length) => (4 - (length % 4)) % 4;

function writeGlb({ name, builder }) {
  const { positions, normals, colors, indices } = builder;
  const vertexCount = positions.length / 3;

  // Uint16 hasta 65 535 vértices; si un modelo creciera, el índice pasa a 32 bits
  // en vez de desbordarse en silencio y pintar triángulos cruzados.
  const wideIndices = vertexCount > 0xffff;
  const positionBytes = Float32Array.from(positions);
  const normalBytes = Float32Array.from(normals);
  const colorBytes = Float32Array.from(colors);
  const indexBytes = wideIndices ? Uint32Array.from(indices) : Uint16Array.from(indices);

  const positionLength = positionBytes.byteLength;
  const normalLength = normalBytes.byteLength;
  const colorLength = colorBytes.byteLength;
  const indexLength = indexBytes.byteLength;
  const indexPadding = pad4(indexLength);

  const bin = Buffer.concat([
    Buffer.from(positionBytes.buffer, positionBytes.byteOffset, positionLength),
    Buffer.from(normalBytes.buffer, normalBytes.byteOffset, normalLength),
    Buffer.from(colorBytes.buffer, colorBytes.byteOffset, colorLength),
    Buffer.from(indexBytes.buffer, indexBytes.byteOffset, indexLength),
    Buffer.alloc(indexPadding),
  ]);

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], positions[i + axis]);
      max[axis] = Math.max(max[axis], positions[i + axis]);
    }
  }

  const gltf = {
    asset: { version: "2.0", generator: "AiTor · scripts/build-transport-models.mjs" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name }],
    meshes: [
      {
        name,
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 },
            indices: 3,
            material: 0,
            mode: 4,
          },
        ],
      },
    ],
    materials: [
      {
        name: "transport",
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0.1,
          roughnessFactor: 0.8,
        },
        doubleSided: true,
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: vertexCount,
        type: "VEC3",
        min,
        max,
      },
      { bufferView: 1, componentType: 5126, count: vertexCount, type: "VEC3" },
      { bufferView: 2, componentType: 5126, count: vertexCount, type: "VEC3" },
      {
        bufferView: 3,
        componentType: wideIndices ? 5125 : 5123,
        count: indices.length,
        type: "SCALAR",
      },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positionLength, target: 34962 },
      { buffer: 0, byteOffset: positionLength, byteLength: normalLength, target: 34962 },
      { buffer: 0, byteOffset: positionLength + normalLength, byteLength: colorLength, target: 34962 },
      {
        buffer: 0,
        byteOffset: positionLength + normalLength + colorLength,
        byteLength: indexLength,
        target: 34963,
      },
    ],
    buffers: [{ byteLength: bin.byteLength }],
  };

  const json = Buffer.from(JSON.stringify(gltf), "utf8");
  const jsonChunk = Buffer.concat([json, Buffer.alloc(pad4(json.length), 0x20)]);
  const binChunk = bin;

  const total = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonHeader.writeUInt32LE(JSON_CHUNK, 4);

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binChunk.length, 0);
  binHeader.writeUInt32LE(BIN_CHUNK, 4);

  return Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]);
}

/* ------------------------------------------------------------------------- */

mkdirSync(OUT_DIR, { recursive: true });
for (const model of [airliner(), helicopter(), cargoShip()]) {
  const glb = writeGlb(model);
  const path = resolve(OUT_DIR, `${model.name}.glb`);
  writeFileSync(path, glb);
  const triangles = model.builder.indices.length / 3;
  const { positions } = model.builder;
  const bounds = [0, 1, 2].map((axis) => {
    let lo = Infinity, hi = -Infinity;
    for (let i = axis; i < positions.length; i += 3) {
      lo = Math.min(lo, positions[i]);
      hi = Math.max(hi, positions[i]);
    }
    return `${(hi - lo).toFixed(1)}`;
  });
  console.log(
    `public/models/${model.name}.glb  ${(glb.length / 1024).toFixed(1)} KB · ` +
      `${triangles} triángulos · ancho ${bounds[0]} m, alto ${bounds[1]} m, largo ${bounds[2]} m`,
  );
}
