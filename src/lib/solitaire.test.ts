import { describe, expect, it } from "vitest";

import type { PlayingCard } from "./decks";
import {
	canPlaceOnColumn,
	canPlaceOnFoundation,
	createSolitaire,
	drawStock,
	isWon,
	moveColumnToColumn,
	moveWasteToColumn,
	moveWasteToFoundation,
} from "./solitaire";

const card = (suit: string, rank: string): PlayingCard => ({
	id: `frances:${suit}:${rank}`,
	kind: "frances",
	suit,
	rank,
});

const column = (cards: PlayingCard[], hidden = 0) => ({ cards, hidden });

describe("solitario", () => {
	it("reparte 28 cartas en siete columnas y deja 24 en el mazo", () => {
		const state = createSolitaire(2);
		expect(state.tableau.map((entry) => entry.cards.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
		expect(state.tableau.map((entry) => entry.hidden)).toEqual([0, 1, 2, 3, 4, 5, 6]);
		expect(state.stock).toHaveLength(24);
		expect(state.waste).toHaveLength(0);
		expect(state.foundations.flat()).toHaveLength(0);
	});

	it("sólo entra un rey en una columna vacía", () => {
		expect(canPlaceOnColumn(card("picas", "K"), column([]))).toBe(true);
		expect(canPlaceOnColumn(card("picas", "Q"), column([]))).toBe(false);
	});

	it("en el tablero se baja alternando color", () => {
		expect(canPlaceOnColumn(card("corazones", "Q"), column([card("picas", "K")]))).toBe(true);
		expect(canPlaceOnColumn(card("treboles", "Q"), column([card("picas", "K")]))).toBe(false);
		// El escalón es de uno: la jota no va sobre el rey.
		expect(canPlaceOnColumn(card("corazones", "J"), column([card("picas", "K")]))).toBe(false);
	});

	it("en la fundación entra el as y después el mismo palo en orden", () => {
		expect(canPlaceOnFoundation(card("picas", "A"), [])).toBe(true);
		expect(canPlaceOnFoundation(card("picas", "2"), [])).toBe(false);
		expect(canPlaceOnFoundation(card("picas", "2"), [card("picas", "A")])).toBe(true);
		expect(canPlaceOnFoundation(card("treboles", "2"), [card("picas", "A")])).toBe(false);
	});

	it("roba del mazo y recicla el descarte al agotarlo", () => {
		const state = { ...createSolitaire(3), stock: [card("picas", "A")], waste: [card("oros" === "oros" ? "treboles" : "picas", "2")] };
		const drawn = drawStock(state);
		expect(drawn.waste).toHaveLength(2);
		expect(drawn.stock).toHaveLength(0);

		const recycled = drawStock(drawn);
		expect(recycled.stock).toHaveLength(2);
		expect(recycled.waste).toHaveLength(0);
		expect(recycled.recycles).toBe(1);
	});

	it("mueve el descarte a una columna válida y rechaza lo ilegal", () => {
		const state = {
			...createSolitaire(4),
			tableau: [column([card("picas", "K")]), ...createSolitaire(4).tableau.slice(1)],
			waste: [card("corazones", "Q")],
		};
		const moved = moveWasteToColumn(state, 0);
		expect(moved.tableau[0].cards).toHaveLength(2);
		expect(moved.waste).toHaveLength(0);

		expect(moveWasteToColumn(state, 1)).toEqual(state);
	});

	it("el descarte entra en su fundación y no en la de otro palo", () => {
		const state = { ...createSolitaire(5), waste: [card("diamantes", "A")] };
		expect(moveWasteToFoundation(state, 0)).toEqual(state);
		const moved = moveWasteToFoundation(state, 1);
		expect(moved.foundations[1]).toHaveLength(1);
		// El as ya está arriba: no se puede poner dos veces.
		expect(moveWasteToFoundation(moved, 1)).toEqual(moved);
	});

	it("mueve varias cartas visibles y destapa la de debajo", () => {
		const tableau = [
			column([card("picas", "K"), card("corazones", "Q"), card("picas", "J")], 1),
			column([card("corazones", "10")], 0),
		];
		const state = { ...createSolitaire(6), tableau };
		const moved = moveColumnToColumn(state, 0, 1, 2);
		expect(moved.tableau[0].cards).toHaveLength(1);
		expect(moved.tableau[0].hidden).toBe(0);
		expect(moved.tableau[1].cards).toHaveLength(3);
	});

	it("no deja mover una carta tapada", () => {
		const tableau = [column([card("picas", "K"), card("corazones", "Q")], 2), column([])];
		const state = { ...createSolitaire(7), tableau };
		expect(moveColumnToColumn(state, 0, 1, 1)).toEqual(state);
	});

	it("no está ganado al empezar y sí con las cuatro fundaciones llenas", () => {
		const state = createSolitaire(8);
		expect(isWon(state)).toBe(false);
		const won = {
			...state,
			foundations: [0, 1, 2, 3].map(() =>
				Array.from({ length: 13 }, (_, index) => card("picas", "A").rank ?? String(index)),
			),
		};
		expect(isWon(won as never)).toBe(true);
	});
});
