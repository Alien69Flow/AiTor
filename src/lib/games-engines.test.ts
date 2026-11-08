import { describe, expect, it } from "vitest";

import { buildDeck, cardValue, deal, shuffle, spanishForty } from "./decks";
import {
	MINING_DAILY_CAP_SATS,
	WITHDRAWAL_RAIL,
	capReached,
	createMiningState,
	difficultyFor,
	mineSecond,
	withdraw,
} from "./mining";
import {
	PLATFORMER,
	advancePlatformer,
	buildTower,
	createPlatformer,
	jumpApex,
	platformerScore,
} from "./platformer";

describe("escalera orbital", () => {
	it("genera la misma torre con la misma semilla", () => {
		expect(buildTower(7)).toEqual(buildTower(7));
		expect(buildTower(7)).not.toEqual(buildTower(8));
	});

	it("no genera un salto imposible", () => {
		const apex = jumpApex();
		expect(PLATFORMER.maxRise).toBeLessThan(apex);

		const tower = buildTower(3);
		for (let index = 1; index < tower.length; index += 1) {
			const rise = tower[index].y - tower[index - 1].y;
			expect(rise).toBeLessThan(apex);
		}
	});

	it("mantiene al corredor en pie si no se pulsa nada", () => {
		const start = createPlatformer(1);
		const after = advancePlatformer(start, { left: false, right: false, jump: false }, 300);

		expect(after.over).toBe(false);
		expect(after.runner.onGround).toBe(true);
		expect(after.runner.y).toBeCloseTo(0, 6);
	});

	it("los bordes del mundo son paredes", () => {
		// La torre real empieza con una plataforma de 26 de ancho en el centro: si
		// se camina hacia el borde del mundo, el corredor se sale de ESA plataforma
		// y cae antes de llegar a la pared. Para probar la pared lo que hace falta
		// es suelo de lado a lado, que es justo lo que hace `within(x, 0, width)`.
		const fullWidth = {
			runner: { x: PLATFORMER.width / 2, y: 0, vx: 0, vy: 0, onGround: true },
			platforms: [
				{ id: "p0", x: 0, y: 0, w: PLATFORMER.width, h: PLATFORMER.platformHeight },
			],
			best: 0,
			reached: ["p0"],
			over: false,
			seed: 1,
		};

		const left = advancePlatformer(fullWidth, { left: true, right: false, jump: false }, 240);
		expect(left.runner.x).toBe(0);
		// Y no se muere al llegar: la pared detiene, no deja caer.
		expect(left.over).toBe(false);

		const right = advancePlatformer(
			fullWidth,
			{ left: false, right: true, jump: false },
			240,
		);
		expect(right.runner.x).toBe(PLATFORMER.width);
		expect(right.over).toBe(false);

		// Salir de la plataforma andando sí deja de apoyar: es la otra mitad de la
		// regla, y es lo que pasa en la torre de verdad.
		const tower = advancePlatformer(
			createPlatformer(1),
			{ left: true, right: false, jump: false },
			240,
		);
		expect(tower.runner.x).toBeGreaterThan(0);
		expect(tower.over).toBe(true);
	});

	it("salta por encima de la plataforma y vuelve a caer en ella", () => {
		const start = createPlatformer(2);
		const jumped = advancePlatformer(start, { left: false, right: false, jump: true }, 8);
		expect(jumped.runner.onGround).toBe(false);
		expect(jumped.best).toBeGreaterThan(start.best);

		const landed = advancePlatformer(jumped, { left: false, right: false, jump: false }, 240);
		expect(landed.runner.onGround).toBe(true);
		expect(landed.runner.y).toBeCloseTo(0, 6);
		expect(platformerScore(landed)).toBeGreaterThan(0);
	});

	it("el ápice real del salto no supera el teórico", () => {
		const start = createPlatformer(5);
		const peak = advancePlatformer(start, { left: false, right: false, jump: true }, 1);
		const rest = advancePlatformer(peak, { left: false, right: false, jump: false }, 120);

		expect(rest.best).toBeLessThanOrEqual(jumpApex() + 0.6);
	});
});

describe("mina de sats", () => {
	const DAY = "2026-11-08";

	it("la dificultad crece con cada bloque", () => {
		expect(difficultyFor(1)).toBeGreaterThan(difficultyFor(0));
		expect(difficultyFor(10)).toBeGreaterThan(difficultyFor(9));
	});

	it("acumula hashes y encuentra bloques", () => {
		let state = createMiningState(DAY);
		for (let second = 0; second < 60; second += 1) state = mineSecond(state, 60);

		expect(state.blocks).toBeGreaterThan(0);
		expect(state.sats).toBeGreaterThan(0);
		expect(state.seconds).toBe(60);
	});

	it("no pasa del tope diario y se declara", () => {
		let state = createMiningState(DAY);
		for (let second = 0; second < 86_400; second += 1) state = mineSecond(state, 5_000);

		expect(state.sats).toBe(MINING_DAILY_CAP_SATS);
		expect(capReached(state)).toBe(true);
	});

	it("no promete retiradas: no hay riel", () => {
		const state = createMiningState(DAY);
		const result = withdraw(state, 10);

		expect(WITHDRAWAL_RAIL).toBe("none");
		expect(result.ok).toBe(false);
		expect(result.reason).toContain("Sin proveedor de pagos");
		expect(result.state).toBe(state);
	});
});

describe("barajas", () => {
	it("tienen los tamaños reales", () => {
		expect(buildDeck("frances")).toHaveLength(52);
		expect(buildDeck("espanola")).toHaveLength(48);
		expect(buildDeck("uno")).toHaveLength(108);
		expect(spanishForty()).toHaveLength(40);
	});

	it("no repiten identificadores", () => {
		for (const kind of ["frances", "espanola", "uno"] as const) {
			const ids = new Set(buildDeck(kind).map((entry) => entry.id));
			expect(ids.size).toBe(buildDeck(kind).length);
		}
	});

	it("barajan de forma determinista y sin perder cartas", () => {
		const deck = buildDeck("frances");
		const first = shuffle(deck, 42);
		const second = shuffle(deck, 42);

		expect(first).toEqual(second);
		expect(first).not.toEqual(deck);
		expect(new Set(first.map((entry) => entry.id)).size).toBe(deck.length);
	});

	it("reparten por turnos sin duplicar cartas", () => {
		const deck = shuffle(buildDeck("uno"), 9);
		const { hands, rest } = deal(deck, 4, 7);

		expect(hands).toHaveLength(4);
		for (const hand of hands) expect(hand).toHaveLength(7);
		expect(rest).toHaveLength(deck.length - 28);

		const ids = [...hands.flat(), ...rest].map((entry) => entry.id);
		expect(new Set(ids).size).toBe(deck.length);
	});

	it("valora las cartas como en la mesa", () => {
		const deck = buildDeck("frances");
		const ace = deck.find((entry) => entry.rank === "A");
		const king = deck.find((entry) => entry.rank === "K");
		const seven = deck.find((entry) => entry.rank === "7");

		expect(ace && cardValue(ace)).toBe(1);
		expect(king && cardValue(king)).toBe(10);
		expect(seven && cardValue(seven)).toBe(7);
	});
});
