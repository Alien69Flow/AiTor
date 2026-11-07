import { describe, expect, it } from "vitest";
import {
	CLOSE_DETAIL_M,
	MEDIUM_DETAIL_M,
	PLACES_MAX_M,
	resolveGlobeDetail,
} from "./globe-detail";

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

	it("enseña topónimos sólo cuando hay una región que nombrar", () => {
		expect(resolveGlobeDetail(400_000).showPlaces).toBe(true);
		expect(resolveGlobeDetail(PLACES_MAX_M - 1).showPlaces).toBe(true);
		expect(resolveGlobeDetail(PLACES_MAX_M).showPlaces).toBe(false);
		expect(resolveGlobeDetail(20_000_000).showPlaces).toBe(false);
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
