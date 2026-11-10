/**
 * El reto del día, visto desde el servidor.
 *
 * Es el mismo reparto que `src/lib/games-hub.ts`: hash FNV-1a del día, tres
 * juegos en rotación y tres variantes por juego. Tiene que serlo, porque el
 * navegador lo pinta y este módulo lo valida al puntuar; `_challenge.test.ts`
 * compara los dos durante 90 días para que no puedan separarse sin que CI lo
 * diga.
 *
 * Vive en `api/` porque una función serverless no debe importar de `src/` y
 * porque el servidor no puede fiarse de lo que el navegador diga que era el
 * reto de hoy.
 */

export type ChallengeGame = "impulse" | "memory" | "reactor";

/** Mismo valor que `MEMORY_NODES` en `src/lib/mini-games.ts`. */
const MEMORY_NODES = 6;

export interface ServerChallenge {
	id: string;
	game: ChallengeGame;
	label: string;
	detail: string;
	tolerance?: number;
	speed?: number;
	nodeCount?: number;
	seconds?: number;
	rounds?: number;
}

type Variant = Omit<ServerChallenge, "id" | "game">;

const IMPULSE_CHALLENGES: Variant[] = [
	{ label: "Pulso estrecho", detail: "La ventana de acierto baja a 6 puntos.", tolerance: 6 },
	{ label: "Pulso rápido", detail: "El indicador corre un 40 % más.", speed: 1.4 },
	{ label: "Pulso paciente", detail: "Ventana de 6 y velocidad normal: no vale mirar el centro.", tolerance: 6 },
];

const MEMORY_CHALLENGES: Variant[] = [
	{ label: "Cinco nodos", detail: "Un nodo menos: la secuencia se repite peor.", nodeCount: 5 },
	{ label: "Cuatro nodos", detail: "Cuatro nodos y secuencias más largas de lo normal.", nodeCount: 4 },
	{ label: "Memoria completa", detail: "Los seis nodos, sin ayudas.", nodeCount: MEMORY_NODES },
];

const REACTOR_CHALLENGES: Variant[] = [
	{ label: "Reactor rápido", detail: "Cinco segundos por ronda: la suma tiene que salir de vista.", seconds: 5 },
	{ label: "Reactor largo", detail: "Diez rondas seguidas; el tiempo es el normal.", rounds: 10 },
	{ label: "Reactor doble presión", detail: "Diez rondas de cinco segundos: no hay margen para contar con los dedos.", seconds: 5, rounds: 10 },
];

const ROTATION: ChallengeGame[] = ["impulse", "memory", "reactor"];

/** Día en UTC, `YYYY-MM-DD`. El reto cambia a medianoche UTC. */
export function dateKey(date: Date = new Date()): string {
	return date.toISOString().slice(0, 10);
}

/** Temporada mensual, `YYYY-MM`. */
export function seasonOf(date: Date = new Date()): string {
	return date.toISOString().slice(0, 7);
}

/** Hash estable del día (FNV-1a de 32 bits), sin dependencias ni azar. */
export function dailySeed(key: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < key.length; i++) {
		hash ^= key.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

/** El reto de una fecha: el mismo para todo el mundo y para siempre. */
export function serverChallenge(date: Date = new Date()): ServerChallenge {
	const id = dateKey(date);
	const seed = dailySeed(id);
	const game = ROTATION[seed % ROTATION.length];
	const pool =
		game === "impulse" ? IMPULSE_CHALLENGES : game === "memory" ? MEMORY_CHALLENGES : REACTOR_CHALLENGES;
	const variant = pool[Math.floor(seed / 7) % pool.length];
	return { id, game, ...variant };
}

/**
 * ¿La partida dice ser del reto correcto?
 *
 * Sólo hay una respuesta válida por día y juego: el reto de hoy para el juego
 * que se ha jugado. Cualquier otra fecha o juego se descarta (se guarda como
 * partida normal, sin marca de reto).
 */
export function countsForDaily(game: ChallengeGame, daily: unknown, date: Date = new Date()): string | null {
	const challenge = serverChallenge(date);
	if (typeof daily !== "string" || daily !== challenge.id) return null;
	return daily === challenge.id && game === challenge.game ? challenge.id : null;
}

/** Tope de partidas que se pueden enviar en un día, según lleven testigo. */
export const MAX_VERIFIED_RUNS_PER_DAY = 40;
/** Sin testigo (cliente antiguo o script) el margen es mínimo. */
export const MAX_UNVERIFIED_RUNS_PER_DAY = 3;

/** Inicio del día UTC, en ISO, para contar las partidas de hoy. */
export function startOfUtcDay(date: Date = new Date()): string {
	return `${dateKey(date)}T00:00:00.000Z`;
}
