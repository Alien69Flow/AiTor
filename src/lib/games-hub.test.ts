import { describe, expect, it } from "vitest";
import {
	dailyChallenge,
	dailySeed,
	dateKey,
	EMPTY_PROFILE,
	HISTORY_LIMIT,
	HUB_POINTS_PER_GAME,
	rankOf,
	recordRun,
	seasonLadder,
	seasonOf,
} from "./games-hub";

const day = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

describe("días y temporadas", () => {
	it("el día y la temporada van en UTC", () => {
		// 00:30 en Madrid ya es el día siguiente en UTC, y ese es el corte bueno:
		// el reto no puede cambiar según el huso de quien juega.
		expect(dateKey(new Date("2026-11-07T23:30:00.000Z"))).toBe("2026-11-07");
		expect(dateKey(new Date("2026-11-08T00:30:00.000Z"))).toBe("2026-11-08");
		expect(seasonOf(day("2026-11-07"))).toBe("2026-11");
	});
});

describe("reto del día", () => {
	it("el mismo día da siempre el mismo reto", () => {
		expect(dailyChallenge(day("2026-11-07"))).toEqual(dailyChallenge(day("2026-11-07")));
		expect(dailyChallenge(day("2026-11-07")).id).toBe("2026-11-07");
	});

	it("el hash del día es estable y distingue días", () => {
		expect(dailySeed("2026-11-07")).toBe(dailySeed("2026-11-07"));
		expect(dailySeed("2026-11-07")).not.toBe(dailySeed("2026-11-08"));
	});

	it("dos días seguidos no repiten juego", () => {
		const games = [
			dailyChallenge(day("2026-11-07")).game,
			dailyChallenge(day("2026-11-08")).game,
			dailyChallenge(day("2026-11-09")).game,
		];
		for (let i = 1; i < games.length; i++) {
			expect(games[i]).not.toBe(games[i - 1]);
		}
	});

	it("cada reto trae su modificador coherente con el juego", () => {
		// Se recorren 60 días: todos los retos tienen que ser jugables.
		for (let i = 0; i < 60; i++) {
			const date = new Date(Date.UTC(2026, 0, 1 + i));
			const challenge = dailyChallenge(date);
			expect(challenge.label.length).toBeGreaterThan(3);
			expect(challenge.detail.length).toBeGreaterThan(10);
			if (challenge.game === "impulse") {
				expect(challenge.nodeCount).toBeUndefined();
				expect(challenge.tolerance ?? challenge.speed).toBeTruthy();
			} else {
				expect(challenge.tolerance).toBeUndefined();
				expect(challenge.speed).toBeUndefined();
				expect(challenge.nodeCount).toBeGreaterThanOrEqual(4);
				expect(challenge.nodeCount).toBeLessThanOrEqual(6);
			}
		}
	});
});

describe("puntos de hub", () => {
	it("el pulso pasa tal cual y la memoria pesa por rondas", () => {
		expect(HUB_POINTS_PER_GAME.impulse(340)).toBe(340);
		expect(HUB_POINTS_PER_GAME.memory(3)).toBe(120);
		expect(HUB_POINTS_PER_GAME.memory(0)).toBe(0);
	});

	it("no hay puntos negativos ni fracciones", () => {
		expect(HUB_POINTS_PER_GAME.impulse(-50)).toBe(0);
		expect(HUB_POINTS_PER_GAME.impulse(12.6)).toBe(13);
	});
});

describe("rangos", () => {
	it("empieza en Cadete y sube por umbrales", () => {
		expect(rankOf(0)).toMatchObject({ name: "Cadete", next: { name: "Piloto", min: 400 } });
		expect(rankOf(399).name).toBe("Cadete");
		expect(rankOf(400).name).toBe("Piloto");
		expect(rankOf(3000).name).toBe("Comandante");
	});

	it("el último rango no promete otro", () => {
		const top = rankOf(999_999);
		expect(top.name).toBe("Soberano");
		expect(top.next).toBeUndefined();
	});

	it("los puntos negativos o basura no rompen el rango", () => {
		expect(rankOf(-100).name).toBe("Cadete");
		expect(rankOf(Number.NaN).name).toBe("Cadete");
	});
});

describe("progreso", () => {
	const first = recordRun(EMPTY_PROFILE, {
		game: "impulse",
		score: 240,
		at: day("2026-11-07"),
		daily: "2026-11-07",
	});

	it("suma puntos, partidas y mejor marca", () => {
		expect(first).toMatchObject({ points: 240, runs: 1, streak: 1, lastPlayed: "2026-11-07" });
		expect(first.best).toEqual({ impulse: 240, memory: 0 });
		expect(first.dailyDone).toBe("2026-11-07");
	});

	it("la mejor marca no baja con una partida peor", () => {
		const worse = recordRun(first, { game: "impulse", score: 100, at: day("2026-11-07") });
		expect(worse.best.impulse).toBe(240);
		expect(worse.points).toBe(340);
	});

	it("jugar dos veces el mismo día no infla la racha", () => {
		const twice = recordRun(first, { game: "memory", score: 2, at: day("2026-11-07") });
		expect(twice.streak).toBe(1);
	});

	it("un día seguido sube la racha y un hueco la reinicia", () => {
		const next = recordRun(first, { game: "memory", score: 2, at: day("2026-11-08") });
		expect(next.streak).toBe(2);
		const afterGap = recordRun(next, { game: "memory", score: 2, at: day("2026-11-15") });
		expect(afterGap.streak).toBe(1);
	});

	it("el historial se queda en las últimas partidas", () => {
		let profile = EMPTY_PROFILE;
		for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
			profile = recordRun(profile, {
				game: "memory",
				score: 1,
				at: new Date(Date.UTC(2026, 10, 1, 12, i)),
			});
		}
		expect(profile.history).toHaveLength(HISTORY_LIMIT);
		expect(profile.runs).toBe(HISTORY_LIMIT + 5);
	});
});

describe("liga local", () => {
	it("sólo cuenta la temporada en curso y ordena por puntos", () => {
		let profile = EMPTY_PROFILE;
		profile = recordRun(profile, { game: "memory", score: 1, at: day("2026-10-30") });
		profile = recordRun(profile, { game: "impulse", score: 120, at: day("2026-11-02") });
		profile = recordRun(profile, { game: "impulse", score: 400, at: day("2026-11-03") });

		const ladder = seasonLadder(profile, day("2026-11-07"));
		expect(ladder).toHaveLength(2);
		expect(ladder[0]).toMatchObject({ game: "impulse", points: 400 });
	});
});
