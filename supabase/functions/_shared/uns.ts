// Shared Unstoppable Domains (UNS) resolution used by payment endpoints.
import { createPublicClient, http, namehash } from "https://esm.sh/viem@2.21.54";
import { polygon, mainnet } from "https://esm.sh/viem@2.21.54/chains";

const PROXY_READERS = [
  { chain: polygon, rpc: "https://polygon-rpc.com", address: "0xA3f32c8cd786dc089Bd1fC175F2707223aeE5d00" },
  { chain: mainnet, rpc: "https://eth.llamarpc.com", address: "0x1BDc0fD4fbABeed3E611fd6195fCd5d41dcEF393" },
] as const;

const ABI = [
  {
    name: "getMany",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "keys", type: "string[]" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [{ name: "", type: "string[]" }],
  },
] as const;

const KEYS_BY_CHAIN: Record<string, string[]> = {
  base: ["crypto.USDC.version.BASE.address", "crypto.ETH.version.BASE.address"],
  polygon: ["crypto.USDC.version.MATIC.address", "crypto.MATIC.version.MATIC.address"],
};

const DEFAULT_KEYS = ["crypto.ETH.address", "crypto.USDC.version.ERC20.address"];

const cache = new Map<string, { value: ResolvedRecipient; expires: number }>();

export interface ResolvedRecipient {
  domain: string;
  address: string;
  record: string;
  chain: string;
}

export function isSupportedDomain(domain: string) {
  return /^[a-z0-9-]+\.(crypto|nft|x|wallet|dao|blockchain|bitcoin|888|zil|polygon)$/i.test(domain);
}

export async function resolveRecipient(domain: string, chain: string): Promise<ResolvedRecipient | null> {
  const cacheKey = `${domain}:${chain}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return hit.value;

  const keys = [...(KEYS_BY_CHAIN[chain] ?? []), ...DEFAULT_KEYS];
  const tokenId = BigInt(namehash(domain.toLowerCase()));

  for (const reader of PROXY_READERS) {
    try {
      const client = createPublicClient({ chain: reader.chain, transport: http(reader.rpc) });
      const values = (await client.readContract({
        address: reader.address as `0x${string}`,
        abi: ABI,
        functionName: "getMany",
        args: [keys, tokenId],
      })) as string[];
      const index = values.findIndex((v) => /^0x[a-fA-F0-9]{40}$/.test(v ?? ""));
      if (index >= 0) {
        const value: ResolvedRecipient = { domain, address: values[index], record: keys[index], chain };
        cache.set(cacheKey, { value, expires: Date.now() + 30 * 60_000 });
        return value;
      }
    } catch (_error) {
      // try next registry
    }
  }

  const fallback = Deno.env.get("PAYOUT_WALLET_ADDRESS");
  if (fallback && /^0x[a-fA-F0-9]{40}$/.test(fallback)) {
    return { domain, address: fallback, record: "fallback", chain };
  }
  return null;
}
