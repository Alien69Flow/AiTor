// Verifies DAO NFT ownership and governance-token balances for a signed wallet,
// then upgrades the caller's tier (pro = Oracle, quantum = Quantum).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { verifyMessage } from "https://esm.sh/viem@2.21.54";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RPCS: Record<string, string> = {
  base: "https://mainnet.base.org",
  polygon: "https://polygon-rpc.com",
  ethereum: "https://eth.llamarpc.com",
};

/** `chain:0xcontract` entries, comma separated, configured as secrets. */
const NFT_ENV = ["DAO_NFT_CONTRACTS"];
const TOKEN_ENV: { key: string; symbol: string; threshold: number }[] = [
  { key: "AFS_TOKEN", symbol: "AFS", threshold: 1234 },
  { key: "A69F_TOKEN", symbol: "A69F", threshold: 369 },
  { key: "ABTC_TOKEN", symbol: "ABTC", threshold: 1 },
];

const BALANCE_OF = "0x70a08231";
const DECIMALS = "0x313ce567";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "No autenticado" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data: userData } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userData?.user;
    if (!user) return json({ error: "Sesión inválida" }, 401);

    const { address, message, signature } = await req.json();
    if (!/^0x[a-fA-F0-9]{40}$/.test(address ?? "")) return json({ error: "Dirección inválida" }, 400);
    if (typeof message !== "string" || !message.includes(address)) return json({ error: "Mensaje inválido" }, 400);
    if (!/^0x[a-fA-F0-9]{130,}$/.test(signature ?? "")) return json({ error: "Firma inválida" }, 400);

    const valid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
    if (!valid) return json({ error: "La firma no es válida" }, 401);

    const configured = NFT_ENV.flatMap((k) => parseContracts(Deno.env.get(k)));
    if (configured.length === 0) {
      return json({
        error:
          "Los contratos de los NFTs de la DAO todavía no están configurados. Añádelos para activar Oracle y Quantum.",
      }, 503);
    }

    let hasNft = false;
    for (const c of configured) {
      const bal = await balanceOf(c.chain, c.address, address);
      if (bal > 0n) { hasNft = true; break; }
    }

    const tokens: Record<string, string> = {};
    let tokenThresholdMet = false;
    for (const t of TOKEN_ENV) {
      const entries = parseContracts(Deno.env.get(t.key));
      for (const c of entries) {
        const raw = await balanceOf(c.chain, c.address, address);
        const dec = await decimalsOf(c.chain, c.address);
        const human = Number(raw) / 10 ** dec;
        tokens[t.symbol] = human.toLocaleString("es-ES", { maximumFractionDigits: 4 });
        if (human >= t.threshold) tokenThresholdMet = true;
      }
    }

    const tier = hasNft && tokenThresholdMet ? "quantum" : hasNft ? "oracle" : null;
    if (!tier) {
      return json({ tier: null, nft: hasNft, tokens, message: "No se encontraron NFTs de la DAO en esta wallet." });
    }

    const dbTier = tier === "quantum" ? "quantum" : "pro";
    const { error: upsertError } = await admin.from("user_credits").upsert(
      { user_id: user.id, paid_tier: dbTier, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
    if (upsertError) throw upsertError;

    return json({
      tier,
      nft: hasNft,
      tokens,
      message: tier === "quantum" ? "Acceso QUANTUM activado." : "Acceso ORACLE activado.",
    });
  } catch (error) {
    console.error("verify-dao-holdings", error);
    return json({ error: error instanceof Error ? error.message : "Error verificando holdings" }, 500);
  }
});

function parseContracts(value?: string | null) {
  if (!value) return [] as { chain: string; address: string }[];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [chain, addr] = entry.includes(":") ? entry.split(":") : ["polygon", entry];
      return { chain: chain.trim().toLowerCase(), address: addr.trim().toLowerCase() };
    })
    .filter((c) => RPCS[c.chain] && /^0x[a-f0-9]{40}$/.test(c.address));
}

async function rpcCall(chain: string, to: string, data: string): Promise<string | null> {
  const response = await fetch(RPCS[chain], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to, data }, "latest"],
    }),
  });
  const body = await response.json();
  return typeof body?.result === "string" ? body.result : null;
}

async function balanceOf(chain: string, contract: string, owner: string) {
  const data = BALANCE_OF + owner.toLowerCase().replace("0x", "").padStart(64, "0");
  const result = await rpcCall(chain, contract, data);
  if (!result || result === "0x") return 0n;
  try { return BigInt(result); } catch { return 0n; }
}

async function decimalsOf(chain: string, contract: string) {
  const result = await rpcCall(chain, contract, DECIMALS);
  if (!result || result === "0x") return 18;
  try { return Number(BigInt(result)); } catch { return 18; }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
