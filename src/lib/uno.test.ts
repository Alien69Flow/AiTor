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
		for (const card of state.hand) {
			const expected =
				card.suit === "comodin" ||
				card.suit === "roba4" ||
				card.suit === state.color ||
				baseRank(card) === baseRank(state.discard);
			expect(unoPlayable(state, card)).toBe(expected);
		}
	});

	it("una jugada ilegal no cambia nada y no lanza", () => {
		const state = unoStart(3);
		const illegal = state.hand.find((card) => !unoPlayable(state, card));
		if (!illegal) return;
		expect(unoPlay(state, illegal.id)).toBe(state);
		expect(unoPlay(state, "no-existe")).toBe(state);
	});

	it("la carta jugada sale de la mano y el turno vuelve a ti", () => {
		const state = unoStart(5);
		const legal = unoLegal(state);
		if (legal.length === 0) return;
		const next = unoPlay(state, legal[0].id);
		// El bot responde en la misma jugada, así que el descarte ya puede ser
		// suyo; lo que no puede pasar es que la carta siga en tu mano.
		expect(next.played).toBe(1);
		expect(next.hand.some((card) => card.id === legal[0].id)).toBe(false);
		expect(next.turn).toBe(0);
	});

	it("robar suma al menos una carta y deja el turno en el bot", () => {
		const state = unoStart(9);
		const next = unoDraw(state);
		// Si el bot tira un roba-dos o un roba-cuatro, la mano crece más de una.
		expect(next.hand.length).toBeGreaterThanOrEqual(state.hand.length + 1);
		expect(next.draw.length).toBeLessThan(state.draw.length);
		expect(next.turn).toBe(0);
	});

	it("el bot no juega cuando no le toca", () => {
		const state = unoStart(2);
		expect(unoBot(state)).toBe(state);
	});

	it("vaciar la mano cierra la partida con bonus", () => {
		const state = unoStart(4);
		expect(unoScore(state)).toBe(0);
		expect(unoScore({ ...state, winner: 0 })).toBe(UNO_WIN_BONUS);
		expect(unoScore({ ...state, played: 3 })).toBe(60);
	});
});
