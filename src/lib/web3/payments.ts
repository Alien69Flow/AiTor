import { supabase } from "@/integrations/supabase/client";
import type { Tier } from "@/lib/globe-layers";

export type PlanId = Tier;
export type PayChain = "base" | "polygon";
export type PayToken = "USDC" | "USDT";
export type BillingCycle = "monthly" | "quarterly" | "yearly";

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

/** Low-fee EVM rails supported for the Synapse subscription. */
export const PAY_CHAINS: Record<PayChain, PayChainInfo> = {
  base: {
    id: 8453,
    label: "Base",
    explorer: "https://basescan.org/tx/",
    tokens: {
      USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
      USDT: { address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6 },
    },
  },
  polygon: {
    id: 137,
    label: "Polygon",
    explorer: "https://polygonscan.com/tx/",
    tokens: {
      USDC: { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
      USDT: { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
    },
  },
};

/** Synapse subscription pricing, in stablecoin units. */
export const BILLING_CYCLES: Record<BillingCycle, { label: string; price: number; note: string }> = {
  monthly: { label: "Mensual", price: 9, note: "9 / mes" },
  quarterly: { label: "Trimestral", price: 24, note: "8 / mes" },
  yearly: { label: "Anual", price: 99, note: "8,25 / mes" },
};

/** Web3 domains used for receiving payments (no raw addresses in the UI). */
export const PAYMENT_DOMAIN = "alienflow.crypto";
export const NFT_DOMAIN = "alienflow.nft";

export interface RecipientInfo {
  domain: string;
  address: `0x${string}`;
  record: string;
}

const cached: Record<string, RecipientInfo> = {};

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
