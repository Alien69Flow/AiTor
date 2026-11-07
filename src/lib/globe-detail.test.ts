import { describe, expect, it } from "vitest";
import { CLOSE_DETAIL_M, MEDIUM_DETAIL_M, resolveGlobeDetail } from "./globe-detail";

describe("detalle del globo por altura", () => {
	it("aprieta el error de pantalla al acercarse", () => {
		expect(resolveGlobeDetail(300_000).maximumScreenSpaceError).toBe(0.9);
		expect(resolveGlobeDetail(CLOSE_DETAIL_M - 1).maximumScreenSpaceError).toBe(0.9);
		expect(resolveGlobeDetail(CLOSE_DETAIL_M).maximumScreenSpaceError).toBe(1.2);
		expect(resolveGlobeDetail(MEDIUM_DETAIL_M).maximumScreenSpaceError).toBe(1.6);
		// A escala de planeta se piden teselas gruesas: pedir 0,9 px desde
		// 20.000 km solo satura la red sin cambiar un píxel de la pantalla.
		expect(resolveGlobeDetail(20_000_000).maximumScreenSpaceError).toBe(1.6);
	});

	/**
	 * El mapa político no depende del zoom.
	 *
	 * Llegó a apagarse por encima de 2.500 km y el globo se abría sin un solo
	 * país dibujado: la vista de planeta se quedaba sin lo único que la hace
	 * legible. Esri ya elige qué rotula en cada nivel de tesela, así que aquí no
	 * hay nada que ahorrar apagando la capa entera.
	 */
	it("fronteras y topónimos están siempre encendidos", () => {
		for (const altitude of [400_000, 2_500_000, 6_000_000, 20_000_000, 40_000_000]) {
			expect(resolveGlobeDetail(altitude).showPlaces, String(altitude)).toBe(true);
		}
	});

	it("nunca devuelve valores imposibles", () => {
		for (const altitude of [-5, Number.NaN, Infinity]) {
			const detail = resolveGlobeDetail(altitude);
			expect(detail.maximumScreenSpaceError).toBeGreaterThan(0);
			expect(Number.isFinite(detail.maximumScreenSpaceError)).toBe(true);
			expect(typeof detail.showPlaces).toBe("boolean");
		}
	});
});
