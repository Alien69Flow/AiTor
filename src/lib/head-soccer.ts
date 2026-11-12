/**
 * Head soccer del arcade: dos cabezas, una pelota y una portería por lado.
 *
 * El motor es puro y avanza con un `dt` acotado a 50 ms: si el navegador se
 * atasca y entrega un fotograma de medio segundo, el paso se recorta y nadie
 * atraviesa la pelota. Es la misma decisión que en `platformer.ts` y por el
 * mismo motivo, un gol que se cuela por un tirón de CPU no se puede depurar.
 *
 * Las coordenadas son de campo fijo (100 × 56) con `y` medida desde el suelo
 * hacia arriba, así que la gravedad resta y la portería está abajo: un balón
 * que entra es el que cruza el fondo con altura menor que `goalHeight`.
 *
 * El rival no hace trampa: corre y salta con los mismos números que tú y sólo
 * persigue la pelota. Si algún día se quiere dificultad, se toca su velocidad,
 * no su física.
 */

export const SOCCER = {
	width: 100,
	height: 56,
	goalHeight: 14,
	ballRadius: 2,
	playerRadius: 3,
	gravity: 40,
	kick: 34,
	playerSpeed: 36,
	jumpSpeed: 20,
	matchSeconds: 45,
	goalsToWin: 3,
} as const;

export interface SoccerBody {
	x: number;
	y: number;
	vx: number;
	vy: number;
}

export interface SoccerInput {
	left: boolean;
	right: boolean;
	jump: boolean;
}

export interface SoccerState {
	ball: SoccerBody;
	you: SoccerBody;
	rival: SoccerBody;
	score: [number, number];
	/** Segundos que quedan de partido. */
	clock: number;
	over: boolean;
	winner: 0 | 1 | null;
	/** Quién tocó la pelota por última vez. */
	lastKick: 0 | 1 | null;
	seed: number;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function body(x: number, y: number, vx = 0, vy = 0): SoccerBody {
	return { x, y, vx, vy };
}

/** Partido nuevo, con la pelota al centro y un desvío pequeño según la semilla. */
export function createSoccer(seed = 1): SoccerState {
	const drift = ((seed % 7) - 3) * 0.4;
	return {
		ball: body(SOCCER.width / 2, SOCCER.height / 2, drift, 0),
		you: body(SOCCER.width * 0.25, SOCCER.playerRadius),
		rival: body(SOCCER.width * 0.75, SOCCER.playerRadius),
		score: [0, 0],
		clock: SOCCER.matchSeconds,
		over: false,
		winner: null,
		lastKick: null,
		seed,
	};
}

function bounceGround(entry: SoccerBody, radius: number): void {
	if (entry.y >= radius) return;
	entry.y = radius;
	// Un rebote muerto se corta: si no, la pelota tiembla en el suelo para siempre.
	entry.vy = Math.abs(entry.vy) > 2 ? Math.abs(entry.vy) * 0.45 : 0;
	entry.vx *= 0.96;
}

function bounceWalls(ball: SoccerBody): void {
	const radius = SOCCER.ballRadius;
	if (ball.x < radius) {
		ball.x = radius;
		ball.vx = Math.abs(ball.vx) * 0.7;
	}
	if (ball.x > SOCCER.width - radius) {
		ball.x = SOCCER.width - radius;
		ball.vx = -Math.abs(ball.vx) * 0.7;
	}
	if (ball.y > SOCCER.height - radius) {
		ball.y = SOCCER.height - radius;
		ball.vy = -Math.abs(ball.vy) * 0.5;
	}
}

/** Choque cabeza-pelota: separa y devuelve un impulso en la normal del golpe. */
function hit(ball: SoccerBody, head: SoccerBody, side: 0 | 1): boolean {
	const dx = ball.x - head.x;
	const dy = ball.y - head.y;
	const distance = Math.hypot(dx, dy);
	const minimum = SOCCER.ballRadius + SOCCER.playerRadius;
	if (distance >= minimum) return false;

	const nx = distance > 0.001 ? dx / distance : side === 0 ? 1 : -1;
	const ny = distance > 0.001 ? dy / distance : 0;
	ball.x = head.x + nx * minimum;
	ball.y = Math.max(SOCCER.ballRadius, head.y + ny * minimum);
	ball.vx = nx * SOCCER.kick + head.vx * 0.6;
	ball.vy = Math.abs(ny) > 0.2 ? ny * SOCCER.kick : SOCCER.kick * 0.35;
	return true;
}

function winnerByScore(score: [number, number]): 0 | 1 | null {
	if (score[0] === score[1]) return null;
	return score[0] > score[1] ? 0 : 1;
}

/**
 * Un paso de simulación.
 *
 * El orden importa: primero se mueve todo, después se mira si el balón cruzó el
 * fondo (antes de rebotar en la pared, que si no nunca llegaría a cero) y sólo
 * entonces se resuelven rebotes y choques.
 */
export function soccerStep(state: SoccerState, input: SoccerInput, dt: number): SoccerState {
	if (state.over) return state;
	const step = clamp(dt, 0, 0.05);
	if (step <= 0) return state;

	const you = { ...state.you };
	const rival = { ...state.rival };
	const ball = { ...state.ball };

	you.vx = (input.right ? SOCCER.playerSpeed : 0) - (input.left ? SOCCER.playerSpeed : 0);
	if (input.jump && you.y <= SOCCER.playerRadius + 0.01) you.vy = SOCCER.jumpSpeed;

	// El rival persigue la pelota y salta si la tiene encima.
	const gap = ball.x - rival.x;
	rival.vx = Math.abs(gap) > 2 ? Math.sign(gap) * SOCCER.playerSpeed * 0.82 : 0;
	if (ball.y > SOCCER.playerRadius * 2.2 && Math.abs(gap) < 7 && rival.y <= SOCCER.playerRadius + 0.01) {
		rival.vy = SOCCER.jumpSpeed * 0.9;
	}

	for (const entry of [you, rival, ball]) {
		entry.vy -= SOCCER.gravity * step;
		entry.x += entry.vx * step;
		entry.y += entry.vy * step;
	}

	const score: [number, number] = [state.score[0], state.score[1]];
	const clock = Math.max(0, state.clock - step);
	let lastKick = state.lastKick;

	const lowBall = ball.y <= SOCCER.goalHeight;
	const conceded = lowBall && ball.x <= 0;
	const scored = lowBall && ball.x >= SOCCER.width;

	if (conceded || scored) {
		score[scored ? 0 : 1] += 1;
		const decided = score[0] >= SOCCER.goalsToWin || score[1] >= SOCCER.goalsToWin || clock <= 0;
		if (decided) {
			return {
				...state,
				ball,
				you,
				rival,
				score,
				clock,
				over: true,
				winner: winnerByScore(score),
				lastKick: null,
			};
		}
		return {
			...state,
			ball: body(SOCCER.width / 2, SOCCER.height / 2, state.seed % 2 === 0 ? 3 : -3, 2),
			you: body(SOCCER.width * 0.25, SOCCER.playerRadius),
			rival: body(SOCCER.width * 0.75, SOCCER.playerRadius),
			score,
			clock,
			over: false,
			winner: null,
			lastKick: null,
		};
	}

	bounceGround(ball, SOCCER.ballRadius);
	bounceGround(you, SOCCER.playerRadius);
	bounceGround(rival, SOCCER.playerRadius);
	bounceWalls(ball);

	// Nadie cruza al campo del otro: si no, el rival se planta en tu portería.
	you.x = clamp(you.x, SOCCER.playerRadius, SOCCER.width / 2 - SOCCER.playerRadius);
	rival.x = clamp(rival.x, SOCCER.width / 2 + SOCCER.playerRadius, SOCCER.width - SOCCER.playerRadius);

	if (hit(ball, you, 0)) lastKick = 0;
	if (hit(ball, rival, 1)) lastKick = 1;
	bounceWalls(ball);

	const over = clock <= 0;
	return {
		...state,
		ball,
		you,
		rival,
		score,
		clock,
		over,
		winner: over ? winnerByScore(score) : null,
		lastKick,
	};
}

/** Puntos de la marca local: cada gol vale 300 y ganar suma 200 y el reloj. */
export function soccerScore(state: SoccerState): number {
	const win = state.winner === 0 ? 200 : 0;
	return state.score[0] * 300 + win + Math.max(0, Math.round(state.clock));
}
