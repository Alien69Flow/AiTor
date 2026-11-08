// Aplica el parche de la base del globo sobre el fuente real del visor.
//
// Uso:  npx tsx scripts/apply-globe-base-patch.ts
//       npx tsx scripts/apply-globe-base-patch.ts --check   (no escribe nada)
//
// Falla con código 1 y sin tocar el archivo si el fuente ya no tiene las
// anclas: es mejor un error claro que un parche a medias que no compila.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { applyGlobeBasePatch } from "../src/lib/globe-base-patch";

const target = resolve("src/components/globe/CesiumGlobe.tsx");
const checkOnly = process.argv.includes("--check");

const before = readFileSync(target, "utf8");
const result = applyGlobeBasePatch(before);

if (!result.ok) {
  console.error(`✖ No se puede aplicar el parche: ${target} cambió.`);
  for (const problem of result.problems) console.error(`   - ${problem}`);
  console.error("\nNo se ha escrito nada.");
  process.exit(1);
}

if (result.already.length) {
  console.log(`· Ya estaba aplicado: ${result.already.join(", ")}`);
}

if (!result.applied.length) {
  console.log("Nada que hacer: el parche ya está completo.");
  process.exit(0);
}

if (checkOnly) {
  console.log(`Pendiente: ${result.applied.join(", ")}`);
  process.exit(0);
}

writeFileSync(target, result.source);
console.log(`✔ Aplicado: ${result.applied.join(", ")}`);
console.log("Siguiente paso: npx tsc -b && npx eslint src/components/globe/CesiumGlobe.tsx");
console.log("Y después: npm run dev, con la consola del navegador a la vista.");
