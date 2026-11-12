import { describe, expect, it } from "vitest";
import {
	BILLING_CYCLES,
	PAYMENT_DOMAIN,
	PAY_CHAINS,
	PRICE_VERSION,
	cyclePrice,
	formatPrice,
	monthlyEquivalent,
	synapsePriceLabel,
} from "./pricing";

/**
 * El precio que se enseña y el que se exige al verificar el pago salen del
 * mismo fichero que importa la Edge Function. Lo que se fija aquí es que ese
 * fichero no cambie de forma silenciosa: importes, rieles y tokens.
 */

describe("precios de los planes", () => {
	it("mensual, trimestral y anual son 9, 24 y 99", () => {
		expect(BILLING_CYCLES.monthly.price).toBe(9);
		expect(BILLING_CYCLES.quarterly.price).toBe(24);
		expect(BILLING_CYCLES.yearly.price).toBe(99);
	});

	it("el precio por mes baja al alargar el periodo", () => {
		expect(monthlyEquivalent("monthly")).toBe(9);
		expect(monthlyEquivalent("quarterly")).toBe(8);
		expect(monthlyEquivalent("yearly")).toBe(8.25);
	});

	it("la etiqueta del plan sale del ciclo más barato por mes", () => {
		// 24 / 3 = 8 gana a 99 / 12 = 8,25: el trimestral es el más barato.
		expect(Math.min(...(Object.keys(BILLING_CYCLES) as (keyof typeof BILLING_CYCLES)[]).map(monthlyEquivalent))).toBe(8);
		expect(synapsePriceLabel()).toBe("desde 8 USDC / mes");
	});

	it("formatea con coma y sin decimales de relleno", () => {
		expect(formatPrice(8)).toBe("8");
		expect(formatPrice(8.25)).toBe("8,25");
		expect(formatPrice(9.5)).toBe("9,5");
	});

	it("no se cobra un ciclo inventado", () => {
		expect(cyclePrice("monthly")).toBe(9);
		expect(cyclePrice("weekly")).toBeNull();
		expect(cyclePrice(undefined)).toBeNull();
		expect(cyclePrice(9)).toBeNull();
	});

	it("la versión de tarifa se puede fechar", () => {
		expect(PRICE_VERSION).toMatch(/^\d{4}-\d{2}-\d+$/);
	});
});

describe("rieles de cobro", () => {
	it("sólo hay Base y Polygon, con USDC y USDT de seis decimales", () => {
		expect(Object.keys(PAY_CHAINS).sort()).toEqual(["base", "polygon"]);
		for (const chain of Object.values(PAY_CHAINS)) {
			expect(Object.keys(chain.tokens).sort()).toEqual(["USDC", "USDT"]);
			for (const token of Object.values(chain.tokens)) {
				expect(token.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
				expect(token.decimals).toBe(6);
			}
		}
	});

	it("el cobro va a un dominio, no a una wallet escrita en el código", () => {
		expect(PAYMENT_DOMAIN).toBe("alienflow.crypto");
	});
});
