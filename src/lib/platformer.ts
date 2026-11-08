/**
 * Escalera orbital: el motor del plataformas del arcade, en funciones puras.
 *
 * El registro de miniapps ya declaraba este módulo y decía lo que le faltaba:
 * «motor de física discreta (paso fijo, colisión AABB) con su prueba de saltos
 * y bordes». Esto es ese motor.
 *
 * Decisiones que no son de estilo:
 *
 *  - **Paso fijo**: la simulación avanza en pasos de 1/60 s y no en el tiempo
 *    que tarde el navegador en pintar. Con pasos variables, un tirón de 200 ms
 *    atraviesa la plataforma y el jugador cae a través del suelo.
 *  - **Unidades de mundo**, no píxeles: 100 de ancho, gravedad 26, salto 26. Así
 *    la prueba puede afirmar que el ápice del salto son 13 m y que ninguna
 *    plataforma se genera más arriba de lo alcanzable — el error clásico de un
 *    plataformas procedural es generar un salto imposible.
 *  - **Sin React**: aquí no hay dibujo ni temporizadores. El componente pinta
 *    el estado y llama a `stepPlatformer`.
 */

/** Ajustes del mundo. Todos en unidades de mundo y segundos. */
export interface PlatformerTuning {
	/** Ancho jugable. El corredor no sale de aquí. */
	width: number;
	gravity: number;
	/** Velocidad inicial del salto, hacia arriba (positivo). */
	jumpVelocity: number;
	/** Velocidad horizontal máxima. */
	moveSpeed: number;
	/** Duración de un paso de simulación. */
	stepSeconds: number;
	platformWidth: number;
	platformHeight: number;
	/** Subida mínima y máxima entre plataformas consecutivas. */
	minRise: number;
	maxRise: number;
	/** Altura por debajo de la cual la partida termina. */
	fallLimit: number;
}

export const PLATFORMER: PlatformerTuning = {
	width: 100,
	gravity: 26,
	// ápice = v² / (2g) = 676 / 52 = 13 m, por encima de `maxRise`.
	jumpVelocity: 26,
	moveSpeed: 34,
	stepSeconds: 1 / 60,
	platformWidth: 26,
	platformHeight: 2,
	minRise: 7,
	maxRise: 10,
	fallLimit: -6,
};

/** Entrada de un paso. `jump` se lee como «mantener pulsado», no como flanco. */
export interface PlatformerInput {
	left: boolean;
	right: boolean;
	jump: boolean;
}

export interface Platform {
	id: string;
	/** Esquina inferior izquierda. */
	x: number;
	/** Altura de la cara superior. */
	y: number;
	w: number;
	h: number;
}

export interface Runner {
	x: number;
	/** Altura de los pies. */
	y: number;
	vx: number;
	vy: number;
	onGround: boolean;
}

export interface PlatformerState {
	runner: Runner;
	platforms: Platform[];
	/** Altura máxima alcanzada, que es la marca. */
	best: number;
	/** Plataformas pisadas, por id. */
	reached: string[];
	over: boolean;
	seed: number;
}

/** Ápice del salto, en unidades de mundo. */
export function jumpApex(tuning: PlatformerTuning = PLATFORMER): number {
	return (tuning.jumpVelocity * tuning.jumpVelocity) / (2 * tuning.gravity);
}

/** Ruido determinista: la misma semilla dibuja la misma torre en cualquier equipo. */
function noise(seed: number, index: number, salt: number): number {
	let hash = (seed ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0;
	hash ^= hash << 13;
	hash >>>= 0;
	hash ^= hash >>> 17;
	hash ^= hash << 5;
	return (hash >>> 0) / 0x100000000;
}

/**
 * Torre de plataformas para una semilla.
 *
 * La primera es el suelo; a partir de ahí cada una sube entre `minRise` y
 * `maxRise`, siempre por debajo del ápice del salto, y se coloca de forma que
 * su centro quede dentro del ancho (nunca media plataforma fuera).
 */
export function buildTower(seed: number, count = 24, tuning: PlatformerTuning = PLATFORMER): Platform[] {
	const platforms: Platform[] = [];
	const maxX = Math.max(0, tuning.width - tuning.platformWidth);

	for (let index = 0; index < count; index += 1) {
		const y = index === 0 ? 0 : platforms[index - 1].y + tuning.minRise + noise(seed, index, 1) * (tuning.maxRise - tuning.minRise);
		// La primera plataforma va centrada: el jugador empieza encima sin caer.
		const x = index === 0 ? (tuning.width - tuning.platformWidth) / 2 : noise(seed, index, 2) * maxX;
		platforms.push({
			id: `p${index}`,
			x,
			y,
			w: tuning.platformWidth,
			h: tuning.platformHeight,
		});
	}

	return platforms;
}

/** Partida nueva. El corredor empieza de pie sobre la primera plataforma. */
export function createPlatformer(seed = 1, tuning: PlatformerTuning = PLATFORMER): PlatformerState {
	const platforms = buildTower(seed, undefined, tuning);
	const ground = platforms[0];
	return {
		runner: {
			x: ground.x + ground.w / 2,
			y: ground.y,
			vx: 0,
			vy: 0,
			onGround: true,
		},
		platforms,
		best: ground.y,
		reached: [ground.id],
		over: false,
		seed,
	};
}

const within = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Plataforma que sostiene al corredor en esa altura y posición, si hay alguna. */
function supportAt(platforms: Platform[], x: number, y: number, tuning: PlatformerTuning): Platform | null {
	const margin = 0.5;
	for (const platform of platforms) {
		if (Math.abs(platform.y - y) > 0.001) continue;
		if (x < platform.x - margin || x > platform.x + platform.w + margin) continue;
		return platform;
	}
	return null;
}

/**
 * Un paso de simulación. Devuelve estado nuevo: nada se muta, así que la prueba
 * puede comparar antes y después sin copias defensivas.
 */
export function stepPlatformer(
	state: PlatformerState,
	input: PlatformerInput,
	tuning: PlatformerTuning = PLATFORMER,
): PlatformerState {
	if (state.over) return state;

	const dt = tuning.stepSeconds;
	const runner = { ...state.runner };
	const reached = new Set(state.reached);

	// Horizontal: se fija la velocidad y se recorta al mundo, que es lo que hace
	// que los bordes sean paredes y no un sitio por el que caerse.
	runner.vx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
	runner.vx *= tuning.moveSpeed;
	runner.x = within(runner.x + runner.vx * dt, 0, tuning.width);

	if (input.jump && runner.onGround) {
		runner.vy = tuning.jumpVelocity;
		runner.onGround = false;
	}

	if (runner.onGround) {
		// Se ha podido salir de la plataforma andando: deja de estar apoyado.
		const support = supportAt(state.platforms, runner.x, runner.y, tuning);
		if (support) {
			runner.y = support.y;
			runner.vy = 0;
			reached.add(support.id);
		} else {
			runner.onGround = false;
		}
	}

	if (!runner.onGround) {
		const previousY = runner.y;
		runner.vy -= tuning.gravity * dt;
		runner.y += runner.vy * dt;

		// Sólo se aterriza cayendo, y sólo si se ha cruzado la cara superior en
		// este paso: así no se atraviesa una plataforma a 26 m/s.
		if (runner.vy <= 0) {
			for (const platform of state.platforms) {
				const crossed = previousY >= platform.y - 0.001 && runner.y <= platform.y;
				const over = runner.x >= platform.x - 0.5 && runner.x <= platform.x + platform.w + 0.5;
				if (!crossed || !over) continue;
				runner.y = platform.y;
			runner.vy = 0;
			runner.onGround = true;
			reached.add(platform.id);
				break;
			}
		}
	}

	const best = Math.max(state.best, runner.y);
	const over = runner.y < tuning.fallLimit;

	return {
		runner,
		platforms: state.platforms,
		best,
		reached: [...reached],
		over,
		seed: state.seed,
	};
}

/**
 * Puntos de la partida: altura alcanzada más bonus por plataforma nueva.
 *
 * Se calcula sobre el estado y no se acumula a mano, para que dos partidas con
 * el mismo recorrido den exactamente la misma puntuación.
 */
export function platformerScore(state: PlatformerState): number {
	return Math.max(0, Math.floor(state.best) * 10 + (state.reached.length - 1) * 50);
}

/** Simula `steps` pasos con la misma entrada; útil para el componente y las pruebas. */
export function advancePlatformer(
	state: PlatformerState,
	input: PlatformerInput,
	steps: number,
	tuning: PlatformerTuning = PLATFORMER,
): PlatformerState {
	let next = state;
	for (let step = 0; step < Math.max(0, Math.floor(steps)); step += 1) {
		next = stepPlatformer(next, input, tuning);
		if (next.over) break;
	}
	return next;
}
