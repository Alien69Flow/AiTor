import { supabase } from "@/integrations/supabase/client";
import type { Tier } from "@/lib/globe-layers";
import {
	BILLING_CYCLES,
	NFT_DOMAIN,
	PAYMENT_DOMAIN,
	PAY_CHAINS,
	PRICE_VERSION,
	type BillingCycle,
	type PayChain,
	type PayToken,
} from "./pricing";

/** Plan de la escalera que se compra con stablecoin. */
export type PlanId = Tier;

export type { BillingCycle, PayChain, PayToken };
export { BILLING_CYCLES, NFT_DOMAIN, PAYMENT_DOMAIN, PAY_CHAINS, PRICE_VERSION };

export interface RecipientInfo {
	domain: string;
	address: `0x${string}`;
	record: string;
}

const cached: Record<string, RecipientInfo> = {};

/**
 * Dirección que cobra, resuelta desde `alienflow.crypto`.
 *
 * La resolución la hace la Edge Function `web3-recipient` contra el perfil
 * público del dominio, así que la interfaz nunca hardcodea una wallet y puede
 * cambiarse la de cobro sin recompilar la web.
 */
export async function resolvePaymentRecipient(chain: PayChain): Promise<RecipientInfo> {
	const key = `${PAYMENT_DOMAIN}:${chain}`;
	if (cached[key]) return cached[key];
	const { data, error } = await supabase.functions.invoke("web3-recipient", {
		body: { domain: PAYMENT_DOMAIN, chain },
	});
	if (error) throw new Error(error.message);
	if (!data?.address) throw new Error(data?.error || "No se pudo resolver la dirección de cobro");
	cached[key] = data as RecipientInfo;
	return cached[key];
}

export const ERC20_TRANSFER_ABI = [
	{
		name: "transfer",
		type: "function",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "to", type: "address" },
			{ name: "amount", type: "uint256" },
		],
		outputs: [{ name: "", type: "bool" }],
	},
] as const;
