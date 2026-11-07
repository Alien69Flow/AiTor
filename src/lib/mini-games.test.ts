import { describe, expect, it } from "vitest";
import {
	IMPULSE_POINTS,
	IMPULSE_STREAK_CAP,
	MEMORY_NODES,
	extendSequence,
	impulseBonus,
	impulseVerdict,
	memoryVerdict,
	nextTarget,
} from "./mini-games";

describe("pulso orbital", () => {
	it("el centro es perfecto y el borde de la ventana cuenta como acierto", () => {
		expect(impulseVerdict(50, 50)).toBe("perfect");
		expect(impulseVerdict(50 + 3, 50)).toBe("perfect");
		expect(impulseVerdict(50 + 4, 50)).toBe("good");
		expect(impulseVerdict(50 + 10, 50)).toBe("good");
	});

	it("fuera de la ventana es fallo, por poco que sea", () => {
		expect(impulseVerdict(50 + 10.5, 50)).toBe("fail");
		expect(impulseVerdict(0, 90)).toBe("fail");
	});

	it("no se sale de la barra con valores raros", () => {
		expect(impulseVerdict(-40, 0)).toBe("perfect");
		expect(impulseVerdict(Number.NaN, 50)).toBe("fail");
		expect(impulseVerdict(140, 100)).toBe("perfect");
	});

	it("los puntos premian el acierto exacto", () => {
		expect(IMPULSE_POINTS.perfect).toBeGreaterThan(IMPULSE_POINTS.good);
		expect(IMPULSE_POINTS.fail).toBe(0);
	});

	it("el bonus de racha sube y se corta en el techo", () => {
		expect(impulseBonus(0)).toBe(0);
		expect(impulseBonus(3)).toBe(30);
		expect(impulseBonus(99)).toBe(IMPULSE_STREAK_CAP * 10);
	});

	it("el siguiente blanco se mueve y se queda dentro", () => {
		const target = nextTarget(50, () => 0.5);
		expect(target).toBeGreaterThanOrEqual(10);
		expect(target).toBeLessThanOrEqual(90);
		expect(Math.abs(target - 50)).toBeGreaterThan(8);
	});

	it("con un generador que siempre da el mismo sitio, no se queda encima", () => {
		const target = nextTarget(50, () => 0.5);
		expect(target).not.toBe(50);
	});
});

describe("memoria de nodos", () => {
	it("la secuencia crece de uno en uno y nunca sale de los nodos", () => {
		let sequence: number[] = [];
		for (let i = 0; i < 30; i++) {
			sequence = extendSequence(sequence, MEMORY_NODES, () => Math.random());
			expect(sequence).toHaveLength(i + 1);
			for (const node of sequence) {
				expect(node).toBeGreaterThanOrEqual(0);
				expect(node).toBeLessThan(MEMORY_NODES);
			}
		}
	});

	it("una secuencia fija se reproduce igual con el mismo generador", () => {
		const values = [0.1, 0.9, 0.4];
		let index = 0;
		const rand = () => values[Math.min(index++, values.length - 1)];
		const first = extendSequence([], MEMORY_NODES, rand);
		index = 0;
		const second = extendSequence([], MEMORY_NODES, rand);
		expect(first).toEqual(second);
	});

	it("acertar el prefijo no es acertar la ronda", () => {
		expect(memoryVerdict([1, 2, 3], [1])).toBe("incomplete");
		expect(memoryVerdict([1, 2, 3], [1, 2, 3])).toBe("complete");
	});

	it("un fallo corta aunque después coincida", () => {
		expect(memoryVerdict([1, 2, 3], [1, 9, 3])).toBe("wrong");
		expect(memoryVerdict([1, 2, 3], [3])).toBe("wrong");
	});
});
