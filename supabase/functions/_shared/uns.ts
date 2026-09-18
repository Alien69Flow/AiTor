// Shared Unstoppable Domains resolution used by the payment endpoints.
// Reads the public profile records API (no key required) and picks the best
// EVM payout address for the requested chain.

const PROFILE_API = "https://api.unstoppabledomains.com/profile/public";

const KEYS_BY_CHAIN: Record<string, string[]> = {
  base: [
    "crypto.USDC.version.BASE.address",
    "token.EVM.BASE.USDC.address",
    "token.EVM.BASE.address",
    "crypto.ETH.version.BASE.address",
  ],
  polygon: [
    "crypto.USDC.version.MATIC.address",
    "token.EVM.MATIC.USDC.address",
    "crypto.MATIC.version.MATIC.address",
    "token.EVM.MATIC.address",
  ],
};

const FALLBACK_KEYS = [
  "crypto.USDC.version.ERC20.address",
  "crypto.ETH.address",
  "token.EVM.ETH.ETH.address",
];

const cache = new Map<string, { value: ResolvedRecipient; expires: number }>();

export interface ResolvedRecipient {
  domain: string;
  address: string;
  record: string;
  chain: string;
}

export function isSupportedDomain(domain: string) {
  return /^[a-z0-9-]+\.(crypto|nft|x|wallet|dao|blockchain|bitcoin|888|zil|polygon|unstoppable)$/i.test(domain);
}

const isEvmAddress = (value: unknown): value is string =>
  typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);

export async function resolveRecipient(domain: string, chain: string): Promise<ResolvedRecipient | null> {
  const key = `${domain}:${chain}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  try {
    const response = await fetch(
      `${PROFILE_API}/${encodeURIComponent(domain.toLowerCase())}?fields=records`,
      { headers: { Accept: "application/json" } },
    );
    if (response.ok) {
      const body = await response.json();
      const records: Record<string, string> = body?.records ?? {};
      const owner: string | undefined = body?.metadata?.owner;

      for (const recordKey of [...(KEYS_BY_CHAIN[chain] ?? []), ...FALLBACK_KEYS]) {
        if (isEvmAddress(records[recordKey])) {
          return remember(key, { domain, address: records[recordKey], record: recordKey, chain });
        }
      }
      if (isEvmAddress(owner)) {
        return remember(key, { domain, address: owner, record: "domain.owner", chain });
      }
    }
  } catch (error) {
    console.error("uns resolve failed", error);
  }

  const fallback = Deno.env.get("PAYOUT_WALLET_ADDRESS");
  if (isEvmAddress(fallback)) {
    return { domain, address: fallback, record: "env.fallback", chain };
  }
  return null;
}

function remember(key: string, value: ResolvedRecipient) {
  cache.set(key, { value, expires: Date.now() + 30 * 60_000 });
  return value;
}
