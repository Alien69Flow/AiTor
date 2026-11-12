import { describe, expect, it } from "vitest";

import { PARTY, partyRoll, partyScore, partyStart, partyStep } from "./party";

describe("tablero party", () => {
	it("empieza en la casilla cero con monedas y sin estrellas", () => {
		const state = partyStart(1);
		expect(state.you).toEqual({ tile: 0, coins: PARTY.startCoins, stars: 0 });
		expect(state.rival).toEqual({ tile: 0, coins: PARTY.startCoins, stars: 0 });
		expect(state.turn).toBe(0);
		expect(state.round).toBe(1);
		expect(state.over).toBe(false);
	});

	it("el dado cae entre 1 y 6 y pasa el turno", () => {
		const state = partyStart(1);
		const next = partyRoll(state);
		expect(next.lastRoll).toBeGreaterThanOrEqual(1);
		expect(next.lastRoll).toBeLessThanOrEqual(PARTY.diceFaces);
		expect(next.you.tile).toBe((next.lastRoll ?? 0) % PARTY.tiles);
		expect(next.turn).toBe(1);
		expect(next.rolls).toBe(1);
	});

	it("la tirada se repite con la misma semilla", () => {
		expect(partyRoll(partyStart(9))).toEqual(partyRoll(partyStart(9)));
	});

	it("la casilla de monedas paga tres", () => {
		const state = { ...partyStart(1), you: { tile: 1, coins: 5, stars: 0 } };
		const next = partyStep(state, 2);
		expect(next.you.tile).toBe(PARTY.coinTile);
		expect(next.you.coins).toBe(5 + PARTY.coinsPerTile);
	});

	it("la estrella cuesta diez monedas y sin saldo no se compra", () => {
		const rich = { ...partyStart(1), you: { tile: 6, coins: 12, stars: 0 } };
		const bought = partyStep(rich, 2);
		expect(bought.you.tile).toBe(PARTY.starTile);
		expect(bought.you.stars).toBe(1);
		expect(bought.you.coins).toBe(2);

		const poor = { ...partyStart(1), you: { tile: 6, coins: 4, stars: 0 } };
		const skipped = partyStep(poor, 2);
		expect(skipped.you.stars).toBe(0);
		expect(skipped.you.coins).toBe(4);
	});

	it("el tablero da la vuelta", () => {
		const state = { ...partyStart(1), you: { tile: 10, coins: 0, stars: 0 } };
		const next = partyStep(state, 5);
		expect(next.you.tile).toBe(3);
	});

	it("cierra la partida al acabar las rondas y luego no se mueve", () => {
		let state = partyStart(3);
		let guard = 0;
		while (!state.over && guard < 50) {
			state = partyRoll(state);
			guard += 1;
		}
		expect(state.over).toBe(true);
		expect(state.rolls).toBe(PARTY.rounds * 2);
		expect(state.round).toBe(PARTY.rounds + 1);
		expect(partyRoll(state)).toBe(state);
	});

	it("la marca local vale por estrellas y monedas", () => {
		const state = { ...partyStart(1), you: { tile: 4, coins: 5, stars: 2 } };
		expect(partyScore(state)).toBe(2 * 500 + 5 * 10);
	});
});
