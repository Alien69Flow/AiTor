#!/usr/bin/env node
/**
 * Hielo marino a AMSR2 25 km sobre el catálogo actual.
 *
 * Segunda versión: la de #68 anclaba en títulos de prueba que `main` ya
 * reescribió («las corrientes piden el último compuesto…»), así que fallaba
 * entera sin escribir nada. Esta ancla en el bloque `seaIce` del catálogo,
 * localizado por su `key`, y no en el fichero entero: `freshness: "1 día"`
 * sale nueve veces y una sustitución global habría tocado las otras ocho.
 *
 * Todo o nada: si algo no aparece exactamente una vez, sale con 1 sin escribir.
 *
 * Uso:  node scripts/globe-amsr2-patch.mjs [--check]
 */
import { readFileSync, writeFileSync } from "node:fs";

const LAYERS = "src/lib/globe-layers.ts";
const TEST = "src/lib/globe-layers.test.ts";
const NEW_LAYER = "AMSRU2_Sea_Ice_Concentration_25km";

const files = {
  [LAYERS]: readFileSync(LAYERS, "utf8"),
  [TEST]: readFileSync(TEST, "utf8"),
};

const checkOnly = process.argv.includes("--check");

if (files[LAYERS].includes(NEW_LAYER)) {
  console.log("El parche ya estaba aplicado; no se toca nada.");
  process.exit(0);
}

/** Recorta el objeto `{ ... }` que contiene `key: "<key>"`. */
function blockOf(src, key) {
  const at = src.indexOf(`key: "${key}"`);
  if (at < 0) return null;
  const open = src.lastIndexOf("{", at);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

/** Sustituye dentro del bloque y devuelve el bloque nuevo, o falla. */
function swapIn(block, label, pattern, replace) {
  const flags = `${pattern.flags.replace("g", "")}g`;
  const hits = block.match(new RegExp(pattern.source, flags)) ?? [];
  if (hits.length !== 1) {
    throw new Error(
      `«${label}» aparece ${hits.length} veces en el bloque, se esperaba 1. No se escribe nada.`,
    );
  }
  console.log(`OK   ${label}`);
  return block.replace(pattern, replace);
}

const ice = blockOf(files[LAYERS], "seaIce");
if (!ice) {
  throw new Error('No encuentro el bloque `key: "seaIce"`. No se escribe nada.');
}

let block = ice;
block = swapIn(
  block,
  "fuente del hielo marino",
  /source: "NASA GIBS \u00b7 VIIRS NOAA-21 \(diario\)",/,
  'source: "NASA GIBS \u00b7 AMSR2/GCOM-W1, 25 km",',
);
block = swapIn(
  block,
  "frescura del hielo marino",
  /freshness: "1 d\u00eda",/,
  'freshness: "\u00daltima pasada publicada",',
);
block = swapIn(
  block,
  "descripci\u00f3n del hielo marino",
  /description: "Extensi\u00f3n de hielo marino de polo a polo, medida a 375 m",/,
  'description: "Concentraci\u00f3n de hielo marino de polo a polo, medida cada d\u00eda a 25 km",',
);
block = swapIn(
  block,
  "comentario del hielo marino",
  /\/\/ MUR deduc[^\n]*\n([ \t]*)\/\/ el borde; VIIRS lo mide[^\n]*/,
  (_match, pad) =>
    "// AMSR2 mide la concentraci\u00f3n en una rejilla polar de 25 km. GIBS\n" +
    `${pad}// ya no la actualiza a diario: sin segmento TIME sirve la \u00faltima pasada.`,
);
block = swapIn(
  block,
  "tesela del hielo marino",
  /gibs: \{ layer: "VIIRS_NOAA21_Sea_Ice"[^}]*\}/,
  `gibs: { layer: "${NEW_LAYER}", level: 6, alpha: 0.85, timeless: true }`,
);

files[LAYERS] = files[LAYERS].replace(ice, () => block);

// Prueba nueva, colgada justo antes de la de corrientes, que ya existe en main.
const TEST_ANCHOR =
  /^([ \t]*)it\("las corrientes piden el \u00faltimo compuesto, sin fecha fija", \(\) => \{/m;
const anchor = TEST_ANCHOR.exec(files[TEST]);
if (!anchor) {
  throw new Error(
    "No encuentro la prueba de corrientes donde colgar la del hielo. No se escribe nada.",
  );
}
const pad = anchor[1];
const rows = [
  'it("el hielo marino es AMSR2 a 25 km y va sin fecha fija", () => {',
  '  const ice = layerDef("seaIce")?.gibs;',
  "  // AMSRU2_Sea_Ice_Concentration_25km es la rejilla polar de AMSR2 (GCOM-W1).",
  "  // GIBS ya no la actualiza a diario: sin segmento TIME sirve la última pasada,",
  "  // que es justo la que se quiere ver en el globo.",
  `  expect(ice?.layer).toBe("${NEW_LAYER}");`,
  "  expect(ice?.timeless).toBe(true);",
  "  expect(ice?.date).toBeUndefined();",
  "  expect(ice?.dateOffsetHours).toBeUndefined();",
  "});",
];
const inserted = rows.map((row) => `${pad}${row}`).join("\n");
files[TEST] = files[TEST].replace(TEST_ANCHOR, () => `${inserted}\n${anchor[0]}`);
console.log(`OK   ${TEST} \u00b7 prueba del hielo marino`);

if (checkOnly) {
  console.log("\n--check: no se escribe nada.");
  process.exit(0);
}

for (const [file, content] of Object.entries(files)) writeFileSync(file, content);
console.log("\nParche aplicado.");
