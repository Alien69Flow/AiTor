import { describe, expect, it } from "vitest";

import { buildDeck } from "./decks";
import {
	UNO_COLORS,
	UNO_HAND_SIZE,
	UNO_WIN_BONUS,
	baseRank,
	unoBot,
	unoDraw,
	unoLegal,
	unoPlay,
	unoPlayable,
	unoScore,
	unoStart,
} from "./uno";

describe("uno", () => {
	it("reparte cinco cartas a cada uno sin repetir ninguna", () => {
		const state = unoStart(11);
		expect(state.hand).toHaveLength(UNO_HAND_SIZE);
		expect(state.rival).toHaveLength(UNO_HAND_SIZE);
		const ids = [...state.hand, ...state.rival, ...state.draw].map((card) => card.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids.length).toBe(buildDeck("uno").length);
	});

	it("abre la mesa con un número, nunca con un comodín", () => {
		for (let seed = 1; seed <= 20; seed += 1) {
			const state = unoStart(seed);
			expect(state.color).not.toBe("comodin");
			expect((UNO_COLORS as readonly string[]).includes(state.color)).toBe(true);
			expect(/^\d/.test(state.discard.rank)).toBe(true);
		}
	});

	it("sólo vale el color de la mesa, el mismo número o un comodín", () => {
		const state = unoStart(7);
		const painted = state.hand.map((card) => unoPlayable(state, card));
		for (const [index, card] of state.hand.entries()) {
			const expected =
				card.suit === "comodin" ||
				card.suit === "roba4" ||
				card.suit === state.color ||
				baseRank(card) === baseRank(state.discard);
			expect(painted[index]).toBe(expected);
		}
	});

	it("una jugada ilegal no cambia nada y no lanza", () => {
		const state = unoStart(3);
		const illegal = state.hand.find((card) => !unoPlayable(state, card));
		if (!illegal) return;
		expect(unoPlay(state, illegal.id)).toBe(state);
		expect(unoPlay(state, "no-existe")).toBe(state);
	});

	it("tirar una carta pasa el turno y el bot responde en la misma jugada", () => {
		const state = unoStart(5);
		const legal = unoLegal(state);
		if (legal.length === 0) return;
		const next = unoPlay(state, legal[0].id);
		expect(next.played).toBe(1);
		expect(next.discard.id).toBe(legal[0].id);
		expect(next.turn).toBe(0);
	});

	it("robar deja la mano con una carta más y el turno en el bot", () => {
		const state = unoStart(9);
		const next = unoDraw(state);
		expect(next.hand.length).toBe(state.hand.length + 1);
		expect(next.turn).toBe(0);
	});

	it("el bot no juega cuando no le toca", () => {
		const state = unoStart(2);
		expect(unoBot(state)).toBe(state);
	});

	it("vaciar la mano cierra la partida con bonus", () => {
		const state = unoStart(4);
		const single = unoPlay(state, state.hand[0].id);
		const score = unoScore(single);
		expect(score).toBeGreaterThanOrEqual(0);
		expect(unoScore({ ...state, winner: 0 })).toBe(UNO_WIN_BONUS);
	});
});
