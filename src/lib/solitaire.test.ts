import { describe, expect, it } from "vitest";

import type { PlayingCard } from "./decks";
import {
	SUITS,
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
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

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

	it("la fundación es de un solo palo y empieza por el as", () => {
		expect(canPlaceOnFoundation(card("picas", "A"), [], "picas")).toBe(true);
		expect(canPlaceOnFoundation(card("picas", "2"), [], "picas")).toBe(false);
		expect(canPlaceOnFoundation(card("picas", "2"), [card("picas", "A")], "picas")).toBe(true);
		expect(canPlaceOnFoundation(card("treboles", "2"), [card("picas", "A")], "picas")).toBe(false);
		// El as de diamantes no entra en la fundación de corazones.
		expect(canPlaceOnFoundation(card("diamantes", "A"), [], "corazones")).toBe(false);
	});

	it("roba del mazo y recicla el descarte al agotarlo", () => {
		const state = {
			...createSolitaire(3),
			stock: [card("picas", "A")],
			waste: [card("treboles", "2")],
		};
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
			tableau: [column([card("picas", "K")]), column([card("diamantes", "K")])],
			waste: [card("corazones", "Q")],
		};
		const moved = moveWasteToColumn(state, 0);
		expect(moved.tableau[0].cards).toHaveLength(2);
		expect(moved.waste).toHaveLength(0);

		// Sobre un rey rojo no entra una dama roja.
		expect(moveWasteToColumn(state, 1)).toEqual(state);
	});

	it("el descarte entra en su fundación y no en la de otro palo", () => {
		const state = { ...createSolitaire(5), waste: [card("diamantes", "A")] };
		expect(moveWasteToFoundation(state, 0)).toEqual(state);

		const moved = moveWasteToFoundation(state, 1);
		expect(moved.foundations[1]).toHaveLength(1);
		expect(moved.waste).toHaveLength(0);
	});

	it("mueve varias cartas visibles y destapa la de debajo", () => {
		const state = {
			...createSolitaire(6),
			tableau: [
				column([card("picas", "K"), card("corazones", "Q"), card("picas", "J")], 1),
				column([card("treboles", "K")]),
			],
		};
		const moved = moveColumnToColumn(state, 0, 1, 2);
		expect(moved.tableau[0].cards).toHaveLength(1);
		expect(moved.tableau[0].hidden).toBe(0);
		expect(moved.tableau[1].cards).toHaveLength(3);
	});

	it("no deja mover una carta tapada ni saltarse la alternancia", () => {
		const hidden = { ...createSolitaire(7), tableau: [column([card("picas", "K")], 1), column([])] };
		expect(moveColumnToColumn(hidden, 0, 1, 1)).toEqual(hidden);

		const sameColor = {
			...createSolitaire(7),
			tableau: [column([card("diamantes", "K")]), column([card("picas", "Q")])],
		};
		expect(moveColumnToColumn(sameColor, 0, 1, 1)).toEqual(sameColor);
	});

	it("no está ganado al empezar y sí con las cuatro fundaciones llenas", () => {
		const state = createSolitaire(8);
		expect(isWon(state)).toBe(false);

		const won = {
			...state,
			foundations: SUITS.map((suit) => RANKS.map((rank) => card(suit, rank))),
		};
		expect(isWon(won)).toBe(true);
	});
});
