import { describe, expect, it } from "vitest";

import { ROULETTE_ODDS, ROULETTE_POCKETS, afterSpin, betWins, spinNet, spinOf } from "./roulette";

describe("ruleta", () => {
	it("la bola cae siempre entre 0 y 36 y se repite con la semilla", () => {
		for (let seed = 0; seed < 200; seed += 1) {
			const pocket = spinOf(seed);
			expect(pocket).toBeGreaterThanOrEqual(0);
			expect(pocket).toBeLessThan(ROULETTE_POCKETS);
			expect(spinOf(seed)).toBe(pocket);
		}
	});

	it("el cero no es rojo, ni negro, ni par, ni impar", () => {
		for (const bet of ["rojo", "negro", "par", "impar"] as const) {
			expect(betWins(bet, 0)).toBe(false);
		}
		expect(betWins("docena1", 0)).toBe(false);
	});

	it("rojo y negro se reparten las 36 casillas sin solaparse", () => {
		let reds = 0;
		for (let pocket = 1; pocket < ROULETTE_POCKETS; pocket += 1) {
			expect(betWins("rojo", pocket)).toBe(!betWins("negro", pocket));
			if (betWins("rojo", pocket)) reds += 1;
		}
		expect(reds).toBe(18);
	});

	it("cada docena cubre doce casillas", () => {
		let first = 0;
		let second = 0;
		let third = 0;
		for (let pocket = 1; pocket < ROULETTE_POCKETS; pocket += 1) {
			if (betWins("docena1", pocket)) first += 1;
			if (betWins("docena2", pocket)) second += 1;
			if (betWins("docena3", pocket)) third += 1;
		}
		expect([first, second, third]).toEqual([12, 12, 12]);
	});

	it("ganar devuelve ficha por pago menos uno; perder resta la ficha", () => {
		expect(spinNet("rojo", 1, 10)).toBe(10 * (ROULETTE_ODDS.rojo - 1));
		expect(spinNet("rojo", 2, 10)).toBe(-10);
		expect(spinNet("docena1", 5, 10)).toBe(20);
		expect(spinNet("rojo", 7, 0)).toBe(0);
	});

	it("el marcador nunca queda en negativo", () => {
		expect(afterSpin(5, "rojo", 2, 50)).toBe(0);
		expect(afterSpin(100, "rojo", 1, 10)).toBe(110);
		// Las fichas negativas se clampean a cero antes de jugar: perdiendo el
		// marcador queda en cero (nunca negativo) y ganando paga desde ese cero.
		expect(afterSpin(-20, "par", 3, 10)).toBe(0);
		expect(afterSpin(-20, "par", 2, 10)).toBe(10);
	});
});
