#!/usr/bin/env node
/**
 * Aplica el parche de las capas que el globo enciende al abrirse.
 *
 *   npx tsx scripts/apply-globe-defaults-patch.ts          # escribe
 *   npx tsx scripts/apply-globe-defaults-patch.ts --check   # sólo comprueba
 *
 * Sale con 1 sin escribir nada si el catálogo no es el esperado: un parche a
 * medias deja el archivo peor que no tocarlo.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { applyGlobeDefaultsPatch } from "../src/lib/globe-defaults-patch";

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(HERE, "../src/lib/globe-layers.ts");
const checkOnly = process.argv.includes("--check");

const source = readFileSync(TARGET, "utf8");
const result = applyGlobeDefaultsPatch(source);

if (!result.ok) {
	console.error("No se puede aplicar el parche:");
	for (const problem of result.problems) console.error(`  - ${problem}`);
	process.exit(1);
}

if (result.already) {
	console.log("Las capas por defecto ya están parcheadas: nada que hacer.");
	process.exit(0);
}

if (checkOnly) {
	console.log("El parche se aplicaría correctamente (--check: no se escribe).");
	process.exit(0);
}

writeFileSync(TARGET, result.source, "utf8");
console.log("Capas por defecto actualizadas en src/lib/globe-layers.ts");
