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

/* ------------------------------- marcas --------------------------------- */

/** La mejor marca se guarda por juego en el navegador. */
export type GameId = "impulse" | "memory";

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
