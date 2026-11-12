import { describe, expect, it } from "vitest";

import type { PlayingCard } from "./decks";
import { UNO_HAND, canPlay, createUno, drawUno, playUno } from "./uno";

const card = (suit: string, rank: string): PlayingCard => ({
	id: `uno:${suit}:${rank}`,
	kind: "uno",
	suit,
	rank,
});

/** Mesa mínima: rojo arriba, turno del jugador 0. */
const base = () => ({
	...createUno(4),
	hands: [
		[card("rojo", "5a"), card("rojo", "9a")],
		[card("verde", "7a")],
	] as [PlayingCard[], PlayingCard[]],
	discard: [card("rojo", "3a")],
	color: "rojo" as const,
	turn: 0 as const,
});

describe("uno", () => {
	it("reparte siete y no pierde cartas por el camino", () => {
		const state = createUno(2);
		expect(state.hands[0]).toHaveLength(UNO_HAND);
		expect(state.hands[1]).toHaveLength(UNO_HAND);
		expect(state.discard).toHaveLength(1);
		const total =
			state.hands[0].length + state.hands[1].length + state.drawPile.length + state.discard.length;
		expect(total).toBe(108);
		expect(state.discard[0].suit).not.toBe("comodin");
	});

	it("se juega a color o a número", () => {
		expect(canPlay(card("rojo", "9a"), { color: "rojo" })).toBe(true);
		expect(canPlay(card("azul", "5b"), { color: "rojo", top: card("rojo", "5a") })).toBe(true);
		expect(canPlay(card("azul", "4a"), { color: "rojo", top: card("rojo", "5a") })).toBe(false);
		expect(canPlay(card("comodin", "1"), { color: "azul" })).toBe(true);
	});

	it("el comodín exige color y lo fija", () => {
		const state = {
			...base(),
			hands: [[card("comodin", "1"), card("rojo", "9a")], [card("verde", "7a")]] as [
				PlayingCard[],
				PlayingCard[],
			],
		};
		// Sin color elegido no se juega.
		expect(playUno(state, "uno:comodin:1")).toEqual(state);

		const played = playUno(state, "uno:comodin:1", "azul");
		expect(played.color).toBe("azul");
		expect(played.hands[0]).toHaveLength(1);
		expect(played.turn).toBe(1);
		expect(played.winner).toBe(null);
	});

	it("el roba dos roba al rival, le quita el turno y descuenta del mazo", () => {
		const state = {
			...base(),
			hands: [[card("rojo", "roba2a"), card("rojo", "9a")], [card("verde", "7a")]] as [
				PlayingCard[],
				PlayingCard[],
			],
		};
		const played = playUno(state, "uno:rojo:roba2a");
		expect(played.hands[1]).toHaveLength(3);
		expect(played.drawPile).toHaveLength(state.drawPile.length - 2);
		expect(played.turn).toBe(0);
		expect(played.winner).toBe(null);
	});

	it("el salto con dos jugadores deja el turno en quien tiró", () => {
		const state = {
			...base(),
			hands: [[card("rojo", "saltaa"), card("rojo", "9a")], [card("verde", "7a")]] as [
				PlayingCard[],
				PlayingCard[],
			],
		};
		const played = playUno(state, "uno:rojo:saltaa");
		expect(played.turn).toBe(0);
		expect(played.hands[1]).toHaveLength(1);
	});

	it("quedarse sin cartas es ganar", () => {
		const state = {
			...base(),
			hands: [[card("rojo", "5a")], [card("verde", "7a")]] as [PlayingCard[], PlayingCard[]],
		};
		const played = playUno(state, "uno:rojo:5a");
		expect(played.winner).toBe(0);
		expect(played.hands[0]).toHaveLength(0);
	});

	it("una jugada ilegal no cambia el estado", () => {
		const state = {
			...base(),
			hands: [[card("azul", "4a"), card("rojo", "9a")], [card("verde", "7a")]] as [
				PlayingCard[],
				PlayingCard[],
			],
		};
		expect(playUno(state, "uno:azul:4a")).toEqual(state);
		expect(playUno(state, "uno:rojo:99")).toEqual(state);
	});

	it("robar suma una carta y pasa el turno", () => {
		const state = base();
		const drawn = drawUno(state);
		expect(drawn.hands[0]).toHaveLength(state.hands[0].length + 1);
		expect(drawn.drawPile).toHaveLength(state.drawPile.length - 1);
		expect(drawn.turn).toBe(1);
	});

	it("es determinista con la misma semilla", () => {
		const a = createUno(31);
		const b = createUno(31);
		expect(a.hands).toEqual(b.hands);
		expect(a.drawPile).toEqual(b.drawPile);
		expect(a.discard).toEqual(b.discard);
	});
});
