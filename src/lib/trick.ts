/**
 * Bazas españolas: guiñote y tute sobre la misma baraja de 40.
 *
 * Los dos juegos son el mismo esqueleto —reparto, obligación de asistir al
 * palo, triunfo que se lleva la baza y puntos por carta— así que comparten
 * motor y sólo cambian el tamaño de mano y cómo se llama el triunfo. Escribir
 * dos motores habría duplicado la parte delicada, que es justo la resolución de
 * la baza.
 *
 * La jerarquía es la de la baraja española de verdad, no la del número:
 * as, tres, rey, caballo, sota, siete, seis, cinco, cuatro, dos. Ordenar por
 * número haría que el siete ganara al as y el juego no se parecería a nada.
 *
 * Lo que este motor NO hace, y conviene decirlo: no hay cantos ni envites
 * (las veinte y las cuarenta del tute, el envite del guiñote). Eso es una capa
 * de apuestas encima de la baza, y meterla aquí sin riel de premios sería
 * prometer algo que la pestaña no puede pagar. La baza y el tanteo son
 * completos y comprobables; el canto queda pendiente y declarado.
 */

import { deal, shuffle, spanishForty, type PlayingCard } from "./decks";

export type TrickVariant = "guinote" | "tute";
export type SpanishSuit = "oros" | "copas" | "espadas" | "bastos";

/** Puntos por carta al tanteo (los mismos en guiñote y en tute). */
const CARD_POINTS: Record<string, number> = { "1": 11, "3": 10, "12": 4, "11": 3, "10": 2 };

/** De más fuerte a más débil, dentro del palo que manda. */
const STRENGTH: readonly string[] = ["1", "3", "12", "11", "10", "7", "6", "5", "4", "2"];

/** Lo que vale la última baza: quien la gana se lleva diez de golpe. */
export const LAST_TRICK_POINTS = 10;

/** Cartas en mano: cuatro en guiñote, tres en tute. */
export const HAND_SIZE: Record<TrickVariant, number> = { guinote: 4, tute: 3 };

export interface TrickState {
	variant: TrickVariant;
	/** Palo que manda. En guiñote es la pinta; en tute, el palo de triunfo. */
	trump: SpanishSuit;
	hands: [PlayingCard[], PlayingCard[]];
	/** Cartas jugadas en la baza en curso, en orden de salida. */
	trick: PlayingCard[];
	/** A quién le toca. */
	turn: 0 | 1;
	/** Bazas ganadas por cada uno. */
	tricks: [number, number];
	/** Puntos por cada uno. */
	score: [number, number];
	lastTrickWinner: 0 | 1 | null;
	/** Manos vacías: la partida ha terminado. */
	finished: boolean;
	seed: number;
}

export function cardPoints(card: PlayingCard): number {
	return CARD_POINTS[card.rank] ?? 0;
}

/**
 * Fuerza relativa de una carta en la baza: primero manda ser triunfo, después
 * asistir al palo de salida, y sólo entonces el valor de la carta. Una carta
 * de otro palo no puede ganar nunca, aunque sea un as.
 */
export function trickStrength(card: PlayingCard, trump: SpanishSuit, ledSuit: string | null): number {
	const category = card.suit === trump ? 2 : ledSuit && card.suit === ledSuit ? 1 : 0;
	const order = STRENGTH.indexOf(card.rank);
	// El as es el índice 0 y es el más fuerte: se invierte para que sume más.
	return category * 100 + (STRENGTH.length - (order < 0 ? STRENGTH.length : order));
}

/** Palo con más cartas: es la pinta del guiñote, y así se canta en la mesa. */
export function trumpOf(deck: readonly PlayingCard[]): SpanishSuit {
	const counts = new Map<string, number>();
	for (const card of deck) {
		counts.set(card.suit, (counts.get(card.suit) ?? 0) + 1);
	}
	let best: SpanishSuit = "oros";
	let bestCount = -1;
	for (const suit of ["oros", "copas", "espadas", "bastos"] as const) {
		const count = counts.get(suit) ?? 0;
		if (count > bestCount) {
			best = suit;
			bestCount = count;
		}
	}
	return best;
}

/** Partida nueva: barajada con semilla, repartida por turnos y pinta decidida. */
export function createTrickGame(variant: TrickVariant, seed = 1): TrickState {
	const deck = shuffle(spanishForty(), seed);
	const { hands } = deal(deck, 2, HAND_SIZE[variant]);
	return {
		variant,
		trump: trumpOf(deck),
		hands: [hands[0] ?? [], hands[1] ?? []],
		trick: [],
		turn: 0,
		tricks: [0, 0],
		score: [0, 0],
		lastTrickWinner: null,
		finished: false,
		seed,
	};
}

/**
 * Cartas que se pueden tirar ahora.
 *
 * Si sales, cualquiera. Si respondes y tienes del palo de salida, estás
 * obligado a asistir: es la regla que evita que uno se guarde el triunfo
 * descartando basura en cada baza.
 */
export function legalCards(state: TrickState): PlayingCard[] {
	if (state.finished) return [];
	const hand = state.hands[state.turn];
	const led = state.trick[0];
	if (!led) return [...hand];
	const following = hand.filter((card) => card.suit === led.suit);
	return following.length ? following : [...hand];
}

/**
 * Juega una carta del jugador al que le toca.
 *
 * Una jugada ilegal no lanza: devuelve el mismo estado. Un motor que revienta
 * con un clic fuera de turno obliga a cada interfaz a envolverlo en try/catch y
 * el fallo acaba apareciendo como pantalla en blanco.
 */
export function playCard(state: TrickState, cardId: string): TrickState {
	if (state.finished) return state;
	const hand = state.hands[state.turn];
	const card = hand.find((entry) => entry.id === cardId);
	if (!card) return state;
	if (!legalCards(state).some((entry) => entry.id === cardId)) return state;

	const hands: [PlayingCard[], PlayingCard[]] = [
		state.hands[0].filter((entry) => entry.id !== cardId),
		state.hands[1].filter((entry) => entry.id !== cardId),
	];
	const trick = [...state.trick, card];

	// Sólo con dos jugadores la baza se cierra en cuanto responde el segundo.
	if (trick.length < 2) {
		return { ...state, hands, trick, turn: (1 - state.turn) as 0 | 1 };
	}

	const ledSuit = trick[0].suit;
	const [first, second] = trick;
	const winner: 0 | 1 =
		trickStrength(second, state.trump, ledSuit) > trickStrength(first, state.trump, ledSuit) ? 1 : 0;

	// Quien salió es el jugador 0 del turno anterior; para saber a quién se le
	// suman los puntos basta con comparar fuerzas, y el turno de salida pasa al
	// ganador de la baza.
	const points = trick.reduce((total, entry) => total + cardPoints(entry), 0);
	const tricks: [number, number] = [state.tricks[0], state.tricks[1]];
	tricks[winner] += 1;

	const score: [number, number] = [state.score[0], state.score[1]];
	score[winner] += points;

	const finished = hands[0].length === 0 && hands[1].length === 0;
	if (finished) {
		// La última baza vale diez más: por eso se decide al final y no por baza.
		score[winner] += LAST_TRICK_POINTS;
	}

	return {
		...state,
		hands,
		trick: [],
		turn: winner,
		tricks,
		score,
		lastTrickWinner: winner,
		finished,
	};
}

/** Ganador por puntos, o `null` si hay empate (que en el tute real se desempata). */
export function winnerOf(state: TrickState): 0 | 1 | null {
	if (!state.finished) return null;
	if (state.score[0] === state.score[1]) return null;
	return state.score[0] > state.score[1] ? 0 : 1;
}
