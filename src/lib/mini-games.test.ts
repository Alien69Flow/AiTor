import { describe, expect, it } from "vitest";
import {
	IMPULSE_POINTS,
	IMPULSE_STREAK_CAP,
	MEMORY_NODES,
	extendSequence,
	REACTOR_OPTIONS,
	REACTOR_ROUNDS,
	REACTOR_SECONDS,
	reactorMaxScore,
	reactorRound,
	reactorScore,
	reactorVerdict,
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

/**
 * Reactor de pares: el tercer juego.
 *
 * Lo que se fija aquí es lo que hace que el juego signifique algo: cada ronda
 * tiene exactamente una pareja válida, es reproducible desde la semilla y el
 * tiempo nunca puede puntuar por encima del techo declarado.
 */
describe("reactor de pares", () => {
  it("cada ronda tiene una única pareja válida", () => {
    for (let seed = 0; seed < 200; seed++) {
      const round = reactorRound(seed, seed % REACTOR_ROUNDS);
      expect(round.options).toHaveLength(REACTOR_OPTIONS);
      expect(round.answer[0] + round.answer[1]).toBe(round.target);
      const validas = [];
      for (let i = 0; i < round.options.length; i++) {
        for (let j = i + 1; j < round.options.length; j++) {
          if (round.options[i] + round.options[j] === round.target) validas.push([i, j]);
        }
      }
      expect(validas).toHaveLength(1);
    }
  });

  it("es determinista y distinto entre rondas", () => {
    expect(reactorRound(1234, 3)).toEqual(reactorRound(1234, 3));
    const rounds = [0, 1, 2, 3, 4].map((round) => reactorRound(1234, round).target);
    expect(new Set(rounds).size).toBeGreaterThan(1);
  });

  it("las opciones no se repiten y son números positivos", () => {
    const round = reactorRound(99, 1);
    expect(new Set(round.options).size).toBe(round.options.length);
    for (const option of round.options) expect(option).toBeGreaterThan(0);
  });

  it("sin dos números no hay veredicto", () => {
    expect(reactorVerdict([], 10)).toBeNull();
    expect(reactorVerdict([4], 10)).toBeNull();
    expect(reactorVerdict([4, 6], 10)).toBe("correct");
    expect(reactorVerdict([4, 7], 10)).toBe("wrong");
  });

  it("la puntuación premia tiempo y combo, y nunca pasa el techo", () => {
    expect(reactorScore(0, 0)).toBe(100);
    expect(reactorScore(REACTOR_SECONDS, 5)).toBeGreaterThan(reactorScore(0, 0));
    // Valores fuera de rango se recortan en vez de inflar la marca.
    expect(reactorScore(999, 99)).toBe(reactorScore(REACTOR_SECONDS, 5));
    expect(reactorScore(-5, -1)).toBe(100);
    // El techo tiene que caber en el límite que acepta el servidor
    // (`MAX_SCORE.reactor`), o una partida perfecta se recortaría sola.
    expect(reactorScore(REACTOR_SECONDS, 5) * REACTOR_ROUNDS).toBeLessThanOrEqual(2_000);
    expect(reactorMaxScore()).toBeGreaterThanOrEqual(reactorScore(REACTOR_SECONDS, 5));
    expect(reactorMaxScore(1)).toBe(reactorScore(REACTOR_SECONDS, 0));
  });
});
