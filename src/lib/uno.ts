/**
 * UNO del arcade, en funciones puras.
 *
 * La baraja ya está en `decks.ts` (108 cartas reales: 25 por color, 4 comodines
 * y 4 roba-cuatro), así que aquí sólo viven las reglas: qué carta se puede
 * tirar, qué hace cada acción y cuándo se acaba. El rival es un bot que juega
 * con la misma baraja y las mismas reglas, no una IA aparte.
 *
 * Por qué el color viaja en el estado: un comodín no dice de qué color se
 * juega, lo elige quien lo tira. Guardarlo en `state.color` evita que el
 * componente tenga que recordarlo y que una recarga cambie la partida.
 *
 * Lo que este motor NO hace: cantar «uno» ni penalizar por no hacerlo. Es una
 * regla de mesa entre personas; con un bot no hay a quién avisar.
 */

import { buildDeck, shuffle, type PlayingCard } from "./decks";

/** Cartas en mano al empezar. */
export const UNO_HAND_SIZE = 5;

/** Puntos por carta colocada. */
export const UNO_CARD_POINTS = 20;

/** Bonus por quedarse sin cartas. */
export const UNO_WIN_BONUS = 300;

export const UNO_COLORS = ["rojo", "amarillo", "verde", "azul"] as const;
export type UnoColor = (typeof UNO_COLORS)[number];

export interface UnoState {
	hand: PlayingCard[];
	rival: PlayingCard[];
	draw: PlayingCard[];
	/** Carta boca arriba que manda el color o el número. */
	discard: PlayingCard;
	/** Color en juego; en un comodín lo decide quien lo tira. */
	color: UnoColor;
	turn: 0 | 1;
	/** Cartas que has colocado: de aquí sale la puntuación. */
	played: number;
	finished: boolean;
	winner: 0 | 1 | null;
}

/** `3a` y `3b` son el mismo número: el sufijo sólo evita dos ids iguales. */
export function baseRank(card: PlayingCard): string {
	return card.rank.replace(/[ab]$/, "");
}

function isWild(card: PlayingCard): boolean {
	return card.suit === "comodin" || card.suit === "roba4";
}

function isColored(card: PlayingCard): card is PlayingCard & { suit: UnoColor } {
	return (UNO_COLORS as readonly string[]).includes(card.suit);
}

/** Color que más se repite en una mano; sin cartas de color, rojo. */
function pickColor(cards: readonly PlayingCard[]): UnoColor {
	const counts = new Map<string, number>();
	for (const card of cards) {
		if (isColored(card)) counts.set(card.suit, (counts.get(card.suit) ?? 0) + 1);
	}
	let best: UnoColor = "rojo";
	let bestCount = 0;
	for (const color of UNO_COLORS) {
		const count = counts.get(color) ?? 0;
		if (count > bestCount) {
			best = color;
			bestCount = count;
		}
	}
	return best;
}

/**
 * Partida nueva.
 *
 * La primera carta del descarte tiene que ser un número: si saliera un
 * comodín, la mesa empezaría pidiendo un color que nadie ha elegido.
 */
export function unoStart(seed = 1): UnoState {
	const deck = shuffle(buildDeck("uno"), seed);
	const opening = deck.findIndex((card) => isColored(card) && /^\d/.test(card.rank));
	const start = opening < 0 ? 0 : opening;
	const first = deck[start];
	const rest = [...deck.slice(0, start), ...deck.slice(start + 1)];

	const hand = rest.slice(0, UNO_HAND_SIZE);
	const rival = rest.slice(UNO_HAND_SIZE, UNO_HAND_SIZE * 2);
	const draw = rest.slice(UNO_HAND_SIZE * 2);

	return {
		hand,
		rival,
		draw,
		discard: first,
		color: isColored(first) ? first.suit : "rojo",
		turn: 0,
		played: 0,
		finished: false,
		winner: null,
	};
}

/** ¿Vale esta carta sobre la mesa actual? Comodín y roba-cuatro, siempre. */
export function unoPlayable(state: UnoState, card: PlayingCard): boolean {
	if (isWild(card)) return true;
	if (card.suit === state.color) return true;
	return baseRank(card) === baseRank(state.discard);
}

/** Cartas que puedes tirar ahora. */
export function unoLegal(state: UnoState): PlayingCard[] {
	if (state.finished || state.turn !== 0) return [];
	return state.hand.filter((card) => unoPlayable(state, card));
}

function afterPlay(state: UnoState, card: PlayingCard): UnoState {
	const hand = state.hand.filter((entry) => entry.id !== card.id);
	const color = isWild(card) ? pickColor(hand) : isColored(card) ? card.suit : state.color;

	let rival = state.rival;
	let draw = state.draw;
	if (card.suit === "roba4" || baseRank(card) === "roba2") {
		const take = card.suit === "roba4" ? 4 : 2;
		rival = [...rival, ...draw.slice(0, take)];
		draw = draw.slice(take);
	}

	const base: UnoState = {
		...state,
		hand,
		rival,
		draw,
		discard: card,
		color,
		played: state.played + 1,
	};

	if (hand.length === 0) return { ...base, finished: true, winner: 0 };
	return { ...base, turn: 1 };
}

/**
 * Turno del bot: tira si puede y, si no, roba una y pasa.
 *
 * No vuelve a llamar a `unoPlay` a propósito: con dos jugadores basta un
 * intercambio por jugada, y una llamada cruzada sería un bucle esperando a que
 * alguien tenga carta.
 */
export function unoBot(state: UnoState): UnoState {
	if (state.finished || state.turn !== 1) return state;

	const card = state.rival.find((entry) => unoPlayable(state, entry));
	if (!card) {
		const next = state.draw[0];
		if (!next) return { ...state, turn: 0 };
		return { ...state, rival: [...state.rival, next], draw: state.draw.slice(1), turn: 0 };
	}

	const rival = state.rival.filter((entry) => entry.id !== card.id);
	const color = isWild(card) ? pickColor(rival) : isColored(card) ? card.suit : state.color;

	let hand = state.hand;
	let draw = state.draw;
	if (card.suit === "roba4" || baseRank(card) === "roba2") {
		const take = card.suit === "roba4" ? 4 : 2;
		hand = [...hand, ...draw.slice(0, take)];
		draw = draw.slice(take);
	}

	const base: UnoState = {
		...state,
		hand,
		rival,
		draw,
		discard: card,
		color,
		turn: 0,
	};

	if (rival.length === 0) return { ...base, finished: true, winner: 1 };
	return base;
}

/**
 * Juega una carta. Una jugada ilegal no lanza ni cambia nada: devuelve el
 * mismo estado, igual que el resto de motores de la pestaña.
 */
export function unoPlay(state: UnoState, cardId: string): UnoState {
	if (state.finished || state.turn !== 0) return state;
	const card = state.hand.find((entry) => entry.id === cardId);
	if (!card || !unoPlayable(state, card)) return state;

	const played = afterPlay(state, card);
	if (played.finished) return played;
	return unoBot(played);
}

/** Robar: el turno pasa al bot aunque la carta robada se pudiera tirar. */
export function unoDraw(state: UnoState): UnoState {
	if (state.finished || state.turn !== 0) return state;
	const next = state.draw[0];
	if (!next) return state;
	return unoBot({ ...state, hand: [...state.hand, next], draw: state.draw.slice(1), turn: 1 });
}

/** Puntos de la partida: cartas colocadas y bonus por vaciar la mano. */
export function unoScore(state: UnoState): number {
	return state.played * UNO_CARD_POINTS + (state.winner === 0 ? UNO_WIN_BONUS : 0);
}
