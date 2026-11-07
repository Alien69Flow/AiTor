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
 *  - Un GLB de 5–15 KB construido con cajas es suficiente: a la distancia a la
 *    que el globo enseña un avión, la silueta es lo único que se distingue.
 *  - Se regeneran con `npm run models:transport` y quedan versionados, así que
 *    el build no depende de la red.
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
/* Constructor de geometría                                                   */
/* ------------------------------------------------------------------------- */

/**
 * Acumula quads con normal plana. Cada cara añade 4 vértices y 2 triángulos:
 * repetir vértices por cara es lo que da el sombreado facetado de low-poly.
 */
function createBuilder() {
  const positions = [];
  const normals = [];
  const colors = [];
  const indices = [];

  const rgb = (hex) => {
    const value = hex.replace("#", "");
    return [
      parseInt(value.slice(0, 2), 16) / 255,
      parseInt(value.slice(2, 4), 16) / 255,
      parseInt(value.slice(4, 6), 16) / 255,
    ];
  };

  const quad = (a, b, c, d, normal, color) => {
    const base = positions.length / 3;
    for (const vertex of [a, b, c, d]) {
      positions.push(...vertex);
      normals.push(...normal);
      colors.push(...rgb(color));
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  /** Caja alineada con los ejes, centro y tamaño en metros. */
  const box = (cx, cy, cz, sx, sy, sz, color) => {
    const x0 = cx - sx / 2, x1 = cx + sx / 2;
    const y0 = cy - sy / 2, y1 = cy + sy / 2;
    const z0 = cz - sz / 2, z1 = cz + sz / 2;
    // Orden de cada cara: antihorario visto desde fuera.
    quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0], color);
    quad([x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], [-1, 0, 0], color);
    quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0], color);
    quad([x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [0, -1, 0], color);
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], color);
    quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], color);
  };

  return { positions, normals, colors, indices, box };
}

/* ------------------------------------------------------------------------- */
/* Modelos                                                                    */
/* ------------------------------------------------------------------------- */

/**
 * Avión de pasillo único, ~44 m de eslora y 38 de envergadura.
 * Morro a +Z, alas en X, deriva hacia +Y.
 */
function airliner() {
  const b = createBuilder();
  const body = "#e5e7eb";
  const wing = "#cbd5e1";
  const accent = "#38bdf8";
  const engine = "#64748b";

  b.box(0, 0, 0, 4.0, 4.0, 34, body);          // fuselaje
  b.box(0, 0, 19, 2.8, 2.8, 5, body);          // morro
  b.box(0, 0.2, 21.4, 2.0, 1.2, 0.6, "#0f172a"); // parabrisas
  b.box(0, 0, -18.5, 3.2, 3.2, 6, body);       // cono de cola
  b.box(0, -0.4, 1, 38, 0.6, 7, wing);         // ala principal
  b.box(0, 0.2, -19, 14, 0.4, 4, wing);        // estabilizador horizontal
  b.box(0, 4.6, -19, 0.4, 7, 5, accent);       // deriva
  b.box(12.5, -1.6, 2, 2.8, 2.8, 7, engine);   // motor izquierdo
  b.box(-12.5, -1.6, 2, 2.8, 2.8, 7, engine);  // motor derecho
  b.box(0, 2.2, 6, 3.2, 0.2, 7, accent);       // galería de cabina
  return { name: "airliner", builder: b };
}

/** Helicóptero medio, ~12 m de fuselaje y 13 de rotor. */
function helicopter() {
  const b = createBuilder();
  const body = "#e5e7eb";
  const metal = "#475569";
  const accent = "#f97316";

  b.box(0, 0, 1.5, 2.6, 3.0, 6.5, body);       // cabina
  b.box(0, -0.2, 5.2, 2.2, 2.2, 2, body);      // morro
  b.box(0, 0.9, 5.5, 2.0, 1.2, 1.4, "#0ea5e9"); // cristal frontal
  b.box(0, -0.6, 1.2, 2.7, 0.6, 5.4, accent);  // franja de color
  b.box(0, 0.4, -5.5, 0.5, 0.5, 7, body);      // viga de cola
  b.box(0, 1.4, -8.8, 0.3, 2.4, 1.4, body);    // deriva
  b.box(0.4, 1.4, -8.9, 0.1, 2.6, 0.4, metal); // rotor de cola
  b.box(1.3, -2.3, 0.6, 0.25, 0.25, 5.4, metal);  // patín izquierdo
  b.box(-1.3, -2.3, 0.6, 0.25, 0.25, 5.4, metal); // patín derecho
  b.box(1.1, -1.2, 1.6, 0.15, 1.8, 0.15, metal);  // montante
  b.box(-1.1, -1.2, 1.6, 0.15, 1.8, 0.15, metal); // montante
  b.box(0, 1.9, 0.4, 0.3, 1.0, 0.3, metal);    // mástil
  b.box(0, 2.5, 0.4, 13, 0.12, 0.9, "#111827"); // pala larga
  b.box(0, 2.5, 0.4, 0.9, 0.12, 13, "#111827"); // pala transversal
  return { name: "helicopter", builder: b };
}

/** Carguero tipo Panamax, ~190 m de eslora: casco, cubierta, contenedores y puente. */
function cargoShip() {
  const b = createBuilder();
  const hull = "#7f1d1d";
  const deck = "#94a3b8";
  const white = "#e5e7eb";
  const containers = ["#f97316", "#0ea5e9", "#10b981", "#eab308"];

  b.box(0, 4, 0, 28, 8, 170, hull);            // casco
  b.box(0, 4, 92, 18, 8, 14, hull);            // proa
  b.box(0, 8.4, 0, 26, 0.4, 160, deck);        // cubierta
  b.box(0, 12, 80, 0.6, 8, 0.6, deck);         // palo de proa

  // Contenedores: dos alturas y tres columnas a lo largo de la cubierta.
  let slot = 0;
  for (let z = -60; z <= 60; z += 8) {
    for (const x of [-8, 0, 8]) {
      b.box(x, 10.6, z, 6, 3, 6, containers[slot % containers.length]);
      if (slot % 2 === 0) b.box(x, 13.8, z, 6, 3, 6, containers[(slot + 1) % containers.length]);
      slot += 1;
    }
  }

  b.box(0, 14, -74, 22, 14, 16, white);        // puente
  b.box(0, 22.6, -73, 20, 1.6, 12, "#0f172a"); // techo de mando
  b.box(0, 25, -76, 6, 6, 6, "#1f2937");       // chimenea
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

  const positionBytes = Float32Array.from(positions);
  const normalBytes = Float32Array.from(normals);
  const colorBytes = Float32Array.from(colors);
  const indexBytes = Uint16Array.from(indices);

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
        componentType: 5123,
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
  console.log(
    `public/models/${model.name}.glb  ${(glb.length / 1024).toFixed(1)} KB · ${triangles} triángulos`,
  );
}
