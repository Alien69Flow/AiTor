/**
 * Barajas del arcade: francesa, española y Uno, con reparto determinista.
 *
 * Los tres juegos de cartas que pedía el catálogo comparten aquí la misma
 * pregunta: «¿qué cartas hay y cómo se reparten sin que dos manos puedan ser
 * la misma?». Lo que cambia entre barajas es el mazo, no el reparto.
 *
 * Por qué la mezcla va con semilla: una partida tiene que poder repetirse para
 * depurar y para el reto diario, donde todo el mundo juega el mismo mazo. Con
 * `Math.random` no hay forma de comprobar un fallo que ocurrió una vez.
 */

export type DeckKind = "frances" | "espanola" | "uno";

export interface PlayingCard {
	/** Identificador único dentro del mazo (`frances:oros:1`…). */
	id: string;
	kind: DeckKind;
	suit: string;
	rank: string;
}

const FRENCH_SUITS = ["corazones", "diamantes", "treboles", "picas"] as const;
const FRENCH_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;

// La española de 48: del 1 al 12 en los cuatro palos. La de 40 es la misma sin
// los ochos y los nueves, y se obtiene filtrando, no con otro mazo distinto.
const SPANISH_SUITS = ["oros", "copas", "espadas", "bastos"] as const;
const SPANISH_RANKS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;

const UNO_COLORS = ["rojo", "amarillo", "verde", "azul"] as const;
const UNO_ACTIONS = ["salta", "reversa", "roba2"] as const;

function card(kind: DeckKind, suit: string, rank: string): PlayingCard {
	return { id: `${kind}:${suit}:${rank}`, kind, suit, rank };
}

/**
 * Mazo completo de cada baraja.
 *
 * Francesa 52 · española 48 · Uno 108 (100 de color + 4 comodines + 4 roba
 * cuatro), que son los tamaños reales, no aproximaciones.
 */
export function buildDeck(kind: DeckKind): PlayingCard[] {
	if (kind === "frances") {
		return FRENCH_SUITS.flatMap((suit) => FRENCH_RANKS.map((rank) => card(kind, suit, rank)));
	}

	if (kind === "espanola") {
		return SPANISH_SUITS.flatMap((suit) => SPANISH_RANKS.map((rank) => card(kind, suit, rank)));
	}

	const deck: PlayingCard[] = [];
	for (const color of UNO_COLORS) {
		deck.push(card(kind, color, "0"));
		for (let value = 1; value <= 9; value += 1) {
			// En el Uno cada número del 1 al 9 está dos veces por color.
			deck.push(card(kind, color, `${value}a`));
			deck.push(card(kind, color, `${value}b`));
		}
		for (const action of UNO_ACTIONS) {
			deck.push(card(kind, color, `${action}a`));
			deck.push(card(kind, color, `${action}b`));
		}
	}
	for (const suit of ["comodin", "roba4"] as const) {
		for (let copy = 1; copy <= 4; copy += 1) deck.push(card(kind, suit, String(copy)));
	}
	return deck;
}

/** PRNG de 32 bits: rápido, determinista y suficiente para barajar. */
function mulberry32(seed: number): () => number {
	let state = (Math.floor(seed) || 0) >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
	};
}

/** Barajado Fisher-Yates sin mutar la entrada. Misma semilla, mismo orden. */
export function shuffle<T>(items: readonly T[], seed: number): T[] {
	const result = [...items];
	const random = mulberry32(seed);
	for (let index = result.length - 1; index > 0; index -= 1) {
		const swap = Math.floor(random() * (index + 1));
		[result[index], result[swap]] = [result[swap], result[index]];
	}
	return result;
}

/** Reparto por turnos, como en una mesa: una carta a cada mano por vuelta. */
export function deal(
	deck: readonly PlayingCard[],
	hands: number,
	perHand: number,
): { hands: PlayingCard[][]; rest: PlayingCard[] } {
	const count = Math.max(0, Math.floor(hands));
	const size = Math.max(0, Math.floor(perHand));
	const dealt: PlayingCard[][] = Array.from({ length: count }, () => []);
	const rest = [...deck];

	for (let round = 0; round < size; round += 1) {
		for (let hand = 0; hand < count; hand += 1) {
			const next = rest.shift();
			if (!next) return { hands: dealt, rest };
			dealt[hand].push(next);
		}
	}

	return { hands: dealt, rest };
}

/**
 * Baraja española de 40: la de 48 sin ochos ni nueves, que es la que se usa en
 * el mus y en la mayoría de juegos de mesa.
 */
export function spanishForty(): PlayingCard[] {
	return buildDeck("espanola").filter((entry) => entry.rank !== "8" && entry.rank !== "9");
}

/** Valor de una carta para comparar manos, por baraja. */
export function cardValue(entry: PlayingCard): number {
	if (entry.kind === "uno") {
		const digits = /^(\d)/.exec(entry.rank);
		if (digits) return Number(digits[1]);
		return entry.suit === "roba4" ? 50 : entry.suit === "comodin" ? 50 : 20;
	}

	if (entry.kind === "espanola") return Number(entry.rank) || 0;

	if (entry.rank === "A") return 1;
	if (entry.rank === "J" || entry.rank === "Q" || entry.rank === "K") return 10;
	return Number(entry.rank) || 0;
}
