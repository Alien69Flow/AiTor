import { describe, expect, it } from "vitest";

import { arcadeBestKey, readArcadeBest, saveArcadeBest } from "./arcade-best";

describe("marcas del arcade extendido", () => {
	it("usa una clave por juego", () => {
		expect(arcadeBestKey("escalera-orbital")).toBe("aitor.arcade.escalera-orbital");
		expect(arcadeBestKey("ovni-flappy")).not.toBe(arcadeBestKey("kart-orbital"));
	});

	it("una marca desconocida empieza en cero", () => {
		expect(readArcadeBest("juego-que-no-existe")).toBe(0);
	});

	it("sube con la mejor partida y no baja al repetir peor", () => {
		const id = "prueba-de-marcas";
		expect(saveArcadeBest(id, 120)).toBe(120);
		expect(saveArcadeBest(id, 40)).toBe(120);
		expect(saveArcadeBest(id, 300)).toBe(300);
		expect(readArcadeBest(id)).toBe(300);
	});

	it("no acepta valores imposibles", () => {
		expect(saveArcadeBest("prueba-negativa", -50)).toBe(0);
		expect(saveArcadeBest("prueba-nan", Number.NaN)).toBe(0);
	});
});
