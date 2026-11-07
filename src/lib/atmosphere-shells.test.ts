import { describe, expect, it } from "vitest";
import {
	ATMOSPHERE_SHELLS,
	EARTH_RADIUS_M,
	SHELLS_VISIBLE_ABOVE_M,
	shellExaggeration,
	shellRadiusM,
} from "./atmosphere-shells";

describe("envolturas atmosféricas", () => {
	it("mantiene el orden físico de las alturas reales", () => {
		const real = ATMOSPHERE_SHELLS.map((shell) => shell.topKm);
		expect(real).toEqual([...real].sort((a, b) => a - b));
		expect(real[0]).toBe(12);
		expect(real[real.length - 1]).toBe(600);
	});

	it("dibuja los cascarones de dentro afuera, sin cruzarse", () => {
		const radii = ATMOSPHERE_SHELLS.map(shellRadiusM);
		for (let i = 1; i < radii.length; i++) {
			expect(radii[i]).toBeGreaterThan(radii[i - 1]);
		}
		// El último tiene que quedar por debajo de la altura a la que se dejan de
		// dibujar: si no, el cascarón exterior quedaría fuera de la vista en el
		// mismo momento en que aparece.
		expect(radii[radii.length - 1] - EARTH_RADIUS_M).toBeLessThan(SHELLS_VISIBLE_ABOVE_M / 2);
	});

	it("exagera siempre y con la exageración a la vista", () => {
		for (const shell of ATMOSPHERE_SHELLS) {
			expect(shell.visualTopKm).toBeGreaterThan(shell.topKm);
			expect(shellExaggeration(shell)).toBeGreaterThan(1);
		}
	});

	it("no tiñe el planeta: el relleno se queda por debajo del 5 %", () => {
		for (const shell of ATMOSPHERE_SHELLS) {
			expect(shell.alpha).toBeGreaterThan(0);
			expect(shell.alpha).toBeLessThanOrEqual(0.05);
		}
	});

	it("no repite identificadores", () => {
		const ids = ATMOSPHERE_SHELLS.map((shell) => shell.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
