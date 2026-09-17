import { supabase } from "@/integrations/supabase/client";

export type PlanId = "explorer" | "architect" | "alien";
export type PayChain = "base" | "polygon";

export interface PayChainInfo {
  id: number;
  label: string;
  usdc: `0x${string}`;
  explorer: string;
}

/** USDC (native) contracts on the supported low-fee chains. */
export const PAY_CHAINS: Record<PayChain, PayChainInfo> = {
  base: {
    id: 8453,
    label: "Base",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    explorer: "https://basescan.org/tx/",
  },
  polygon: {
    id: 137,
    label: "Polygon",
    usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    explorer: "https://polygonscan.com/tx/",
  },
};

/** Monthly price in USDC per plan. */
export const PLAN_PRICE_USDC: Record<Exclude<PlanId, "explorer">, number> = {
  architect: 29,
  alien: 99,
};

/** Web3 domains used for receiving payments (no raw addresses in the UI). */
export const PAYMENT_DOMAIN = "alienflow.crypto";
export const NFT_DOMAIN = "alienflow.nft";

export interface RecipientInfo {
  domain: string;
  address: `0x${string}`;
  record: string;
}

let cached: Record<string, RecipientInfo> = {};

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
