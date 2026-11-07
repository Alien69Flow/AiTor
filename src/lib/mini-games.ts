/**
 * Los dos juegos de la pestaña, en funciones puras.
 *
 * El componente no decide nada: recibe veredictos. Así se puede comprobar que
 * el borde de la ventana de acierto cae donde debe y que una secuencia de
 * memoria se valida igual sin montar React ni esperar a un temporizador.
 */

/* --------------------------- Pulso orbital ------------------------------ */

/** Ancho de la ventana de acierto, en puntos sobre una barra de 0 a 100. */
export const IMPULSE_TOLERANCE = 10;
/** Mitad de la ventana que da el mejor veredicto. */
export const IMPULSE_PERFECT = IMPULSE_TOLERANCE / 3;

export type ImpulseVerdict = "perfect" | "good" | "fail";

/** Puntos que suma cada veredicto. */
export const IMPULSE_POINTS: Record<ImpulseVerdict, number> = {
	perfect: 100,
	good: 40,
	fail: 0,
};

const clamp100 = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

/**
 * Dónde cayó el pulso respecto al centro de la ventana.
 *
 * Los bordes cuentan como acierto (`<=`), que es lo que espera quien juega: si
 * el indicador está justo en el límite, no debería ser un fallo.
 */
export function impulseVerdict(
	position: number,
	target: number,
	tolerance = IMPULSE_TOLERANCE,
): ImpulseVerdict {
	const distance = Math.abs(clamp100(position) - clamp100(target));
	if (distance <= Math.min(tolerance / 3, IMPULSE_PERFECT)) return "perfect";
	if (distance <= tolerance) return "good";
	return "fail";
}

/**
 * Siguiente centro de la ventana, dentro de la barra y sin repetir el mismo
 * sitio dos veces seguidas (sería un blanco regalado).
 */
export function nextTarget(previous: number, rand: () => number): number {
	for (let attempt = 0; attempt < 12; attempt++) {
		const candidate = Math.round(10 + clamp100(rand() * 80));
		if (Math.abs(candidate - previous) > 8) return candidate;
	}
	// Sin acuerdo tras varios intentos, se desplaza lo justo: nunca deja el
	// blanco encima del anterior.
	return previous > 50 ? previous - 20 : previous + 20;
}

/** Racha máxima que suma bonus: a partir de 8 aciertos seguidos no sube más. */
export const IMPULSE_STREAK_CAP = 8;

export function impulseBonus(streak: number): number {
	return Math.min(Math.max(0, Math.floor(streak)), IMPULSE_STREAK_CAP) * 10;
}

/* --------------------------- Memoria de nodos ---------------------------- */

/** Cuántos nodos hay dibujados en el panel. */
export const MEMORY_NODES = 6;
/** Longitud de la secuencia que se considera partida ganada. */
export const MEMORY_WIN_LENGTH = 12;

export type MemoryVerdict = "wrong" | "incomplete" | "complete";

/**
 * Añade un nodo a la secuencia.
 *
 * `rand` se inyecta en vez de usar `Math.random` para que la prueba pueda fijar
 * la partida; el juego pasa `Math.random`.
 */
export function extendSequence(
	sequence: readonly number[],
	nodeCount = MEMORY_NODES,
	rand: () => number = Math.random,
): number[] {
	const node = Math.min(nodeCount - 1, Math.max(0, Math.floor(rand() * nodeCount)));
	return [...sequence, node];
}

/**
 * Cómo va la entrada del jugador: se compara contra la secuencia y se corta en
 * el primer fallo, sin dejar que un acierto posterior tape el error.
 */
export function memoryVerdict(sequence: readonly number[], inputs: readonly number[]): MemoryVerdict {
	for (let i = 0; i < inputs.length; i++) {
		if (inputs[i] !== sequence[i]) return "wrong";
	}
	return inputs.length >= sequence.length ? "complete" : "incomplete";
}

/* --------------------------- Reactor de pares ---------------------------- */

/**
 * Tercer juego: dos números que suman el objetivo, bajo reloj.
 *
 * No repite ni el pulso (precisión de tiempo) ni la memoria (secuencia): aquí
 * se juega a aritmética rápida con una única pareja válida, así que la lógica
 * pura puede garantizar que la ronda tiene solución y que sólo hay una.
 */
export const REACTOR_ROUNDS = 8;
/** Segundos por ronda. */
export const REACTOR_SECONDS = 7;
/** Números que se ofrecen: dos de la pareja y dos señuelos. */
export const REACTOR_OPTIONS = 4;

export interface ReactorRound {
	/** Suma que hay que alcanzar. */
	target: number;
	/** Números ofrecidos, mezclados. */
	options: number[];
	/** La única pareja que suma el objetivo. */
	answer: [number, number];
}

/** PRNG determinista: la misma semilla da la misma ronda en cualquier equipo. */
function reactorNoise(seed: number, round: number): number {
	let hash = (seed ^ Math.imul(round + 1, 0x9e3779b1)) >>> 0;
	hash ^= hash << 13;
	hash >>>= 0;
	hash ^= hash >>> 17;
	hash ^= hash << 5;
	return hash >>> 0;
}

/**
 * Ronda de reactor.
 *
 * Se elige la pareja primero y los señuelos después, descartando cualquiera que
 * pudiera formar otra suma válida con un número ya presente: si hubiera dos
 * parejas correctas, acertar dejaría de significar algo.
 */
export function reactorRound(seed: number, round: number): ReactorRound {
	const noise = reactorNoise(seed, round);
	const a = 2 + (noise % 6);
	const b = 2 + ((noise >>> 3) % 6);
	const target = a + b;

	const decoys: number[] = [];
	for (let step = 1; step <= 40 && decoys.length < REACTOR_OPTIONS - 2; step++) {
		const candidate = 1 + ((noise >>> step) % 9);
		if (candidate === a || candidate === b) continue;
		if (decoys.includes(candidate)) continue;
		// Ni con la pareja ni con el otro señuelo puede sumar el objetivo.
		if (candidate + a === target || candidate + b === target) continue;
		if (decoys.some((other) => other + candidate === target)) continue;
		decoys.push(candidate);
	}
	// Si el ruido no bastó (semilla muy degenerada), se completa con valores
	// fuera del rango de la pareja, que por construcción no suman el objetivo.
	for (let candidate = 1; decoys.length < REACTOR_OPTIONS - 2 && candidate <= 12; candidate++) {
		if (candidate === a || candidate === b || decoys.includes(candidate)) continue;
		if (candidate + a === target || candidate + b === target) continue;
		if (decoys.some((other) => other + candidate === target)) continue;
		decoys.push(candidate);
	}

	const options = [a, b, ...decoys];
	// Barajado determinista para que la pareja no salga siempre delante.
	for (let i = options.length - 1; i > 0; i--) {
		const j = (noise >>> (i * 3)) % (i + 1);
		[options[i], options[j]] = [options[j], options[i]];
	}

	return { target, options, answer: [a, b] };
}

export type ReactorVerdict = "correct" | "wrong";

/** ¿La pareja elegida suma el objetivo? Sin elegir nada no hay veredicto. */
export function reactorVerdict(picked: readonly number[], target: number): ReactorVerdict | null {
	if (picked.length < 2) return null;
	return picked[0] + picked[1] === target ? "correct" : "wrong";
}

/** Puntos de una ronda acertada: base, tiempo restante y combo. */
export function reactorScore(secondsLeft: number, combo: number): number {
	const seconds = Math.max(0, Math.min(REACTOR_SECONDS, Math.round(secondsLeft)));
	const streak = Math.min(5, Math.max(0, Math.floor(combo)));
	return 100 + seconds * 10 + streak * 10;
}

/** Techo teórico de una partida perfecta, para acotar la marca que se envía. */
export function reactorMaxScore(rounds = REACTOR_ROUNDS): number {
	let total = 0;
	for (let round = 0; round < rounds; round++) total += reactorScore(REACTOR_SECONDS, round);
	return total;
}

/* ------------------------------- marcas --------------------------------- */

/** Juegos con marca propia. `veintiuna` vive en `card-games.ts`, mismo contrato. */
export type GameId = "impulse" | "memory" | "reactor" | "veintiuna";

export function readBest(game: GameId): number {
	if (typeof window === "undefined") return 0;
	const raw = Number(window.localStorage.getItem(`aitor.game.${game}`));
	return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

export function saveBest(game: GameId, score: number): number {
	const best = Math.max(readBest(game), Math.round(score));
	if (typeof window !== "undefined") {
		try {
			window.localStorage.setItem(`aitor.game.${game}`, String(best));
		} catch {
			// Modo privado o almacenamiento lleno: la marca es un extra, no un fallo.
		}
	}
	return best;
}
