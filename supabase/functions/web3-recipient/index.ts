// Resolves an Unstoppable Domains Web3 domain (alienflow.crypto / alienflow.nft)
// to a payout address on-chain, so the UI never has to hardcode raw wallets.
import { createPublicClient, http, namehash } from "https://esm.sh/viem@2.21.54";
import { polygon, mainnet } from "https://esm.sh/viem@2.21.54/chains";
import { guardPublic } from "../_shared/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  base: ["crypto.USDC.version.BASE.address", "crypto.ETH.version.BASE.address", "crypto.ETH.address"],
  polygon: [
    "crypto.USDC.version.MATIC.address",
    "crypto.MATIC.version.MATIC.address",
    "crypto.ETH.address",
  ],
  default: ["crypto.ETH.address", "crypto.USDC.version.ERC20.address"],
};

const cache = new Map<string, { value: unknown; expires: number }>();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const blocked = guardPublic(req, corsHeaders, 30);
  if (blocked) return blocked;

  try {
    const { domain = "alienflow.crypto", chain = "base" } = await req.json().catch(() => ({}));
    if (!/^[a-z0-9-]+\.(crypto|nft|x|wallet|dao|blockchain|bitcoin|888|zil|polygon)$/i.test(domain)) {
      return json({ error: "Dominio no soportado" }, 400);
    }

    const cacheKey = `${domain}:${chain}`;
    const hit = cache.get(cacheKey);
    if (hit && hit.expires > Date.now()) return json(hit.value);

    const keys = [...(KEYS_BY_CHAIN[chain] ?? []), ...KEYS_BY_CHAIN.default];
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
          const payload = { domain, address: values[index], record: keys[index], chain };
          cache.set(cacheKey, { value: payload, expires: Date.now() + 30 * 60_000 });
          return json(payload);
        }
      } catch (_error) {
        // try next registry
      }
    }

    const fallback = Deno.env.get("PAYOUT_WALLET_ADDRESS");
    if (fallback && /^0x[a-fA-F0-9]{40}$/.test(fallback)) {
      return json({ domain, address: fallback, record: "fallback", chain });
    }

    return json({ error: `El dominio ${domain} no tiene dirección de cobro configurada para ${chain}.` }, 404);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Error de resolución" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
