import { describe, expect, it } from "vitest";

import type { PlayingCard } from "./decks";
import {
	LAST_TRICK_POINTS,
	cardPoints,
	createTrickGame,
	legalCards,
	playCard,
	trickStrength,
	trumpOf,
	winnerOf,
} from "./trick";

const card = (suit: string, rank: string): PlayingCard => ({
	id: `espanola:${suit}:${rank}`,
	kind: "espanola",
	suit,
	rank,
});

const withHands = (hands: [PlayingCard[], PlayingCard[]], trump: "oros" | "copas" | "espadas" | "bastos") => ({
	...createTrickGame("guinote", 1),
	trump,
	hands,
});

describe("bazas españolas", () => {
	it("reparte cuatro en guiñote y tres en tute, sin cartas repetidas", () => {
		const guinote = createTrickGame("guinote", 7);
		expect(guinote.hands[0]).toHaveLength(4);
		expect(guinote.hands[1]).toHaveLength(4);

		const tute = createTrickGame("tute", 7);
		expect(tute.hands[0]).toHaveLength(3);
		expect(tute.hands[1]).toHaveLength(3);

		const ids = [...guinote.hands[0], ...guinote.hands[1]].map((entry) => entry.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("es determinista con la misma semilla", () => {
		const a = createTrickGame("tute", 21);
		const b = createTrickGame("tute", 21);
		expect(a.hands).toEqual(b.hands);
		expect(a.trump).toBe(b.trump);
	});

	it("la pinta es el palo con más cartas y gana por mayoría real", () => {
		expect(trumpOf([card("copas", "1"), card("copas", "2"), card("oros", "3")])).toBe("copas");
		// Sin cartas, un palo válido igualmente (nunca `undefined`).
		expect(trumpOf([])).toBe("oros");
	});

	it("el as vale once y el dos nada", () => {
		expect(cardPoints(card("oros", "1"))).toBe(11);
		expect(cardPoints(card("oros", "3"))).toBe(10);
		expect(cardPoints(card("oros", "12"))).toBe(4);
		expect(cardPoints(card("oros", "2"))).toBe(0);
	});

	it("manda el triunfo sobre el palo de salida y éste sobre el resto", () => {
		const led = card("oros", "1");
		// Triunfo copas: una sota de copas gana al as de oros.
		expect(trickStrength(card("copas", "10"), "copas", led.suit)).toBeGreaterThan(
			trickStrength(led, "copas", led.suit),
		);
		// Un as de otro palo no gana ni al dos de oros que salió.
		expect(trickStrength(card("espadas", "1"), "copas", led.suit)).toBeLessThan(
			trickStrength(card("oros", "2"), "copas", led.suit),
		);
	});

	it("dentro del mismo palo, el as gana al rey y el tres al rey", () => {
		expect(trickStrength(card("oros", "1"), "copas", "oros")).toBeGreaterThan(
			trickStrength(card("oros", "12"), "copas", "oros"),
		);
		expect(trickStrength(card("oros", "3"), "copas", "oros")).toBeGreaterThan(
			trickStrength(card("oros", "12"), "copas", "oros"),
		);
	});

	it("no deja jugar fuera de turno ni una carta que no está en la mano", () => {
		const state = createTrickGame("tute", 3);
		const other = state.hands[1][0];
		expect(playCard(state, other.id)).toEqual(state);
		expect(playCard(state, "espanola:oros:99")).toEqual(state);
	});

	it("obliga a asistir al palo de salida si se tiene", () => {
		const state = withHands(
			[[card("oros", "1"), card("oros", "5"), card("bastos", "2")], [card("oros", "12"), card("copas", "4")]],
			"espadas",
		);
		const played = playCard(state, "espanola:oros:1");
		expect(played.trick).toHaveLength(1);
		const legal = legalCards(played).map((entry) => entry.id);
		expect(legal).toEqual(["espanola:oros:12"]);

		// Intentar descartar copas con oros en mano no cambia nada.
		expect(playCard(played, "espanola:copas:4")).toEqual(played);
	});

	it("sin palo de salida se puede tirar cualquier carta", () => {
		const state = withHands(
			[[card("oros", "1")], [card("copas", "4"), card("bastos", "7")]],
			"espadas",
		);
		const played = playCard(state, "espanola:oros:1");
		expect(legalCards(played)).toHaveLength(2);
	});

	it("resuelve la baza, suma puntos y da la salida al ganador", () => {
		const state = withHands(
			[[card("oros", "1"), card("oros", "2")], [card("copas", "12"), card("copas", "3")]],
			"copas",
		);
		const played = playCard(playCard(state, "espanola:oros:1"), "espanola:copas:12");

		expect(played.trick).toEqual([]);
		expect(played.tricks).toEqual([0, 1]);
		// As de oros (11) más rey de copas (4): el triunfo se lleva la baza.
		expect(played.score).toEqual([0, 15]);
		expect(played.turn).toBe(1);
		expect(played.lastTrickWinner).toBe(1);
	});

	it("la última baza vale diez más y cierra la partida", () => {
		const state = withHands(
			[[card("oros", "2")], [card("oros", "12")]],
			"copas",
		);
		const played = playCard(playCard(state, "espanola:oros:2"), "espanola:oros:12");

		expect(played.finished).toBe(true);
		// Rey de oros: 4 puntos de carta más 10 de la última baza.
		expect(played.score).toEqual([0, 4 + LAST_TRICK_POINTS]);
		expect(winnerOf(played)).toBe(1);
	});

	it("una partida completa reparte todos los puntos y no se queda colgada", () => {
		let state = createTrickGame("tute", 5);
		let guard = 0;
		while (!state.finished && guard < 100) {
			const playable = legalCards(state)[0];
			state = playCard(state, playable.id);
			guard += 1;
		}
		expect(state.finished).toBe(true);
		expect(guard).toBeLessThanOrEqual(6);
		expect(state.tricks[0] + state.tricks[1]).toBe(3);
		expect(state.hands[0]).toHaveLength(0);
		expect(state.hands[1]).toHaveLength(0);
		expect(winnerOf(state)).not.toBe(undefined);
	});
});
