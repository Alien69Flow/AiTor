/**
 * Precios y rieles de cobro: la única definición.
 *
 * Vive en `_shared` porque lo consumen la Edge Function que verifica el pago y
 * la web (`src/lib/web3/pricing.ts` lo reexporta). No usa APIs de Deno a
 * propósito: así el mismo objeto corre en Vitest y la interfaz no puede enseñar
 * un precio distinto del que el servidor exige al comprobar la transacción.
 *
 * Cambiar un precio aquí lo cambia en las dos orillas a la vez. `PRICE_VERSION`
 * se sube con cada cambio y se guarda en cada pago, para poder auditar después
 * qué tarifa se aplicó a quién.
 */

export const PRICE_VERSION = "2026-11-1";

export type BillingCycle = "monthly" | "quarterly" | "yearly";
export type PayChain = "base" | "polygon";
export type PayToken = "USDC" | "USDT";

export interface CycleDef {
	label: string;
	/** Stablecoins que se cobran por el periodo entero. */
	priceUsd: number;
	note: string;
}

export const BILLING_CYCLES: Record<BillingCycle, CycleDef> = {
	monthly: { label: "Mensual", priceUsd: 9, note: "9 / mes" },
	quarterly: { label: "Trimestral", priceUsd: 24, note: "8 / mes" },
	yearly: { label: "Anual", priceUsd: 99, note: "8,25 / mes" },
};

export interface TokenDef {
	address: `0x${string}`;
	decimals: number;
}

export interface ChainDef {
	id: number;
	label: string;
	rpc: string;
	explorer: string;
	tokens: Record<PayToken, TokenDef>;
}

/** Sólo redes de comisión baja: el usuario paga el gas, no nosotros. */
export const PAY_CHAINS: Record<PayChain, ChainDef> = {
	base: {
		id: 8453,
		label: "Base",
		rpc: "https://mainnet.base.org",
		explorer: "https://basescan.org/tx/",
		tokens: {
			USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
			USDT: { address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6 },
		},
	},
	polygon: {
		id: 137,
		label: "Polygon",
		rpc: "https://polygon-rpc.com",
		explorer: "https://polygonscan.com/tx/",
		tokens: {
			USDC: { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
			USDT: { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
		},
	},
};

/** Dominios Web3 que reciben el dinero: en la interfaz nunca hay una wallet cruda. */
export const PAYMENT_DOMAIN = "alienflow.crypto";
export const NFT_DOMAIN = "alienflow.nft";

/** Precio por mes de un ciclo, redondeado a céntimos. */
export function monthlyEquivalent(cycle: BillingCycle): number {
	const months = cycle === "monthly" ? 1 : cycle === "quarterly" ? 3 : 12;
	return Math.round((BILLING_CYCLES[cycle].priceUsd / months) * 100) / 100;
}

/**
 * Importe con dos decimales como mucho y coma decimal.
 *
 * Se formatea a mano en vez de con `toLocaleString`: la etiqueta tiene que ser
 * la misma en Node (pruebas) y en el navegador, sin depender del ICU instalado.
 * El cero de relleno se recorta (9,5 y no 9,50): es lo que promete «como
 * mucho» y lo que se lee mejor en una tarjeta de precio.
 */
export function formatPrice(value: number): string {
	const rounded = Math.round(value * 100) / 100;
	if (Number.isInteger(rounded)) return String(rounded);
	const text = rounded.toFixed(2).replace(".", ",");
	return text.endsWith("0") ? text.slice(0, -1) : text;
}

/** Texto de la tarjeta Synapse, derivado del precio y no escrito a mano. */
export function synapsePriceLabel(): string {
	const cheapest = Math.min(...(Object.keys(BILLING_CYCLES) as BillingCycle[]).map(monthlyEquivalent));
	return `desde ${formatPrice(cheapest)} USDC / mes`;
}

/** Qué se cobra por un ciclo, o `null` si el ciclo no existe. */
export function cyclePrice(cycle: unknown): number | null {
	if (typeof cycle !== "string") return null;
	const def = BILLING_CYCLES[cycle as BillingCycle];
	return def ? def.priceUsd : null;
}
