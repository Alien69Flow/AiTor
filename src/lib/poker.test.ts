import { describe, expect, it } from "vitest";

import type { PlayingCard } from "./decks";
import { compareHands, evaluateHand, handValue, rankValue } from "./poker";

const hand = (spec: string): PlayingCard[] =>
	spec.split(" ").map((entry) => {
		const [rank, suit] = entry.split("-");
		return { id: `frances:${suit}:${rank}`, kind: "frances", suit, rank };
	});

describe("póker", () => {
	it("el as vale catorce", () => {
		expect(rankValue({ id: "a", kind: "frances", suit: "picas", rank: "A" })).toBe(14);
		expect(rankValue({ id: "b", kind: "frances", suit: "picas", rank: "2" })).toBe(2);
	});

	it("reconoce cada categoría", () => {
		expect(evaluateHand(hand("A-picas K-picas Q-picas J-picas 10-picas")).category).toBe(
			"escalera-color",
		);
		expect(evaluateHand(hand("9-picas 9-corazones 9-treboles 9-diamantes 2-picas")).category).toBe(
			"poker",
		);
		expect(evaluateHand(hand("9-picas 9-corazones 9-treboles 4-diamantes 4-picas")).category).toBe(
			"full",
		);
		expect(evaluateHand(hand("2-picas 7-picas 9-picas J-picas K-picas")).category).toBe("color");
		expect(evaluateHand(hand("5-picas 6-corazones 7-treboles 8-diamantes 9-picas")).category).toBe(
			"escalera",
		);
		expect(evaluateHand(hand("5-picas 5-corazones 5-treboles 8-diamantes 9-picas")).category).toBe(
			"trio",
		);
		expect(evaluateHand(hand("5-picas 5-corazones 8-treboles 8-diamantes 9-picas")).category).toBe(
			"dos-pares",
		);
		expect(evaluateHand(hand("5-picas 5-corazones 8-treboles J-diamantes 9-picas")).category).toBe(
			"pareja",
		);
		expect(evaluateHand(hand("2-picas 5-corazones 8-treboles J-diamantes K-picas")).category).toBe(
			"carta-alta",
		);
	});

	it("la escalera con el as abajo vale cinco, no as", () => {
		const wheel = evaluateHand(hand("A-picas 2-corazones 3-treboles 4-diamantes 5-picas"));
		expect(wheel.category).toBe("escalera");
		expect(wheel.tiebreak).toEqual([5]);
	});

	it("ordena las categorías como en la mesa", () => {
		const escaleraColor = evaluateHand(hand("A-picas K-picas Q-picas J-picas 10-picas"));
		const poker = evaluateHand(hand("9-picas 9-corazones 9-treboles 9-diamantes 2-picas"));
		const full = evaluateHand(hand("9-picas 9-corazones 9-treboles 4-diamantes 4-picas"));
		const color = evaluateHand(hand("2-picas 7-picas 9-picas J-picas K-picas"));
		const escalera = evaluateHand(hand("5-picas 6-corazones 7-treboles 8-diamantes 9-picas"));

		expect(compareHands(escaleraColor, poker)).toBeGreaterThan(0);
		expect(compareHands(poker, full)).toBeGreaterThan(0);
		expect(compareHands(full, color)).toBeGreaterThan(0);
		expect(compareHands(color, escalera)).toBeGreaterThan(0);
	});

	it("desempata por la carta que distingue, no por la suma", () => {
		const asesConRey = evaluateHand(hand("9-picas 9-corazones 8-treboles K-diamantes A-picas"));
		const asesConDama = evaluateHand(hand("9-picas 9-corazones 8-treboles Q-diamantes A-corazones"));
		expect(compareHands(asesConRey, asesConDama)).toBeGreaterThan(0);

		// Misma pareja y mismas tres acompañantes: empate exacto.
		const copia = evaluateHand(hand("9-corazones 9-treboles 8-picas K-picas A-diamantes"));
		expect(compareHands(asesConRey, copia)).toBe(0);
	});

	it("un full de reyes gana a uno de nueves", () => {
		const reyes = evaluateHand(hand("K-picas K-corazones K-treboles 4-diamantes 4-picas"));
		const nueves = evaluateHand(hand("9-picas 9-corazones 9-treboles A-diamantes A-picas"));
		expect(compareHands(reyes, nueves)).toBeGreaterThan(0);
	});

	it("la suma bruta crece con la categoría", () => {
		const pareja = evaluateHand(hand("5-picas 5-corazones 8-treboles J-diamantes 9-picas"));
		const trio = evaluateHand(hand("5-picas 5-corazones 5-treboles J-diamantes 9-picas"));
		expect(handValue(trio)).toBeGreaterThan(handValue(pareja));
	});

	it("rechaza manos que no son de cinco", () => {
		expect(() => evaluateHand(hand("A-picas K-picas"))).toThrow(RangeError);
	});
});
