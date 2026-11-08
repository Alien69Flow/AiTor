/**
 * Aplica el cableado de transporte sobre `CesiumGlobe.tsx`.
 *
 * Se ejecuta desde el flujo de CI porque el parche necesita el fichero real y
 * un compilador: a mano depende de tener el portátil delante y de acordarse.
 *
 * Escribe por defecto, y con `--check` sólo informa: código 1 si falta aplicar
 * y 0 si ya está. Si las anclas cambiaron, el parche lanza y no toca nada.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { patchTransportWiring } from "../src/lib/transport-wiring-patch";

const target = resolve(process.cwd(), "src/components/globe/CesiumGlobe.tsx");
const check = process.argv.includes("--check");
const original = readFileSync(target, "utf8");

const result = patchTransportWiring(original);

if (!result.changed) {
	console.log("· Cableado de transporte: ya estaba aplicado.");
	process.exit(0);
}

if (check) {
	console.error("✗ Falta cablear la escala adaptativa o sacar vuelos y barcos del agrupador.");
	process.exit(1);
}

writeFileSync(target, result.source);
console.log("✓ Cableado aplicado: escala adaptativa y vuelos/barcos sin agrupar.");
