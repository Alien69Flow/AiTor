/**
 * Los precios y rieles de cobro, vistos desde la web.
 *
 * La definición vive en `supabase/functions/_shared/pricing.ts` — el mismo
 * fichero que importa `verify-crypto-payment` — para que la interfaz no pueda
 * enseñar un precio distinto del que el servidor exige al verificar la
 * transacción. Aquí sólo se adapta la forma (`priceUsd` → `price`) y se
 * reexporta lo demás.
 */
import {
	BILLING_CYCLES as CYCLE_DEFS,
	PAY_CHAINS as CHAIN_DEFS,
	type BillingCycle,
	type PayChain,
	type PayToken,
} from "../../../supabase/functions/_shared/pricing";

export {
	cyclePrice,
	formatPrice,
	monthlyEquivalent,
	NFT_DOMAIN,
	PAYMENT_DOMAIN,
	PRICE_VERSION,
	synapsePriceLabel,
} from "../../../supabase/functions/_shared/pricing";
export type { BillingCycle, PayChain, PayToken };

export interface TokenInfo {
	address: `0x${string}`;
	decimals: number;
}

export interface PayChainInfo {
	id: number;
	label: string;
	explorer: string;
	tokens: Record<PayToken, TokenInfo>;
}

export interface BillingCycleInfo {
	label: string;
	price: number;
	note: string;
}

/** Mismos rieles que verifica el servidor: un objeto, no una copia. */
export const PAY_CHAINS: Record<PayChain, PayChainInfo> = CHAIN_DEFS;

/** El precio que se pinta es el que se cobra. */
export const BILLING_CYCLES: Record<BillingCycle, BillingCycleInfo> = Object.fromEntries(
	(Object.keys(CYCLE_DEFS) as BillingCycle[]).map((cycle) => [
		cycle,
		{ label: CYCLE_DEFS[cycle].label, price: CYCLE_DEFS[cycle].priceUsd, note: CYCLE_DEFS[cycle].note },
	]),
) as Record<BillingCycle, BillingCycleInfo>;
