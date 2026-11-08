/**
 * OVNI Flappy: el pájaro de siempre, con un platillo.
 *
 * Motor puro y con delta de tiempo acotado. El detalle que rompe casi todas las
 * versiones caseras es el paso variable: si el navegador da un tirón de 400 ms y
 * se integra entero, el ovni atraviesa la tubería sin tocarla y aparece al otro
 * lado. Aquí el paso se recorta a `FLAPPY.maxStep` y se subdivide: la simulación
 * avanza a saltos pequeños aunque el fotograma sea enorme.
 *
 * Unidades de mundo con alto 640 y ancho 360, como el original en vertical, para
 * que el componente sólo tenga que escalar al tamaño del canvas.
 */

export const FLAPPY = {
	width: 360,
	height: 640,
	gravity: 1_400,
	/** Velocidad del aleteo, negativa porque el eje Y crece hacia abajo. */
	flap: -420,
	/** Velocidad a la que entran las tuberías, en unidades por segundo. */
	speed: 160,
	/** Hueco vertical entre los dos tubos. */
	gap: 170,
	/** Separación horizontal entre tuberías. */
	spacing: 220,
	/** Radio del ovni para las colisiones. */
	radius: 14,
	/** Margen que deja el hueco respecto a los bordes. */
	margin: 70,
	/** Paso máximo de integración; se subdivide si el fotograma es mayor. */
	maxStep: 1 / 120,
} as const;

export interface Pipe {
	/** Borde izquierdo. */
	x: number;
	/** Centro del hueco. */
	gapY: number;
	/** Ya contada en la puntuación. */
	scored: boolean;
}

export interface FlappyState {
	y: number;
	vy: number;
	pipes: Pipe[];
	score: number;
	alive: boolean;
	/** Segundos simulados. */
	elapsed: number;
	seed: number;
	rng: number;
}

function random(state: { rng: number }): number {
	let t = (state.rng + 0x6d2b79f5) >>> 0;
	t = Math.imul(t ^ (t >>> 15), t | 1);
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Partida nueva: quieto en el centro, con la primera tubería a media pantalla. */
export function createFlappy(seed = 1): FlappyState {
	return {
		y: FLAPPY.height / 2,
		vy: 0,
		pipes: [],
		score: 0,
		alive: true,
		elapsed: 0,
		seed,
		rng: seed >>> 0,
	};
}

/** Centro del hueco de la siguiente tubería, dentro del margen jugable. */
function nextGapCenter(state: FlappyState): { gapY: number; rng: number } {
	const value = random(state);
	const rng = ((state.rng + 0x6d2b79f5) >>> 0);
	const min = FLAPPY.margin + FLAPPY.gap / 2;
	const max = FLAPPY.height - FLAPPY.margin - FLAPPY.gap / 2;
	return { gapY: min + value * (max - min), rng };
}

/**
 * Un paso de simulación.
 *
 * `dt` se trocea: nunca se integra más de `maxStep` de una vez, así que un
 * fotograma lento no cambia el resultado de la física, sólo tarda más en
 * calcularse. Las tuberías se mueven con el tiempo total, no por trozos, para
 * que la puntuación no dependa del framerate.
 */
export function stepFlappy(state: FlappyState, dt: number, flap = false): FlappyState {
	if (!state.alive) return state;
	const total = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.25)) : 0;

	let y = state.y;
	let vy = flap ? FLAPPY.flap : state.vy;
	let remaining = total;
	while (remaining > 0) {
		const slice = Math.min(FLAPPY.maxStep, remaining);
		vy += FLAPPY.gravity * slice;
		y += vy * slice;
		remaining -= slice;
	}

	const elapsed = state.elapsed + total;

	// Suelo y techo: los dos matan, como en el original.
	if (y - FLAPPY.radius < 0 || y + FLAPPY.radius > FLAPPY.height) {
		return { ...state, y, vy, elapsed, alive: false };
	}

	let pipes = state.pipes.map((pipe) => ({ ...pipe, x: pipe.x - FLAPPY.speed * total }));
	let { rng } = state;

	// Se genera cuando la última ha entrado del todo, para que el hueco no
	// aparezca encima del ovni.
	const last = pipes[pipes.length - 1];
	if (!last || last.x < FLAPPY.width - FLAPPY.spacing) {
		const generated = nextGapCenter({ ...state, rng });
		rng = generated.rng;
		pipes = [...pipes, { x: FLAPPY.width, gapY: generated.gapY, scored: false }];
	}

	let score = state.score;
	pipes = pipes.map((pipe) => {
		if (!pipe.scored && pipe.x + FLAPPY.radius < 0) {
			score += 1;
			return { ...pipe, scored: true };
		}
		return pipe;
	});

	// Colisión: círculo contra el rectángulo del hueco (los dos tubos son el
	// complemento). Sólo cuenta si el ovni está horizontalmente dentro.
	for (const pipe of pipes) {
		const overlapX =
			FLAPPY.width / 2 + FLAPPY.radius > pipe.x && FLAPPY.width / 2 - FLAPPY.radius < pipe.x + 52;
		if (!overlapX) continue;
		const top = pipe.gapY - FLAPPY.gap / 2;
		const bottom = pipe.gapY + FLAPPY.gap / 2;
		if (y - FLAPPY.radius < top || y + FLAPPY.radius > bottom) {
			return { ...state, y, vy, pipes, score, elapsed, alive: false };
		}
	}

	// Fuera de pantalla por la izquierda no se acumulan: se descartan.
	const visible = pipes.filter((pipe) => pipe.x > -100);

	return { ...state, y, vy, pipes: visible, score, elapsed, alive: state.alive, rng };
}

/** Simula `seconds` con aleteo sólo en el primer paso. */
export function advanceFlappy(state: FlappyState, seconds: number): FlappyState {
	const step = 1 / 60;
	let next = state;
	for (let spent = 0; spent < seconds && next.alive; spent += step) {
		next = stepFlappy(next, step, false);
	}
	return next;
}
