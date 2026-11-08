/**
 * Aplica el plegado inicial del rail y la leyenda en `GlobeDashboard.tsx`.
 *
 * Uso:
 *   npx tsx scripts/apply-globe-fold-patch.ts          # escribe si hace falta
 *   npx tsx scripts/apply-globe-fold-patch.ts --check  # falla si falta
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { patchGlobeFold } from "../src/lib/globe-fold-patch";

const TARGET = "src/components/dashboard/GlobeDashboard.tsx";
const check = process.argv.includes("--check");
const file = resolve(process.cwd(), TARGET);
const source = readFileSync(file, "utf8");

const result = patchGlobeFold(source);

if (!result.changed) {
  console.log(`Sin cambios: el globo ya nace plegado (${TARGET}).`);
  process.exit(0);
}

if (check) {
  console.error(`Falta el plegado inicial en ${TARGET}.`);
  process.exit(1);
}

writeFileSync(file, result.source, "utf8");
console.log(`Globo plegado al cargar en ${TARGET}.`);
