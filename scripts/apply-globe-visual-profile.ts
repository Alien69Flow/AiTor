// Aplica el perfil visual «Google Earth» sobre el fuente real del visor.
//
// Uso:  npx tsx scripts/apply-globe-visual-profile.ts
//       npx tsx scripts/apply-globe-visual-profile.ts --check   (no escribe)
//
// Falla con código 1 y sin tocar el archivo si el fuente ya no tiene las
// anclas: mejor un error claro que un visor a medias que no compila.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { applyGlobeVisualProfile } from "../src/lib/globe-visual-profile";

const target = resolve("src/components/globe/CesiumGlobe.tsx");
const checkOnly = process.argv.includes("--check");
const before = readFileSync(target, "utf8");
const result = applyGlobeVisualProfile(before);

if (!result.ok) {
  console.error(`✖ No se puede aplicar el perfil visual: ${target} cambió.`);
  for (const problem of result.problems) console.error(`   - ${problem}`);
  console.error("\nNo se ha escrito nada.");
  process.exit(1);
}

if (result.already.length) {
  console.log(`· Ya estaba aplicado: ${result.already.join(", ")}`);
}

if (!result.applied.length) {
  console.log("Nada que hacer: el perfil ya está completo.");
  process.exit(0);
}

if (checkOnly) {
  console.log(`Pendiente: ${result.applied.join(", ")}`);
  process.exit(0);
}

writeFileSync(target, result.source);
console.log(`✔ Aplicado: ${result.applied.join(", ")}`);
console.log("Siguiente paso: npx tsc -b && npx vitest run src/lib/globe-visual-profile.test.ts");
console.log("Y después: npm run dev, con la consola del navegador a la vista.");
