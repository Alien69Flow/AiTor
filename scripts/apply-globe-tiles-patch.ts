/**
 * Aplica las teselas densas en `src/lib/globe-layers.ts`.
 *
 * Uso:
 *   npx tsx scripts/apply-globe-tiles-patch.ts          # escribe si hace falta
 *   npx tsx scripts/apply-globe-tiles-patch.ts --check  # falla si falta
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { patchGlobeTiles } from "../src/lib/globe-tiles-patch";

const TARGET = "src/lib/globe-layers.ts";
const check = process.argv.includes("--check");
const file = resolve(process.cwd(), TARGET);
const source = readFileSync(file, "utf8");

const result = patchGlobeTiles(source);

if (!result.changed) {
  console.log(`Sin cambios: las capas ya piden mallas densas (${TARGET}).`);
  process.exit(0);
}

if (check) {
  console.error(`Falta el parche de teselas en ${TARGET}.`);
  process.exit(1);
}

writeFileSync(file, result.source, "utf8");
console.log(`Capas de teselas densas aplicadas en ${TARGET}.`);
