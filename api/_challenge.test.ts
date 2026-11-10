import { describe, expect, it } from "vitest";
import { countsForDaily, dateKey, dailySeed, seasonOf, serverChallenge, startOfUtcDay } from "./_challenge";
import { dailyChallenge, dateKey as hubDateKey, seasonOf as hubSeasonOf } from "../src/lib/games-hub";

/**
 * El reto del día se pinta en el navegador y se valida en el servidor. Si los
 * dos repartos se separan, la web enseñaría un reto que el servidor rechaza y
 * nadie podría completar el día. Aquí se comparan día a día, no por muestreo.
 */

describe("el servidor reparte el mismo reto que la web", () => {
	it("coincide durante 90 días seguidos", () => {
		const start = Date.UTC(2026, 0, 1);
		for (let day = 0; day < 90; day++) {
			const date = new Date(start + day * 86_400_000);
			expect(serverChallenge(date)).toEqual(dailyChallenge(date));
		}
	});

	it("el día y la temporada se leen en UTC, igual que en la web", () => {
		const lateNight = new Date(Date.UTC(2026, 10, 7, 23, 59));
		expect(dateKey(lateNight)).toBe("2026-11-07");
		expect(dateKey(lateNight)).toBe(hubDateKey(lateNight));
		expect(seasonOf(lateNight)).toBe("2026-11");
		expect(seasonOf(lateNight)).toBe(hubSeasonOf(lateNight));
	});
});

describe("validación del reto al puntuar", () => {
	it("acepta sólo el reto de hoy para el juego de hoy", () => {
		const today = new Date(Date.UTC(2026, 10, 10, 12, 0));
		const challenge = serverChallenge(today);
		expect(countsForDaily(challenge.game, challenge.id, today)).toBe(challenge.id);

		const otherGame = challenge.game === "impulse" ? "memory" : "impulse";
		expect(countsForDaily(otherGame, challenge.id, today)).toBeNull();
		expect(countsForDaily(challenge.game, "2020-01-01", today)).toBeNull();
		expect(countsForDaily(challenge.game, undefined, today)).toBeNull();
	});

	it("el hash del día es estable y el reparto no repite juego dos días seguidos", () => {
		expect(dailySeed("2026-11-10")).toBe(dailySeed("2026-11-10"));
		const a = serverChallenge(new Date(Date.UTC(2026, 10, 10)));
		const b = serverChallenge(new Date(Date.UTC(2026, 10, 11)));
		expect(a.game).not.toBe(b.game);
	});

	it("el día UTC empieza a medianoche, no a las 2 de la mañana", () => {
		expect(startOfUtcDay(new Date(Date.UTC(2026, 10, 10, 18, 30)))).toBe("2026-11-10T00:00:00.000Z");
	});
});
