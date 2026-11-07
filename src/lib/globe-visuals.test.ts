import { afterEach, describe, expect, it, vi } from "vitest";
import {
	DEFAULT_RADAR_PRESET,
	DEFAULT_SHELL_PRESET,
	RADAR_PRESETS,
	SHELL_COUNT,
	SHELL_PRESETS,
	SHELL_VEIL_LIMIT,
	radarFilterCss,
	readRadarPreset,
	readShellPreset,
	shellFill,
	shellVeil,
} from "./globe-visuals";
import { ATMOSPHERE_SHELLS } from "./atmosphere-shells";

describe("variantes de las envolturas", () => {
	it("cada variante declara un relleno por cascarón", () => {
		for (const preset of SHELL_PRESETS) {
			expect(preset.fills, preset.id).toHaveLength(ATMOSPHERE_SHELLS.length);
			expect(preset.fills).toHaveLength(SHELL_COUNT);
		}
	});

	it("la veladura apilada cabe en el techo y crece con la intensidad", () => {
		const veils = SHELL_PRESETS.map(shellVeil);
		for (const [index, preset] of SHELL_PRESETS.entries()) {
			expect(veils[index], preset.id).toBeLessThan(SHELL_VEIL_LIMIT);
			expect(veils[index], preset.id).toBeGreaterThan(0.02);
		}
		// tenue < equilibrado < marcado
		expect(veils[0]).toBeLessThan(veils[1]);
		expect(veils[1]).toBeLessThan(veils[2]);
	});

	it("el cascarón de dentro tapa más que el de fuera en todas las variantes", () => {
		for (const preset of SHELL_PRESETS) {
			for (let i = 1; i < preset.fills.length; i++) {
				expect(preset.fills[i], `${preset.id}:${i}`).toBeLessThanOrEqual(preset.fills[i - 1]);
			}
		}
	});

	it("los anillos no se apagan cuando baja el relleno", () => {
		// Si alguien baja los alfas para «limpiar» el planeta, el limbo tiene que
		// seguir leyéndose: es de donde se lee la escalera de capas.
		for (const preset of SHELL_PRESETS) {
			expect(preset.outlineAlpha, preset.id).toBeGreaterThanOrEqual(0.2);
			expect(preset.outlineAlpha, preset.id).toBeLessThanOrEqual(0.5);
			expect(preset.outlineAlpha, preset.id).toBeGreaterThan(Math.max(...preset.fills));
		}
	});

	it("los identificadores son únicos y estables", () => {
		const ids = SHELL_PRESETS.map((preset) => preset.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).toContain("equilibrado");
	});
});

describe("variantes del radar", () => {
	it("el brillo no vuelve a subir por encima de 1,05: quema los ecos", () => {
		for (const preset of RADAR_PRESETS) {
			expect(preset.brightness, preset.id).toBeLessThanOrEqual(1.05);
			expect(preset.brightness, preset.id).toBeGreaterThanOrEqual(0.9);
		}
	});

	it("la saturación siempre separa intensidades", () => {
		for (const preset of RADAR_PRESETS) {
			expect(preset.saturation, preset.id).toBeGreaterThanOrEqual(1.1);
			expect(preset.saturation, preset.id).toBeLessThanOrEqual(1.6);
		}
	});

	it("la opacidad deja ver el satélite", () => {
		for (const preset of RADAR_PRESETS) {
			expect(preset.alpha, preset.id).toBeGreaterThanOrEqual(0.7);
			expect(preset.alpha, preset.id).toBeLessThanOrEqual(0.95);
		}
	});

	it("hay tres lecturas distintas, de suave a contraste", () => {
		expect(RADAR_PRESETS.map((preset) => preset.id)).toEqual(["suave", "equilibrado", "contraste"]);
		const saturations = RADAR_PRESETS.map((preset) => preset.saturation);
		expect(saturations).toEqual([...saturations].sort((a, b) => a - b));
	});
});

describe("selección de variante", () => {
	it("por defecto usa las equilibradas", () => {
		expect(DEFAULT_SHELL_PRESET.id).toBe("equilibrado");
		expect(DEFAULT_RADAR_PRESET.id).toBe("equilibrado");
	});

	it("un id desconocido cae en la de por defecto en vez de romper", () => {
		expect(readShellPreset("no-existe").id).toBe(DEFAULT_SHELL_PRESET.id);
		expect(readRadarPreset(undefined).id).toBe(DEFAULT_RADAR_PRESET.id);
		expect(readShellPreset("tenue").id).toBe("tenue");
	});

	it("el relleno fuera de rango no devuelve NaN", () => {
		const preset = readShellPreset("equilibrado");
		expect(shellFill(preset, 0)).toBe(preset.fills[0]);
		expect(shellFill(preset, 99)).toBe(preset.fills[preset.fills.length - 1]);
	});

	it("el filtro en CSS es el mismo que aplica Cesium", () => {
		const preset = readRadarPreset("contraste");
		expect(radarFilterCss(preset)).toBe("saturate(1.45) brightness(0.95)");
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it("la URL elige la variante sin tocar el componente", async () => {
		// Es la vía para comparar en el despliegue: ?shells=tenue&radar=contraste
		vi.resetModules();
		vi.stubGlobal("window", { location: { search: "?tab=globe&shells=tenue&radar=contraste" } });
		const mod = await import("./globe-visuals");
		expect(mod.DEFAULT_SHELL_PRESET.id).toBe("tenue");
		expect(mod.DEFAULT_RADAR_PRESET.id).toBe("contraste");
	});

	it("un parámetro inventado no cambia nada", async () => {
		vi.resetModules();
		vi.stubGlobal("window", { location: { search: "?shells=brutal&radar=loquesea" } });
		const mod = await import("./globe-visuals");
		expect(mod.DEFAULT_SHELL_PRESET.id).toBe("equilibrado");
		expect(mod.DEFAULT_RADAR_PRESET.id).toBe("equilibrado");
	});
});
