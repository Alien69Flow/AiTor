/**
 * Juegos de cartas, en funciones puras.
 *
 * La baraja se baraja con la semilla, no con Math.random: así una mano se puede
 * reproducir —en la prueba y en el navegador— y el reparto deja de ser magia.
 * El valor de la mano, el criterio del crupier y quién gana se calculan aquí,
 * sin React y sin temporizadores.
 *
 * No hay apuestas: los puntos de una mano son puntos de liga, no saldo.
 */

export type Suit = "♠" | "♥" | "♦" | "♣";

export interface Card {
	/** 1 = as, 11 = jota, 12 = reina, 13 = rey. */
	rank: number;
	suit: Suit;
}

export const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
/** Cartas de la baraja, sin comodines. */
export const DECK_SIZE = 52;

/** Texto corto de una carta: `A♠`, `10♥`, `K♦`. */
export function cardLabel(card: Card): string {
	const rank = card.rank === 1 ? "A" : card.rank === 11 ? "J" : card.rank === 12 ? "Q" : card.rank === 13 ? "K" : String(card.rank);
	return `${rank}${card.suit}`;
}

/** PRNG determinista (mulberry32): la misma semilla da la misma baraja. */
export function seededRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Baraja completa barajada con Fisher–Yates sobre la semilla. */
export function shuffledDeck(seed: number): Card[] {
	const deck: Card[] = [];
	for (const suit of SUITS) {
		for (let rank = 1; rank <= 13; rank++) deck.push({ rank, suit });
	}
	const random = seededRandom(seed);
	for (let i = deck.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[deck[i], deck[j]] = [deck[j], deck[i]];
	}
	return deck;
}

/** Valor de una carta, con el as valiendo 11 hasta que se pasa de 21. */
function rankValue(rank: number): number {
	if (rank === 1) return 11;
	if (rank > 10) return 10;
	return rank;
}

/** Mejor valor posible de la mano: los ases bajan a 1 antes de pasarse. */
export function handValue(cards: readonly Card[]): number {
	let total = 0;
	let aces = 0;
	for (const card of cards) {
		total += rankValue(card.rank);
		if (card.rank === 1) aces++;
	}
	while (total > 21 && aces > 0) {
		total -= 10;
		aces--;
	}
	return total;
}

/** ¿La mano es un veintiuno de dos cartas? Sólo eso es blackjack. */
export function isBlackjack(cards: readonly Card[]): boolean {
	return cards.length === 2 && handValue(cards) === 21;
}

/** El crupier pide con 16 o menos y se planta con 17 o más. */
export function dealerShouldHit(total: number): boolean {
	return total < 17;
}

/** Juega la mano del crupier hasta plantarse, tirando de la baraja dada. */
export function playDealer(cards: readonly Card[], next: () => Card): Card[] {
	const hand = [...cards];
	while (dealerShouldHit(handValue(hand))) hand.push(next());
	return hand;
}

export type HandOutcome = "blackjack" | "win" | "push" | "lose" | "bust";

/**
 * Quién gana la mano.
 *
 * El blackjack natural se comprueba antes que el valor porque un 21 de tres
 * cartas no empata con uno de dos: gana el de dos, y si ambos lo son, empate.
 */
export function handOutcome(player: readonly Card[], dealer: readonly Card[]): HandOutcome {
	const playerValue = handValue(player);
	if (playerValue > 21) return "bust";
	const playerNatural = isBlackjack(player);
	const dealerNatural = isBlackjack(dealer);
	if (playerNatural && dealerNatural) return "push";
	if (playerNatural) return "blackjack";
	if (dealerNatural) return "lose";
	const dealerValue = handValue(dealer);
	if (dealerValue > 21) return "win";
	if (playerValue > dealerValue) return "win";
	if (playerValue === dealerValue) return "push";
	return "lose";
}

/** Puntos de liga por mano. Perder no resta: una partida nunca deja saldo negativo. */
export const HAND_POINTS: Record<HandOutcome, number> = {
	blackjack: 300,
	win: 180,
	push: 60,
	lose: 0,
	bust: 0,
};

export function handPoints(outcome: HandOutcome): number {
	return HAND_POINTS[outcome];
}

/** Techo de una partida de `hands` manos, para acotar la marca que se envía. */
export function veintiunaMaxScore(hands: number): number {
	return Math.max(0, Math.round(hands)) * HAND_POINTS.blackjack;
}
