import { describe, expect, it } from "vitest";
import {
	DECK_SIZE,
	HAND_POINTS,
	cardLabel,
	dealerShouldHit,
	handOutcome,
	handPoints,
	handValue,
	isBlackjack,
	playDealer,
	shuffledDeck,
	veintiunaMaxScore,
	type Card,
} from "./card-games";

const card = (rank: number, suit: Card["suit"] = "♠"): Card => ({ rank, suit });

describe("baraja", () => {
	it("tiene 52 cartas distintas", () => {
		const deck = shuffledDeck(7);
		expect(deck).toHaveLength(DECK_SIZE);
		const labels = new Set(deck.map(cardLabel));
		expect(labels.size).toBe(DECK_SIZE);
	});

	it("la misma semilla da el mismo reparto y otra semilla lo cambia", () => {
		const a = shuffledDeck(1234).map(cardLabel);
		const b = shuffledDeck(1234).map(cardLabel);
		const c = shuffledDeck(1235).map(cardLabel);
		expect(b).toEqual(a);
		expect(c).not.toEqual(a);
	});

	it("etiqueta ases y figuras como se espera", () => {
		expect(cardLabel(card(1, "♥"))).toBe("A♥");
		expect(cardLabel(card(11, "♦"))).toBe("J♦");
		expect(cardLabel(card(12))).toBe("Q♠");
		expect(cardLabel(card(13))).toBe("K♠");
		expect(cardLabel(card(10))).toBe("10♠");
	});
});

describe("valor de la mano", () => {
	it("suma figuras como diez", () => {
		expect(handValue([card(13), card(12)])).toBe(20);
	});

	it("cuenta el as como 11 si no se pasa", () => {
		expect(handValue([card(1), card(13)])).toBe(21);
	});

	it("baja los ases a 1 antes de pasarse", () => {
		expect(handValue([card(1), card(1), card(9)])).toBe(21);
		expect(handValue([card(1), card(1), card(1)])).toBe(13);
		expect(handValue([card(1), card(6), card(10)])).toBe(17);
	});

	it("pasarse de 21 se queda por encima", () => {
		expect(handValue([card(10), card(9), card(5)])).toBe(24);
	});
});

describe("blackjack natural", () => {
	it("sólo son dos cartas y 21", () => {
		expect(isBlackjack([card(1), card(13)])).toBe(true);
		expect(isBlackjack([card(7), card(7), card(7)])).toBe(false);
		expect(isBlackjack([card(10), card(9)])).toBe(false);
	});
});

describe("crupier", () => {
	it("pide con 16 y se planta con 17", () => {
		expect(dealerShouldHit(16)).toBe(true);
		expect(dealerShouldHit(17)).toBe(false);
		expect(dealerShouldHit(21)).toBe(false);
	});

	it("juega hasta plantarse sin pasarse de la baraja dada", () => {
		const draws = [card(2), card(3), card(10)];
		let index = 0;
		const hand = playDealer([card(10)], () => draws[index++]);
		expect(hand.map(cardLabel)).toEqual(["10♠", "2♠", "3♠", "10♠"]);
		expect(handValue(hand)).toBe(25);
		expect(index).toBe(3);
	});

	it("no roba si ya tiene 17", () => {
		let drawn = 0;
		const hand = playDealer([card(10), card(7)], () => {
			drawn++;
			return card(2);
		});
		expect(hand).toHaveLength(2);
		expect(drawn).toBe(0);
	});
});

describe("quién gana", () => {
	it("el blackjack gana a cualquier 21 de tres cartas", () => {
		expect(handOutcome([card(1), card(13)], [card(7), card(7), card(7)])).toBe("blackjack");
	});

	it("dos blackjacks empatan", () => {
		expect(handOutcome([card(1), card(12)], [card(1), card(13)])).toBe("push");
	});

	it("pasarse pierde aunque el crupier también se pase después", () => {
		expect(handOutcome([card(10), card(9), card(5)], [card(10), card(2), card(9)])).toBe("bust");
	});

	it("si el crupier se pasa, gana el jugador", () => {
		expect(handOutcome([card(10), card(8)], [card(10), card(6), card(9)])).toBe("win");
	});

	it("gana la mano más alta y empata la igual", () => {
		expect(handOutcome([card(10), card(9)], [card(10), card(8)])).toBe("win");
		expect(handOutcome([card(10), card(9)], [card(1), card(8)])).toBe("push");
		expect(handOutcome([card(10), card(7)], [card(10), card(9)])).toBe("lose");
	});

	it("el crupier con blackjack gana al 20", () => {
		expect(handOutcome([card(10), card(10)], [card(1), card(13)])).toBe("lose");
	});
});

describe("puntos", () => {
	it("el blackjack paga más y perder no resta", () => {
		expect(handPoints("blackjack")).toBe(300);
		expect(handPoints("win")).toBe(180);
		expect(handPoints("push")).toBe(60);
		expect(handPoints("lose")).toBe(0);
		expect(handPoints("bust")).toBe(0);
		expect(Math.min(...Object.values(HAND_POINTS))).toBe(0);
	});

	it("el techo de la partida es manos por blackjack", () => {
		expect(veintiunaMaxScore(3)).toBe(900);
		expect(veintiunaMaxScore(0)).toBe(0);
	});
});
