import { describe, expect, it } from "vitest";

import { FLAPPY, advanceFlappy, createFlappy, stepFlappy } from "./flappy";

describe("ovni flappy", () => {
	it("empieza vivo y centrado", () => {
		const state = createFlappy(3);
		expect(state.alive).toBe(true);
		expect(state.y).toBe(FLAPPY.height / 2);
		expect(state.pipes).toHaveLength(0);
		expect(state.score).toBe(0);
	});

	it("la gravedad tira hacia abajo", () => {
		const state = createFlappy(1);
		const after = stepFlappy(state, 1 / 60, false);
		expect(after.y).toBeGreaterThan(state.y);
		expect(after.vy).toBeGreaterThan(0);
	});

	it("el aleteo invierte la velocidad en el acto", () => {
		const state = createFlappy(1);
		const after = stepFlappy(state, 1 / 120, true);
		expect(after.y).toBeLessThan(state.y);
	});

	it("tocar el suelo o el techo termina la partida", () => {
		const floor = stepFlappy({ ...createFlappy(1), y: FLAPPY.height - 2 }, 1 / 60);
		expect(floor.alive).toBe(false);

		const ceiling = stepFlappy({ ...createFlappy(1), y: 2, vy: -800 }, 1 / 60);
		expect(ceiling.alive).toBe(false);
	});

	it("un fotograma enorme se trocea y no atraviesa la pantalla", () => {
		const state = createFlappy(1);
		// 0,25 s de una vez: con integración directa el ovni se saldría; aquí se
		// subdivide en pasos de 1/120 y el resultado sigue siendo finito y acotado.
		const after = stepFlappy(state, 0.25, false);
		expect(Number.isFinite(after.y)).toBe(true);
		expect(after.y).toBeLessThan(FLAPPY.height);
	});

	it("un dt inválido no rompe nada", () => {
		const state = createFlappy(1);
		expect(stepFlappy(state, Number.NaN).y).toBe(state.y);
		expect(stepFlappy(state, -1).y).toBe(state.y);
	});

	it("genera tuberías y puntúa al pasarlas", () => {
		let state = stepFlappy(createFlappy(2), 1 / 60);
		expect(state.pipes.length).toBeGreaterThan(0);

		// Una tubería ya a la izquierda, sin puntuar: el siguiente paso la cuenta.
		state = stepFlappy({ ...state, pipes: [{ x: -20, gapY: 300, scored: false }] }, 1 / 60);
		expect(state.score).toBe(1);
		expect(state.pipes[0].scored).toBe(true);
	});

	it("chocar contra el tubo mata", () => {
		const state = createFlappy(4);
		// Hueco muy arriba y ovni centrado: está dentro del tubo inferior.
		const collided = stepFlappy(
			{ ...state, pipes: [{ x: FLAPPY.width / 2 - 10, gapY: 120, scored: false }] },
			1 / 60,
		);
		expect(collided.alive).toBe(false);
	});

	it("es determinista con la misma semilla", () => {
		const a = advanceFlappy(createFlappy(9), 1);
		const b = advanceFlappy(createFlappy(9), 1);
		expect(a).toEqual(b);
		expect(a.pipes.map((pipe) => pipe.gapY)).toEqual(b.pipes.map((pipe) => pipe.gapY));
	});

	it("dos semillas distintas dan huecos distintos", () => {
		const a = advanceFlappy(createFlappy(1), 0.5);
		const b = advanceFlappy(createFlappy(2), 0.5);
		expect(a.pipes.map((pipe) => pipe.gapY)).not.toEqual(b.pipes.map((pipe) => pipe.gapY));
	});
});
