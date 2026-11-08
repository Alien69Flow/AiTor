/**
 * Solitario Klondike: reparto, movimientos legales y victoria.
 *
 * Las reglas que hacen que un solitario sea un solitario y no un montón de
 * cartas son tres: en el tablero se baja alternando color y un escalón cada vez,
 * a una columna vacía sólo entra un rey, y en las fundaciones se sube desde el
 * as del palo que toca. Todo lo demás —cuántas veces se recicla el mazo, si se
 * reparte de una o de tres— es variante, y aquí está fijado para que la partida
 * se pueda reproducir con la semilla.
 *
 * El estado guarda cuántas cartas de cada columna están boca abajo. Es lo único
 * que no se puede deducir de las cartas, y sin ello la interfaz no sabría qué
 * enseñar ni cuándo destapar la siguiente al vaciar una columna.
 */

import { buildDeck, shuffle, type PlayingCard } from "./decks";

export type Suit = "corazones" | "diamantes" | "treboles" | "picas";
export const SUITS: readonly Suit[] = ["corazones", "diamantes", "treboles", "picas"];

const isRed = (suit: string) => suit === "corazones" || suit === "diamantes";

const RANK: Record<string, number> = {
	A: 1,
	"2": 2,
	"3": 3,
	"4": 4,
	"5": 5,
	"6": 6,
	"7": 7,
	"8": 8,
	"9": 9,
	"10": 10,
	J: 11,
	Q: 12,
	K: 13,
};

export const rankOf = (card: PlayingCard): number => RANK[card.rank] ?? 0;

/** Columnas del tablero con su tramo boca abajo. */
export interface Column {
	cards: PlayingCard[];
	/** Cuántas cartas del principio no se ven. */
	hidden: number;
}

export interface SolitaireState {
	stock: PlayingCard[];
	waste: PlayingCard[];
	/** Cuatro fundaciones, una por palo en el orden de `SUITS`. */
	foundations: PlayingCard[][];
	tableau: Column[];
	moves: number;
	recycles: number;
	seed: number;
}

/** Reparto clásico: la columna `n` lleva `n + 1` cartas y sólo la última se ve. */
export function createSolitaire(seed = 1): SolitaireState {
	const deck = shuffle(buildDeck("frances"), seed);
	const tableau: Column[] = [];
	let cursor = 0;
	for (let index = 0; index < 7; index += 1) {
		const cards = deck.slice(cursor, cursor + index + 1);
		cursor += index + 1;
		tableau.push({ cards, hidden: Math.max(0, cards.length - 1) });
	}
	return {
		stock: deck.slice(cursor).reverse(),
		waste: [],
		foundations: [[], [], [], []],
		tableau,
		moves: 0,
		recycles: 0,
		seed,
	};
}

/** Se ve la última carta de la columna, si queda alguna. */
export const columnTop = (column: Column): PlayingCard | undefined => column.cards[column.cards.length - 1];

/** ¿Entra esta carta en esta columna del tablero? */
export function canPlaceOnColumn(card: PlayingCard, column: Column): boolean {
	const top = columnTop(column);
	if (!top) return card.rank === "K";
	return isRed(card.suit) !== isRed(top.suit) && rankOf(card) === rankOf(top) - 1;
}

/** Índice de fundación de un palo. */
export function foundationIndex(suit: string): number {
	return Math.max(0, SUITS.indexOf(suit as Suit));
}

/** ¿Entra esta carta en esta fundación? As primero y siempre el mismo palo. */
export function canPlaceOnFoundation(card: PlayingCard, foundation: PlayingCard[]): boolean {
	const expected = foundation.length + 1;
	if (expected > 13) return false;
	if (foundation.length === 0) return card.rank === "A";
	const topCard = foundation[foundation.length - 1];
	return topCard.suit === card.suit && rankOf(card) === expected;
}

/** Recicla el descarte cuando el mazo se agota. */
export function drawStock(state: SolitaireState): SolitaireState {
	if (state.stock.length === 0) {
		if (state.waste.length === 0) return state;
		return {
			...state,
			stock: [...state.waste].reverse(),
			waste: [],
			recycles: state.recycles + 1,
			moves: state.moves + 1,
		};
	}

	const card = state.stock[0];
	return {
		...state,
		stock: state.stock.slice(1),
		waste: [...state.waste, card],
		moves: state.moves + 1,
	};
}

/** Destapa la siguiente carta de una columna si la de arriba ya se ha ido. */
function reveal(column: Column): Column {
	const hidden = Math.min(column.hidden, column.cards.length);
	if (hidden > 0 && hidden === column.cards.length) {
		return { ...column, hidden: hidden - 1 };
	}
	return { ...column, hidden };
}

/** Descarte a tablero. */
export function moveWasteToColumn(state: SolitaireState, index: number): SolitaireState {
	const card = state.waste[state.waste.length - 1];
	const column = state.tableau[index];
	if (!card || !column || !canPlaceOnColumn(card, column)) return state;

	const tableau = state.tableau.map((entry, position) =>
		position === index ? reveal({ ...entry, cards: [...entry.cards, card] }) : entry,
	);
	return {
		...state,
		waste: state.waste.slice(0, -1),
		tableau,
		moves: state.moves + 1,
	};
}

/** Descarte a fundación. */
export function moveWasteToFoundation(state: SolitaireState, index: number): SolitaireState {
	const card = state.waste[state.waste.length - 1];
	const foundation = state.foundations[index];
	if (!card || !foundation || !canPlaceOnFoundation(card, foundation)) return state;

	const foundations = state.foundations.map((entry, position) =>
		position === index ? [...entry, card] : entry,
	);
	return {
		...state,
		waste: state.waste.slice(0, -1),
		foundations,
		moves: state.moves + 1,
	};
}

/** Columna a columna: sólo el tramo visible, y respetando el escalón. */
export function moveColumnToColumn(
	state: SolitaireState,
	from: number,
	to: number,
	count = 1,
): SolitaireState {
	const source = state.tableau[from];
	const target = state.tableau[to];
	if (!source || !target || from === to) return state;

	const visible = source.cards.length - source.hidden;
	const take = Math.max(1, Math.floor(count));
	if (take > visible) return state;

	const moving = source.cards.slice(source.cards.length - take);
	const head = moving[0];
	if (!head || !canPlaceOnColumn(head, target)) return state;

	const tableau = state.tableau.map((entry, position) => {
		if (position === from) {
			const cards = entry.cards.slice(0, entry.cards.length - take);
			return reveal({ ...entry, cards, hidden: Math.min(entry.hidden, cards.length) });
		}
		if (position === to) return { ...entry, cards: [...entry.cards, ...moving] };
		return entry;
	});

	return { ...state, tableau, moves: state.moves + 1 };
}

/** Columna a fundación. */
export function moveColumnToFoundation(state: SolitaireState, from: number, index: number): SolitaireState {
	const source = state.tableau[from];
	const foundation = state.foundations[index];
	const card = source ? columnTop(source) : undefined;
	if (!source || !foundation || !card || source.cards.length !== source.hidden + 1) return state;
	if (!canPlaceOnFoundation(card, foundation)) return state;

	const tableau = state.tableau.map((entry, position) =>
		position === from
			? reveal({ ...entry, cards: entry.cards.slice(0, -1), hidden: Math.min(entry.hidden, entry.cards.length - 1) })
			: entry,
	);
	const foundations = state.foundations.map((entry, position) =>
		position === index ? [...entry, card] : entry,
	);

	return { ...state, tableau, foundations, moves: state.moves + 1 };
}

/** Ganado: las cuatro fundaciones con trece cartas. */
export function isWon(state: SolitaireState): boolean {
	return state.foundations.every((foundation) => foundation.length === 13);
}
