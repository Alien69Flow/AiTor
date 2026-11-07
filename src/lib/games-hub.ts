/**
 * El cerebro de la pestaña de juegos: temporada, reto del día, rango y liga.
 *
 * Todo lo que decide se calcula aquí, sin React y sin red, por la misma razón
 * que en `mini-games.ts`: un reto diario tiene que ser el mismo para todos y
 * para siempre —si se sortea en el componente, reaparece distinto en cada
 * recarga— y la progresión tiene que poder probarse sin abrir el navegador.
 *
 * Lo que se guarda es local: esta pestaña no tiene backend de juego ni premios
 * on-chain. El perfil lo dice en voz alta (`REWARDS_NOTE`) para que nadie lea
 * los puntos como si fueran un saldo.
 */

import { MEMORY_NODES, REACTOR_ROUNDS, REACTOR_SECONDS, type GameId } from "./mini-games";

export type HubGame = GameId;

/** Puntos de hub que aporta una partida, para poder sumar juegos distintos. */
export const HUB_POINTS_PER_GAME: Record<HubGame, (score: number) => number> = {
	// El pulso ya puntúa en decenas: se usa tal cual.
	impulse: (score) => Math.max(0, Math.round(score)),
	// La memoria puntúa en rondas (0–12); una ronda vale cuatro aciertos perfectos.
	memory: (score) => Math.max(0, Math.round(score)) * 40,
	// El reactor ya puntúa en puntos de liga (base + tiempo + combo): tal cual.
	reactor: (score) => Math.max(0, Math.round(score)),
	// Las manos de veintiuna ya vienen en puntos de liga.
	veintiuna: (score) => Math.max(0, Math.round(score)),
};

/** Nota honesta sobre qué son estos puntos. */
export const REWARDS_NOTE =
	"Los puntos de esta pestaña son locales: no hay saldo ni premio on-chain conectado todavía.";

/* ------------------------------- fechas --------------------------------- */

/** Día en UTC, `YYYY-MM-DD`. El reto cambia a medianoche UTC, no por husos. */
export function dateKey(date: Date = new Date()): string {
	return date.toISOString().slice(0, 10);
}

/** Temporada mensual, `YYYY-MM`. */
export function seasonOf(date: Date = new Date()): string {
	return date.toISOString().slice(0, 7);
}

/** Hash estable del día (FNV-1a de 32 bits), sin dependencias ni aleatoriedad. */
export function dailySeed(key: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < key.length; i++) {
		hash ^= key.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

/* ----------------------------- reto del día ------------------------------ */

export interface DailyChallenge {
	/** `YYYY-MM-DD`, para saber si ya se jugó. */
	id: string;
	game: HubGame;
	label: string;
	detail: string;
	/** Ventana de acierto del pulso, si el reto es de pulso. */
	tolerance?: number;
	/** Velocidad del indicador respecto a la normal. */
	speed?: number;
	/** Nodos dibujados, si el reto es de memoria. */
	nodeCount?: number;
	/** Segundos por ronda, si el reto es de reactor. */
	seconds?: number;
	/** Rondas, si el reto es de reactor. */
	rounds?: number;
}

const IMPULSE_CHALLENGES: Omit<DailyChallenge, "id" | "game">[] = [
	{ label: "Pulso estrecho", detail: "La ventana de acierto baja a 6 puntos.", tolerance: 6 },
	{ label: "Pulso rápido", detail: "El indicador corre un 40 % más.", speed: 1.4 },
	{ label: "Pulso paciente", detail: "Ventana de 6 y velocidad normal: no vale mirar el centro.", tolerance: 6 },
];

const MEMORY_CHALLENGES: Omit<DailyChallenge, "id" | "game">[] = [
	{ label: "Cinco nodos", detail: "Un nodo menos: la secuencia se repite peor.", nodeCount: 5 },
	{ label: "Cuatro nodos", detail: "Cuatro nodos y secuencias más largas de lo normal.", nodeCount: 4 },
	{ label: "Memoria completa", detail: "Los seis nodos, sin ayudas.", nodeCount: MEMORY_NODES },
];

const REACTOR_CHALLENGES: Omit<DailyChallenge, "id" | "game">[] = [
	{ label: "Reactor rápido", detail: "Cinco segundos por ronda: la suma tiene que salir de vista.", seconds: 5 },
	{ label: "Reactor largo", detail: "Diez rondas seguidas; el tiempo es el normal.", rounds: 10 },
	{ label: "Reactor doble presión", detail: "Diez rondas de cinco segundos: no hay margen para contar con los dedos.", seconds: 5, rounds: 10 },
];

/**
 * Reto de un día concreto.
 *
 * Alterna juego por el bit bajo del hash y elige variante por el resto: el
 * mismo día da siempre el mismo reto y dos días seguidos no repiten juego.
 */
const ROTATION: HubGame[] = ["impulse", "memory", "reactor"];

export function dailyChallenge(date: Date = new Date()): DailyChallenge {
	const id = dateKey(date);
	const seed = dailySeed(id);
	// Tres juegos, tres días, tres variantes: el reparto lo decide el hash del
	// día, así que el mismo día da siempre el mismo reto en cualquier equipo.
	const game: HubGame = ROTATION[seed % ROTATION.length];
	const pool =
		game === "impulse" ? IMPULSE_CHALLENGES : game === "memory" ? MEMORY_CHALLENGES : REACTOR_CHALLENGES;
	const variant = pool[Math.floor(seed / 7) % pool.length];
	return { id, game, ...variant };
}

/* -------------------------------- rangos --------------------------------- */

export interface Rank {
	id: string;
	name: string;
	/** Puntos de hub necesarios para entrar. */
	min: number;
	/** Siguiente rango, si lo hay. */
	next?: { name: string; min: number };
}

const RANK_STEPS = [
	{ id: "cadete", name: "Cadete", min: 0 },
	{ id: "piloto", name: "Piloto", min: 400 },
	{ id: "operador", name: "Operador", min: 1200 },
	{ id: "comandante", name: "Comandante", min: 3000 },
	{ id: "soberano", name: "Soberano", min: 8000 },
] as const;

export function rankOf(points: number): Rank {
	const total = Math.max(0, Math.round(points));
	let index = 0;
	for (let i = 0; i < RANK_STEPS.length; i++) {
		if (total >= RANK_STEPS[i].min) index = i;
	}
	const step = RANK_STEPS[index];
	const upcoming = RANK_STEPS[index + 1];
	return {
		id: step.id,
		name: step.name,
		min: step.min,
		...(upcoming ? { next: { name: upcoming.name, min: upcoming.min } } : {}),
	};
}

/* ------------------------------- progreso -------------------------------- */

export interface HubRun {
	at: string;
	game: HubGame;
	score: number;
	points: number;
	/** Id del reto, si la partida era la del día. */
	daily?: string;
}

export interface HubProfile {
	points: number;
	runs: number;
	best: Record<HubGame, number>;
	/** Días seguidos con al menos una partida. */
	streak: number;
	lastPlayed: string | null;
	/** Último reto diario completado. */
	dailyDone: string | null;
	/** Últimas partidas, la más reciente al final. */
	history: HubRun[];
}

export const EMPTY_PROFILE: HubProfile = {
	points: 0,
	runs: 0,
	best: { impulse: 0, memory: 0, reactor: 0, veintiuna: 0 },
	streak: 0,
	lastPlayed: null,
	dailyDone: null,
	history: [],
};

/** Cuántas partidas se guardan para la liga local. */
export const HISTORY_LIMIT = 20;

/**
 * Añade una partida al perfil.
 *
 * La racha se mide en días: jugar dos veces el mismo día no la infla, y saltarse
 * un día la reinicia. El día se compara en UTC para que no dependa del huso de
 * quien juega.
 */
export function recordRun(
	profile: HubProfile,
	run: { game: HubGame; score: number; at?: Date; daily?: string },
): HubProfile {
	const at = run.at ?? new Date();
	const day = dateKey(at);
	const points = HUB_POINTS_PER_GAME[run.game](run.score);

	let streak = profile.streak;
	if (profile.lastPlayed !== day) {
		const yesterday = dateKey(new Date(at.getTime() - 86_400_000));
		streak = profile.lastPlayed === yesterday ? profile.streak + 1 : 1;
	}

	const entry: HubRun = {
		at: at.toISOString(),
		game: run.game,
		score: Math.max(0, Math.round(run.score)),
		points,
		...(run.daily ? { daily: run.daily } : {}),
	};

	return {
		points: profile.points + points,
		runs: profile.runs + 1,
		best: {
			...profile.best,
			[run.game]: Math.max(profile.best[run.game] ?? 0, entry.score),
		},
		streak,
		lastPlayed: day,
		dailyDone: run.daily ?? profile.dailyDone,
		history: [...profile.history, entry].slice(-HISTORY_LIMIT),
	};
}

/** Liga local: las partidas de esta temporada, de más a menos puntos. */
export function seasonLadder(
	profile: HubProfile,
	date: Date = new Date(),
): HubRun[] {
	const season = seasonOf(date);
	return profile.history
		.filter((run) => seasonOf(new Date(run.at)) === season)
		.sort((a, b) => b.points - a.points || a.at.localeCompare(b.at));
}

/* ------------------------------ persistencia ----------------------------- */

const STORAGE_KEY = "aitor.games.profile.v1";

/** Lee el perfil del navegador. Cualquier cosa rara devuelve perfil vacío. */
export function readProfile(): HubProfile {
	if (typeof window === "undefined") return EMPTY_PROFILE;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return EMPTY_PROFILE;
		const parsed = JSON.parse(raw) as Partial<HubProfile> | null;
		if (!parsed || typeof parsed !== "object") return EMPTY_PROFILE;
		return {
			points: Number.isFinite(parsed.points) ? Number(parsed.points) : 0,
			runs: Number.isFinite(parsed.runs) ? Number(parsed.runs) : 0,
			best: {
				impulse: Number(parsed.best?.impulse) || 0,
				memory: Number(parsed.best?.memory) || 0,
				reactor: Number(parsed.best?.reactor) || 0,
				veintiuna: Number(parsed.best?.veintiuna) || 0,
			},
			streak: Number.isFinite(parsed.streak) ? Number(parsed.streak) : 0,
			lastPlayed: typeof parsed.lastPlayed === "string" ? parsed.lastPlayed : null,
			dailyDone: typeof parsed.dailyDone === "string" ? parsed.dailyDone : null,
			history: Array.isArray(parsed.history) ? parsed.history.slice(-HISTORY_LIMIT) : [],
		};
	} catch {
		return EMPTY_PROFILE;
	}
}

export function writeProfile(profile: HubProfile): HubProfile {
	if (typeof window !== "undefined") {
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
		} catch {
			// Modo privado o cuota llena: la partida se pierde, no la pantalla.
		}
	}
	return profile;
}
