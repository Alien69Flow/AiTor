/**
 * Uno: motor de turnos sobre la baraja de 108 del módulo de barajas.
 *
 * Las cuatro reglas que deciden una partida son: se juega a color o a número,
 * el comodín siempre entra, el dos obliga a robar dos y el salto/reversa quita
 * el turno. Con dos jugadores la reversa y el salto hacen lo mismo —el turno
 * vuelve a quien tiró— y por eso se resuelven con la misma rama: no es un atajo,
 * es lo que pasa de verdad en una mesa de dos.
 *
 * El estado guarda el color activo aparte del descarte porque el comodín no
 * tiene color propio. Sin ese campo, la interfaz tendría que recordar el color
 * elegido por su cuenta y cualquier recarga lo perdería.
 */

import { buildDeck, deal, shuffle, type PlayingCard } from "./decks";

export type UnoColor = "rojo" | "amarillo" | "verde" | "azul";
export const UNO_COLORS: readonly UnoColor[] = ["rojo", "amarillo", "verde", "azul"];
/** Mano inicial: siete cartas por jugador, como el juego de mesa. */
export const UNO_HAND = 7;

export interface UnoState {
	hands: [PlayingCard[], PlayingCard[]];
	drawPile: PlayingCard[];
	discard: PlayingCard[];
	/** Color que hay que igualar ahora mismo. */
	color: UnoColor;
	turn: 0 | 1;
	winner: 0 | 1 | null;
	seed: number;
}

const isWild = (card: PlayingCard) => card.suit === "comodin" || card.suit === "roba4";
/** `5a` y `5b` son el mismo cinco: el sufijo sólo evita identificadores repetidos. */
const baseRank = (card: PlayingCard) => card.rank.replace(/[ab]$/, "");

const top = (cards: PlayingCard[]): PlayingCard | undefined => cards[cards.length - 1];

/** ¿Entra esta carta sobre la mesa actual? */
export function canPlay(card: PlayingCard, current: { color: UnoColor; top?: PlayingCard }): boolean {
	if (isWild(card)) return true;
	if (current.color === card.suit) return true;
	return Boolean(current.top) && baseRank(current.top as PlayingCard) === baseRank(card);
}

export function createUno(seed = 1): UnoState {
	const deck = shuffle(buildDeck("uno"), seed);
	const { hands, rest } = deal(deck, 2, UNO_HAND);

	// La primera carta no puede ser comodín: nadie ha elegido color todavía.
	const startIndex = rest.findIndex((card) => !isWild(card));
	const index = startIndex < 0 ? 0 : startIndex;
	const start = rest[index];
	const drawPile = rest.filter((_, position) => position !== index);

	return {
		hands: [hands[0] ?? [], hands[1] ?? []],
		drawPile,
		discard: start ? [start] : [],
		color: (start?.suit as UnoColor) ?? "rojo",
		turn: 0,
		winner: null,
		seed,
	};
}

/** Roba del mazo; si se agota, recicla el descarte menos su carta de arriba. */
function takeCard(
	pile: PlayingCard[],
	discard: PlayingCard[],
	seed: number,
): [PlayingCard | null, PlayingCard[]] {
	if (pile.length) return [pile[0], pile.slice(1)];
	if (discard.length <= 1) return [null, pile];
	const recycled = shuffle(discard.slice(0, -1), seed);
	return [recycled[0] ?? null, recycled.slice(1)];
}

/**
 * Juega una carta del jugador al que le toca.
 *
 * Un comodín sin color elegido no se acepta: dejarlo pasar pondría la mesa en un
 * color que no existe y la siguiente jugada sería imposible de calcular.
 *
 * El roba dos y el roba cuatro sacan cartas del mazo, así que el mazo que se
 * devuelve es el que queda tras esos robos. Devolver el original duplicaría las
 * cartas: aparecerían en la mano del rival y otra vez en el montón.
 */
export function playUno(state: UnoState, cardId: string, chosenColor?: UnoColor): UnoState {
	if (state.winner !== null) return state;
	const hand = state.hands[state.turn];
	const card = hand.find((entry) => entry.id === cardId);
	if (!card) return state;
	if (!canPlay(card, { color: state.color, top: top(state.discard) })) return state;
	if (isWild(card) && (!chosenColor || !UNO_COLORS.includes(chosenColor))) return state;

	const discard = [...state.discard, card];
	let hands: [PlayingCard[], PlayingCard[]] = [
		state.hands[0].filter((entry) => entry.id !== cardId),
		state.hands[1].filter((entry) => entry.id !== cardId),
	];
	let pile = state.drawPile;
	const color: UnoColor = isWild(card) && chosenColor ? chosenColor : (card.suit as UnoColor);
	const rank = isWild(card) ? card.suit : baseRank(card);

	const opponent = (1 - state.turn) as 0 | 1;
	let turn: 0 | 1 = opponent;

	// El roba dos y el roba cuatro roban y además quitan el turno.
	const forced = rank === "roba2" ? 2 : rank === "roba4" ? 4 : 0;
	if (forced > 0) {
		const drawn = [...hands[opponent]];
		for (let count = 0; count < forced; count += 1) {
			const [next, rest] = takeCard(pile, discard, state.seed + count);
			if (!next) break;
			pile = rest;
			drawn.push(next);
		}
		hands = opponent === 0 ? [drawn, hands[1]] : [hands[0], drawn];
		turn = state.turn;
	}

	// Salto y reversa: con dos jugadores el turno se queda donde está.
	if (rank === "salta" || rank === "reversa") turn = state.turn;

	const winner = hands[state.turn].length === 0 ? state.turn : null;

	return {
		...state,
		hands,
		drawPile: pile,
		discard,
		color,
		turn: winner === null ? turn : state.turn,
		winner,
	};
}

/** Roba una carta y pasa el turno. */
export function drawUno(state: UnoState): UnoState {
	if (state.winner !== null) return state;
	const [card, pile] = takeCard(state.drawPile, state.discard, state.seed + 1);
	if (!card) return state;

	const hands: [PlayingCard[], PlayingCard[]] = [
		state.turn === 0 ? [...state.hands[0], card] : state.hands[0],
		state.turn === 1 ? [...state.hands[1], card] : state.hands[1],
	];

	return { ...state, hands, drawPile: pile, turn: (1 - state.turn) as 0 | 1 };
}
