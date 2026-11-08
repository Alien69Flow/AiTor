/**
 * Snake: la serpiente clásica del arcade, en funciones puras.
 *
 * Todo va sobre una rejilla entera y avanza por tics, no por fotogramas: en un
 * snake, el tiempo real no significa nada — lo que importa es cuántas celdas ha
 * avanzado la cabeza. Si se simulara por delta de tiempo, con un tirón del
 * navegador la serpiente cruzaría dos celdas de golpe y podría atravesarse a sí
 * misma sin que la colisión se enterara.
 *
 * Las reglas son las clásicas y por eso no hace falta explicarlas en pantalla:
 * la pared mata, morderte la cola mata, comer crece y suma. Sin envolver por los
 * bordes: envolver convierte el juego en un pasatiempo y la pared es la única
 * presión que tiene.
 */

export interface Cell {
	x: number;
	y: number;
}

export type Direction = "up" | "down" | "left" | "right";

export const SNAKE_GRID = 24;
/** Longitud inicial: la cabeza más tres de cuerpo. */
export const SNAKE_START_LENGTH = 4;
export const SNAKE_FOOD_SCORE = 10;
/** Giros que se pueden encolar. Dos es lo que aguanta un giro en U bien pulsado. */
export const SNAKE_MAX_QUEUED_TURNS = 2;

export interface SnakeState {
	/** Del primero (cabeza) al último (cola). */
	body: Cell[];
	direction: Direction;
	/** Giros pendientes, en orden. Se aplica uno por tic. */
	pending: Direction[];
	food: Cell;
	score: number;
	alive: boolean;
	/** Tics simulados: sirve para la liga y para reproducir una partida. */
	ticks: number;
	seed: number;
}

const DIRECTIONS: Record<Direction, Cell> = {
	up: { x: 0, y: -1 },
	down: { x: 0, y: 1 },
	left: { x: -1, y: 0 },
	right: { x: 1, y: 0 },
};

/** Contrario de una dirección: el giro en U instantáneo se ignora. */
const OPPOSITE: Record<Direction, Direction> = {
	up: "down",
	down: "up",
	left: "right",
	right: "left",
};

/** Generador determinista (mulberry32): misma semilla, misma partida. */
function nextRandom(seed: number): number {
	let t = (seed + 0x6d2b79f5) >>> 0;
	t = Math.imul(t ^ (t >>> 15), t | 1);
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;

/** Primera celda libre para la comida, barriendo desde una posición aleatoria. */
function freeCell(body: Cell[], seed: number): Cell | null {
	const total = SNAKE_GRID * SNAKE_GRID;
	const occupied = new Set(body.map((cell) => cell.y * SNAKE_GRID + cell.x));
	let cursor = Math.floor(nextRandom(seed) * total);
	for (let step = 0; step < total; step += 1) {
		const index = (cursor + step) % total;
		if (!occupied.has(index)) {
			return { x: index % SNAKE_GRID, y: Math.floor(index / SNAKE_GRID) };
		}
	}
	return null;
}

/** Partida nueva: serpiente horizontal en el centro, mirando a la derecha. */
export function createSnake(seed = 1): SnakeState {
	const middle = Math.floor(SNAKE_GRID / 2);
	const body: Cell[] = [];
	for (let index = 0; index < SNAKE_START_LENGTH; index += 1) {
		body.push({ x: middle - index, y: middle });
	}

	const food = freeCell(body, seed) ?? { x: 0, y: 0 };
	return {
		body,
		direction: "right",
		pending: [],
		food,
		score: 0,
		alive: true,
		ticks: 0,
		seed,
	};
}

/**
 * Encola un giro.
 *
 * Se ignora si es el contrario de la dirección actual (moriría al instante y no
 * es lo que ha pedido nadie) o si es el último giro ya encolado, para que dos
 * pulsaciones rápidas de la misma tecla no gasten la cola.
 */
export function queueDirection(state: SnakeState, direction: Direction): SnakeState {
	if (!state.alive) return state;

	const last = state.pending.length ? state.pending[state.pending.length - 1] : state.direction;
	if (direction === last || direction === OPPOSITE[last]) return state;
	if (state.pending.length >= SNAKE_MAX_QUEUED_TURNS) return state;

	return { ...state, pending: [...state.pending, direction] };
}

/**
 * Un tic: la cabeza avanza una celda.
 *
 * El orden importa. Primero se mueve, después se comprueba si ha comido y sólo
 * entonces se decide si la cola se recorta: si se recortara antes de comprobar
 * la comida, entrar en la celda que deja libre la cola se contaría como
 * colisión y el juego se volvería injugable en cuanto hay un hueco ajustado.
 */
export function stepSnake(state: SnakeState): SnakeState {
	if (!state.alive) return state;

	const direction = state.pending.length ? state.pending[0] : state.direction;
	const pending = state.pending.slice(1);
	const delta = DIRECTIONS[direction];
	const head = state.body[0];
	const next: Cell = { x: head.x + delta.x, y: head.y + delta.y };

	// Pared: fuera de la rejilla.
	if (next.x < 0 || next.y < 0 || next.x >= SNAKE_GRID || next.y >= SNAKE_GRID) {
		return { ...state, direction, pending: [], alive: false, ticks: state.ticks + 1 };
	}

	const ate = sameCell(next, state.food);
	// La cola se mueve salvo que la serpiente crezca: esa celda queda libre.
	const bodyAfterTail = ate ? state.body : state.body.slice(0, -1);
	if (bodyAfterTail.some((cell) => sameCell(cell, next))) {
		return { ...state, direction, pending: [], alive: false, ticks: state.ticks + 1 };
	}

	const body = [next, ...bodyAfterTail];
	const ticks = state.ticks + 1;

	if (!ate) {
		return { ...state, body, direction, pending, ticks };
	}

	const food = freeCell(body, state.seed + ticks);
	if (!food) {
		// Tablero lleno: no queda sitio para más comida, así que la partida
		// termina con la puntuación ganada en vez de quedarse colgada.
		return {
			...state,
			body,
			direction,
			pending: [],
			score: state.score + SNAKE_FOOD_SCORE,
			alive: false,
			ticks,
		};
	}

	return {
		...state,
		body,
		direction,
		pending,
		food,
		score: state.score + SNAKE_FOOD_SCORE,
		ticks,
	};
}

/** Simula `ticks` tics con la misma dirección encolada. */
export function advanceSnake(state: SnakeState, ticks: number): SnakeState {
	let next = state;
	for (let index = 0; index < Math.max(0, Math.floor(ticks)); index += 1) {
		next = stepSnake(next);
		if (!next.alive) break;
	}
	return next;
}
