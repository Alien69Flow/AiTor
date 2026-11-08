import { describe, expect, it } from "vitest";

import {
	SNAKE_FOOD_SCORE,
	SNAKE_GRID,
	SNAKE_START_LENGTH,
	advanceSnake,
	createSnake,
	queueDirection,
	stepSnake,
} from "./snake";

describe("snake", () => {
	it("empieza con la cabeza al frente y el cuerpo detrás", () => {
		const state = createSnake(1);
		expect(state.alive).toBe(true);
		expect(state.body).toHaveLength(SNAKE_START_LENGTH);
		const [head, neck] = state.body;
		expect(head.y).toBe(neck.y);
		expect(head.x).toBe(neck.x + 1);
		expect(state.food.x).toBeGreaterThanOrEqual(0);
		expect(state.food.x).toBeLessThan(SNAKE_GRID);
		expect(state.body.some((cell) => cell.x === state.food.x && cell.y === state.food.y)).toBe(
			false,
		);
	});

	it("avanza una celda por tic y no dos", () => {
		const start = createSnake(1);
		const one = stepSnake(start);
		expect(one.body[0].x).toBe(start.body[0].x + 1);
		expect(one.body[0].y).toBe(start.body[0].y);
		expect(one.body).toHaveLength(SNAKE_START_LENGTH);
		expect(one.ticks).toBe(1);
	});

	it("ignora el giro en U instantáneo", () => {
		const state = createSnake(1);
		const turned = queueDirection(state, "left");
		expect(turned.pending).toEqual([]);
		const after = stepSnake(turned);
		expect(after.alive).toBe(true);
		expect(after.body[0].x).toBe(state.body[0].x + 1);
	});

	it("aplica un giro encolado por tic, en orden", () => {
		let state = createSnake(1);
		state = queueDirection(state, "up");
		state = queueDirection(state, "left");
		expect(state.pending).toEqual(["up", "left"]);

		const first = stepSnake(state);
		expect(first.direction).toBe("up");
		expect(first.pending).toEqual(["left"]);

		const second = stepSnake(first);
		expect(second.direction).toBe("left");
		expect(second.pending).toEqual([]);
	});

	it("no acumula más giros de los que se pueden gastar", () => {
		let state = createSnake(1);
		for (const direction of ["up", "left", "down", "right"] as const) {
			state = queueDirection(state, direction);
		}
		expect(state.pending.length).toBeLessThanOrEqual(2);
	});

	it("la pared mata", () => {
		const state = createSnake(1);
		const atEdge = {
			...state,
			body: [
				{ x: SNAKE_GRID - 1, y: 5 },
				{ x: SNAKE_GRID - 2, y: 5 },
				{ x: SNAKE_GRID - 3, y: 5 },
			],
		};
		const after = stepSnake(atEdge);
		expect(after.alive).toBe(false);
		expect(after.ticks).toBe(1);
	});

	it("morderse el cuerpo mata", () => {
		const state = createSnake(1);
		// Cabeza mirando abajo hacia una celda del cuerpo que no es la cola.
		const bitten = stepSnake({
			...state,
			direction: "down",
			body: [
				{ x: 5, y: 5 },
				{ x: 6, y: 5 },
				{ x: 6, y: 6 },
				{ x: 5, y: 6 },
				{ x: 4, y: 6 },
			],
		});
		expect(bitten.alive).toBe(false);
	});

	it("seguir a la propia cola es legal", () => {
		const state = createSnake(1);
		// La celda a la que entra la cabeza es la cola, que se libera en el mismo
		// tic: contarla como colisión haría la serpiente injugable en pasillos
		// ajustados.
		const chase = stepSnake({
			...state,
			direction: "down",
			body: [
				{ x: 5, y: 5 },
				{ x: 6, y: 5 },
				{ x: 6, y: 6 },
				{ x: 5, y: 6 },
			],
		});
		expect(chase.alive).toBe(true);
		expect(chase.body[0]).toEqual({ x: 5, y: 6 });
		expect(chase.body).toHaveLength(4);
	});

	it("comer crece, suma y pone comida nueva fuera del cuerpo", () => {
		const state = createSnake(1);
		const head = state.body[0];
		const withFood = { ...state, food: { x: head.x + 1, y: head.y } };
		const after = stepSnake(withFood);

		expect(after.score).toBe(SNAKE_FOOD_SCORE);
		expect(after.body).toHaveLength(SNAKE_START_LENGTH + 1);
		expect(after.body.some((cell) => cell.x === after.food.x && cell.y === after.food.y)).toBe(
			false,
		);
		expect(after.alive).toBe(true);
	});

	it("la puntuación no crece si no se come", () => {
		const state = createSnake(1);
		const moved = advanceSnake({ ...state, food: { x: 0, y: 0 } }, 3);
		expect(moved.score).toBe(0);
		expect(moved.ticks).toBe(3);
	});

	it("es determinista: la misma semilla da la misma partida", () => {
		const a = advanceSnake(createSnake(11), 20);
		const b = advanceSnake(createSnake(11), 20);
		expect(a).toEqual(b);
		expect(advanceSnake(createSnake(11), 20)).toEqual(a);
	});
});
