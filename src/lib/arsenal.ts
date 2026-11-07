/**
 * El arsenal: los repos del dueño, con destino y estado de adopción.
 *
 * No es una lista de enlaces bonita. Cada ficha dice a qué pestaña pertenece
 * (agentes, memoria, globo, clima, mercados, juegos, sistema) y qué se va a
 * hacer con ella:
 *
 *  - `incorporado` — ya vive en AiTor (y se puede señalar el commit).
 *  - `candidato`   — pieza concreta que se puede traer sin claves nuevas ni
 *                    runtime ajeno.
 *  - `referencia`  — se lee para aprender, no se copia: es un producto externo,
 *                    arrastra otra licencia o necesita Python, GPU o un servidor
 *                    que este despliegue no tiene.
 *
 * Los datos vienen de la API de GitHub (nombre, descripción, lenguaje, estrellas,
 * licencia, último push), no de la memoria de nadie: `npm run arsenal:sync` los
 * refresca. La descripción de cada repo es la suya, sin adornos.
 *
 * De los 251 repos de la cuenta, 239 son forks de proyectos de terceros. Eso
 * marca la regla: un fork se lee, no se fusiona sin mirar su licencia.
 */

import raw from "../data/arsenal.json";

export type ArsenalDestination =
	| "agents"
	| "memoria"
	| "globe"
	| "clima"
	| "markets"
	| "juegos"
	| "sistema";

export type ArsenalStatus = "incorporado" | "candidato" | "referencia";

export interface ArsenalRepo {
	name: string;
	url: string;
	description: string;
	language: string | null;
	stars: number;
	fork: boolean;
	archived: boolean;
	license: string | null;
	pushedAt: string;
	homepage: string | null;
	topics: string[];
	destination: ArsenalDestination;
	status: ArsenalStatus;
}

export interface ArsenalGroup {
	id: ArsenalDestination;
	label: string;
	repos: ArsenalRepo[];
}

export interface Arsenal {
	generatedAt: string;
	source: string;
	totalReposInAccount: number;
	forksInAccount: number;
	curated: number;
	destinations: ArsenalGroup[];
}

export const ARSENAL = raw as Arsenal;

export const ARSENAL_STATUS_LABEL: Record<ArsenalStatus, string> = {
	incorporado: "incorporado",
	candidato: "candidato",
	referencia: "referencia",
};

/** Orden en que se leen los estados: primero lo que ya funciona. */
export const ARSENAL_STATUS_ORDER: ArsenalStatus[] = ["incorporado", "candidato", "referencia"];

/** Todos los repos curados, aplanados. */
export function arsenalRepos(arsenal: Arsenal = ARSENAL): ArsenalRepo[] {
	return arsenal.destinations.flatMap((group) => group.repos);
}

/** Cuántos hay de cada estado, en el orden de `ARSENAL_STATUS_ORDER`. */
export function arsenalCounts(repos: ArsenalRepo[]): Record<ArsenalStatus, number> {
	const counts: Record<ArsenalStatus, number> = { incorporado: 0, candidato: 0, referencia: 0 };
	for (const repo of repos) counts[repo.status] += 1;
	return counts;
}

/** Lo que se puede traer a continuación, ya agrupado por destino. */
export function arsenalCandidates(arsenal: Arsenal = ARSENAL): ArsenalGroup[] {
	return arsenal.destinations
		.map((group) => ({ ...group, repos: group.repos.filter((repo) => repo.status === "candidato") }))
		.filter((group) => group.repos.length > 0);
}

/**
 * Licencias presentes, contando `null` como «sin licencia» en vez de esconderlo.
 *
 * Es el dato que decide si un fork se puede fusionar: MIT y Apache-2.0 se
 * pueden citar con su aviso, GPL/AGPL obligan a compartir el fuente, y un repo
 * sin licencia no se copia.
 */
export function arsenalLicenses(repos: ArsenalRepo[]): { license: string; count: number }[] {
	const counts = new Map<string, number>();
	for (const repo of repos) {
		const key = repo.license ?? "sin licencia";
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return [...counts.entries()]
		.map(([license, count]) => ({ license, count }))
		.sort((a, b) => b.count - a.count || a.license.localeCompare(b.license));
}

/** Licencias que impiden fusionar código tal cual en este proyecto GPL-3.0. */
export function blocksDirectMerge(license: string | null): boolean {
	return license === null;
}
