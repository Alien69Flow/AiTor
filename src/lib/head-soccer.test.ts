import { describe, expect, it } from "vitest";

import { SOCCER, createSoccer, soccerScore, soccerStep } from "./head-soccer";

const still = { left: false, right: false, jump: false };

describe("head soccer", () => {
	it("saca la pelota al centro y los dos en su campo", () => {
		const state = createSoccer(1);
		expect(state.ball.x).toBe(SOCCER.width / 2);
		expect(state.ball.y).toBe(SOCCER.height / 2);
		expect(state.you.x).toBeLessThan(state.rival.x);
		expect(state.score).toEqual([0, 0]);
		expect(state.clock).toBe(SOCCER.matchSeconds);
		expect(state.over).toBe(false);
	});

	it("es determinista con la misma semilla", () => {
		const a = createSoccer(5);
		const b = createSoccer(5);
		expect(a.ball).toEqual(b.ball);
		expect(a.rival).toEqual(b.rival);
	});

	it("la gravedad baja la pelota y el reloj corre", () => {
		const state = createSoccer(1);
		const next = soccerStep(state, still, 0.05);
		expect(next.ball.y).toBeLessThan(state.ball.y);
		expect(next.clock).toBeLessThan(state.clock);
		expect(Number.isFinite(next.ball.y)).toBe(true);
	});

	it("un cabezazo hacia la portería contraria lanza la pelota", () => {
		const state = { ...createSoccer(1), ball: { x: 28, y: 3, vx: 0, vy: 0 } };
		const next = soccerStep(state, still, 0.05);
		expect(next.ball.vx).toBeGreaterThan(0);
		expect(next.lastKick).toBe(0);
	});

	it("el balón que cruza tu fondo es gol del rival y se vuelve al centro", () => {
		const state = { ...createSoccer(1), ball: { x: 0.4, y: 5, vx: -10, vy: 0 } };
		const next = soccerStep(state, still, 0.05);
		expect(next.score).toEqual([0, 1]);
		expect(next.ball.x).toBe(SOCCER.width / 2);
		expect(next.you.x).toBe(SOCCER.width * 0.25);
		expect(next.rival.x).toBe(SOCCER.width * 0.75);
		expect(next.over).toBe(false);
	});

	it("el balón que cruza el fondo rival es gol tuyo", () => {
		const state = { ...createSoccer(1), ball: { x: 99.7, y: 5, vx: 10, vy: 0 } };
		const next = soccerStep(state, still, 0.05);
		expect(next.score).toEqual([1, 0]);
	});

	it("se acaba cuando el reloj llega a cero", () => {
		const state = { ...createSoccer(1), clock: 0.01, score: [2, 1] as [number, number] };
		const next = soccerStep(state, still, 0.05);
		expect(next.over).toBe(true);
		expect(next.winner).toBe(0);
		expect(next.clock).toBe(0);
	});

	it("un partido terminado no se mueve", () => {
		const finished = soccerStep({ ...createSoccer(1), clock: 0.01 }, still, 0.05);
		expect(soccerStep(finished, { left: true, right: false, jump: true }, 0.05)).toBe(finished);
	});

	it("la marca suma goles, victoria y reloj", () => {
		const win = { ...createSoccer(1), score: [2, 1] as [number, number], clock: 10, winner: 0 as const };
		expect(soccerScore(win)).toBe(600 + 200 + 10);
		expect(soccerScore({ ...createSoccer(1), clock: 30 })).toBe(30);
	});

	it("el jugador no cruza al campo rival", () => {
		let state = createSoccer(1);
		for (let step = 0; step < 60; step += 1) {
			state = soccerStep(state, { left: false, right: true, jump: false }, 0.05);
		}
		expect(state.you.x).toBeLessThanOrEqual(SOCCER.width / 2 - SOCCER.playerRadius);
	});
});
