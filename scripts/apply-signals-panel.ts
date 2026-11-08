/**
 * Monta el panel de señales del motor en `SignalsTab.tsx`.
 *
 * Uso:
 *   npx tsx scripts/apply-signals-panel.ts          # escribe si hace falta
 *   npx tsx scripts/apply-signals-panel.ts --check  # falla si falta el panel
 *
 * Sin `--check` es idempotente: si el panel ya está, no reescribe el fichero
 * (no cambia la fecha de modificación ni genera diff vacío).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { patchSignalsPanel } from "../src/lib/signals-panel-patch";

const TARGET = "src/components/dashboard/SignalsTab.tsx";
const check = process.argv.includes("--check");
const file = resolve(process.cwd(), TARGET);
const source = readFileSync(file, "utf8");

const result = patchSignalsPanel(source);

if (!result.changed) {
  console.log(`Sin cambios: el panel ya estaba montado en ${TARGET}.`);
  process.exit(0);
}

if (check) {
  console.error(`Falta montar el panel de señales en ${TARGET}.`);
  process.exit(1);
}

writeFileSync(file, result.source, "utf8");
console.log(`Panel de señales montado en ${TARGET}.`);
