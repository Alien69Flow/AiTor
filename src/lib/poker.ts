/**
 * Póker: evaluación de manos de cinco cartas.
 *
 * Es el único trozo de póker que conviene tener en un motor puro. La partida
 * —apuestas, ciegas, farol— es un juego de dinero y sólo tiene sentido con un
 * riel aprobado; la mano, en cambio, es aritmética y se puede comprobar entera.
 *
 * La comparación va por categoría y después por desempates en orden, que es
 * exactamente cómo se resuelve en una mesa: primero manda la categoría y, a
 * igualdad, la carta más alta que distingue una mano de otra.
 */

import type { PlayingCard } from "./decks";

export const HAND_CATEGORIES = [
	"carta-alta",
	"pareja",
	"dos-pares",
	"trio",
	"escalera",
	"color",
	"full",
	"poker",
	"escalera-color",
] as const;

export type HandCategory = (typeof HAND_CATEGORIES)[number];

export interface HandScore {
	category: HandCategory;
	/** Peso de la categoría: más alto gana. */
	rank: number;
	/** Cartas que desempatan, de más a menos importante. */
	tiebreak: number[];
}

const RANK_VALUE: Record<string, number> = {
	A: 14,
	K: 13,
	Q: 12,
	J: 11,
	"10": 10,
	"9": 9,
	"8": 8,
	"7": 7,
	"6": 6,
	"5": 5,
	"4": 4,
	"3": 3,
	"2": 2,
};

export function rankValue(card: PlayingCard): number {
	return RANK_VALUE[card.rank] ?? 0;
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** Mano de cinco. Cualquier otro tamaño es un error de programación. */
export function evaluateHand(cards: readonly PlayingCard[]): HandScore {
	if (cards.length !== 5) {
		throw new RangeError("una mano de póker tiene cinco cartas");
	}

	const values = cards.map(rankValue).sort((a, b) => b - a);
	const counts = new Map<number, number>();
	for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);

	// Grupos ordenados por número de repeticiones y después por valor.
	const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
	const flush = cards.every((card) => card.suit === cards[0].suit);

	// Escalera con el as abajo (A-2-3-4-5): el as vale uno y la mano es escalera
	// al cinco, no al as.
	const straightHigh = (sorted: number[]): number => {
		const unique = [...new Set(sorted)];
		if (unique.length !== 5) return 0;
		if (unique[0] - unique[4] === 4) return unique[0];
		if (unique[0] === 14 && unique[1] === 5 && unique[4] === 2) return 5;
		return 0;
	};
	const high = straightHigh(values);

	if (flush && high) return score("escalera-color", [high]);
	if (groups[0][1] === 4) return score("poker", [groups[0][0], groups[1][0]]);
	if (groups[0][1] === 3 && groups[1][1] === 2) return score("full", [groups[0][0], groups[1][0]]);
	if (flush) return score("color", values);
	if (high) return score("escalera", [high]);
	if (groups[0][1] === 3) {
		return score("trio", [groups[0][0], ...groups.slice(1).map((group) => group[0])]);
	}
	if (groups[0][1] === 2 && groups[1][1] === 2) {
		const pairs = [groups[0][0], groups[1][0]].sort((a, b) => b - a);
		return score("dos-pares", [...pairs, groups[2][0]]);
	}
	if (groups[0][1] === 2) {
		return score("pareja", [groups[0][0], ...groups.slice(1).map((group) => group[0])]);
	}
	return score("carta-alta", values);
}

function score(category: HandCategory, tiebreak: number[]): HandScore {
	return { category, rank: HAND_CATEGORIES.indexOf(category), tiebreak };
}

/** Positivo si gana `a`, negativo si gana `b`, cero si empatan. */
export function compareHands(a: HandScore, b: HandScore): number {
	if (a.rank !== b.rank) return a.rank - b.rank;
	for (let index = 0; index < Math.max(a.tiebreak.length, b.tiebreak.length); index += 1) {
		const left = a.tiebreak[index] ?? 0;
		const right = b.tiebreak[index] ?? 0;
		if (left !== right) return left - right;
	}
	return 0;
}

/** Suma bruta de la mano: sirve para ordenar torneos y para desempatar por mesa. */
export function handValue(hand: HandScore): number {
	return hand.rank * 1_000_000 + sum(hand.tiebreak.map((value, index) => value * 10 ** (4 - index)));
}
