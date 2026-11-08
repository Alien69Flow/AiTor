import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
	PATCHED_DEFAULT_LAYERS,
	PATCHED_DISABLED_LAYER,
	applyGlobeDefaultsPatch,
} from "./globe-defaults-patch";

/** Catálogo reducido con la misma forma que el real. */
const FIXTURE = `export type EnvLayerKey = "clouds" | "precipitation" | "temperature";

/**
 * Lo que se ve al abrir el globo.
 */
export const DEFAULT_ACTIVE_LAYERS: EnvLayerKey[] = [
	"atmosphere",
	"clouds",
	"precipitation",
	"wildfires",
	"earthquakes",
	"airTraffic",
	"marineTraffic",
	"conflictZones",
	"marketData",
	"iss",
	"liveCameras",
	"vanAllen",
	"heliosphere",
];

export const MAX_RASTER_LAYERS = 8;
`;

/** Claves declaradas por un bloque, para poder comparar conjuntos. */
const keysIn = (source: string) =>
	[...source.matchAll(/"([A-Za-z][A-Za-z0-9]*)"/g)].map((match) => match[1]);

describe("applyGlobeDefaultsPatch", () => {
	it("enciende las capas pedidas y apaga el radar duplicado", () => {
		const result = applyGlobeDefaultsPatch(FIXTURE);

		expect(result.ok).toBe(true);
		expect(result.applied).toBe(true);
		expect(result.already).toBe(false);
		expect(result.problems).toEqual([]);

		const keys = keysIn(result.source);
		for (const key of PATCHED_DEFAULT_LAYERS) {
			expect(keys, `falta ${key}`).toContain(key);
		}
		expect(keys).not.toContain(PATCHED_DISABLED_LAYER);

		// El resto del archivo no se toca.
		expect(result.source).toContain("export const MAX_RASTER_LAYERS = 8;");
		expect(result.source.startsWith("export type EnvLayerKey")).toBe(true);
	});

	it("es idempotente: la segunda pasada no cambia ni un byte", () => {
		const once = applyGlobeDefaultsPatch(FIXTURE);
		const twice = applyGlobeDefaultsPatch(once.source);

		expect(twice.ok).toBe(true);
		expect(twice.already).toBe(true);
		expect(twice.applied).toBe(false);
		expect(twice.source).toBe(once.source);
	});

	it("falla en claro cuando no encuentra el bloque", () => {
		const result = applyGlobeDefaultsPatch("export const OTRA_COSA = [];\n");

		expect(result.ok).toBe(false);
		expect(result.applied).toBe(false);
		expect(result.source).toBe("export const OTRA_COSA = [];\n");
		expect(result.problems.join(" ")).toContain("No encuentro la declaración");
	});

	it("no toca un bloque que no parece una lista de capas", () => {
		const source = "export const DEFAULT_ACTIVE_LAYERS: EnvLayerKey[] = [];\n";
		const result = applyGlobeDefaultsPatch(source);

		expect(result.ok).toBe(false);
		expect(result.source).toBe(source);
		expect(result.problems.join(" ")).toContain("sólo declara 0 capa");
	});
});

describe("el catálogo real", () => {
	it("tiene las anclas y se puede parchear", () => {
		const source = readFileSync(new URL("./globe-layers.ts", import.meta.url), "utf8");
		const result = applyGlobeDefaultsPatch(source);

		expect(result.problems).toEqual([]);
		expect(result.ok).toBe(true);
		// En `main` está sin aplicar; tras aplicarlo, `already`. Las dos cosas
		// son válidas: lo que no vale es que no encuentre el bloque.
		expect(result.applied || result.already).toBe(true);

		const keys = keysIn(result.source);
		for (const key of PATCHED_DEFAULT_LAYERS) {
			expect(keys, `falta ${key}`).toContain(key);
		}
	});
});
