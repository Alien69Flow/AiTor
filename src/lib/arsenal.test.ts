import { describe, expect, it } from "vitest";
import {
	ARSENAL,
	ARSENAL_STATUS_ORDER,
	arsenalCandidates,
	arsenalCounts,
	arsenalLicenses,
	arsenalRepos,
	blocksDirectMerge,
} from "./arsenal";

const repos = arsenalRepos();

describe("arsenal", () => {
	it("cada repo curado tiene nombre único y URL de GitHub", () => {
		const names = repos.map((repo) => repo.name);
		expect(new Set(names).size).toBe(names.length);
		for (const repo of repos) {
			expect(repo.url).toMatch(/^https:\/\/github\.com\/Alien69Flow\//);
			expect(repo.destination).toBeTruthy();
			expect(ARSENAL_STATUS_ORDER).toContain(repo.status);
		}
	});

	it("el recuento cuadra con lo curado y con la cuenta", () => {
		expect(ARSENAL.curated).toBe(repos.length);
		expect(ARSENAL.curated).toBeLessThanOrEqual(ARSENAL.totalReposInAccount);
		expect(ARSENAL.forksInAccount).toBeLessThan(ARSENAL.totalReposInAccount);
		expect(Number.isNaN(Date.parse(ARSENAL.generatedAt))).toBe(false);
	});

	it("los recuentos por estado suman el total", () => {
		const counts = arsenalCounts(repos);
		const total = ARSENAL_STATUS_ORDER.reduce((sum, status) => sum + counts[status], 0);
		expect(total).toBe(repos.length);
	});

	it("los candidatos son sólo candidatos y vienen agrupados", () => {
		const groups = arsenalCandidates();
		expect(groups.length).toBeGreaterThan(0);
		for (const group of groups) {
			expect(group.repos.length).toBeGreaterThan(0);
			for (const repo of group.repos) expect(repo.status).toBe("candidato");
		}
	});

	it("las licencias suman y no esconden el «sin licencia»", () => {
		const licenses = arsenalLicenses(repos);
		const total = licenses.reduce((sum, entry) => sum + entry.count, 0);
		expect(total).toBe(repos.length);
		const sinLicencia = licenses.find((entry) => entry.license === "sin licencia");
		if (repos.some((repo) => repo.license === null)) {
			expect(sinLicencia?.count).toBe(repos.filter((repo) => repo.license === null).length);
			expect(blocksDirectMerge(null)).toBe(true);
		}
		expect(blocksDirectMerge("MIT")).toBe(false);
	});

	it("señala lo que ya vive en AiTor", () => {
		const incorporados = repos.filter((repo) => repo.status === "incorporado");
		expect(incorporados.map((repo) => repo.name)).toContain("headroom");
		expect(incorporados.length).toBeGreaterThan(0);
	});

	it("los destinos del mapa son los que existen", () => {
		const ids = ARSENAL.destinations.map((group) => group.id);
		expect(ids).toEqual(["agents", "memoria", "globe", "clima", "markets", "juegos", "sistema"]);
		for (const group of ARSENAL.destinations) expect(group.label).toBeTruthy();
	});
});
