// Verifies an on-chain USDC payment and activates the paid tier for the user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { resolveRecipient } from "../_shared/uns.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHAINS: Record<string, { rpc: string; usdc: string; explorer: string }> = {
  base: {
    rpc: "https://mainnet.base.org",
    usdc: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    explorer: "https://basescan.org/tx/",
  },
  polygon: {
    rpc: "https://polygon-rpc.com",
    usdc: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
    explorer: "https://polygonscan.com/tx/",
  },
};

const PLANS: Record<string, { tier: string; price: number }> = {
  architect: { tier: "basic", price: 29 },
  alien: { tier: "pro", price: 99 },
};

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

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
    const { data: userData, error: userError } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userData?.user;
    if (userError || !user) return json({ error: "Sesión inválida" }, 401);

    const { txHash, chain, plan, wallet } = await req.json();
    const chainInfo = CHAINS[chain];
    const planInfo = PLANS[plan];
    if (!chainInfo || !planInfo) return json({ error: "Plan o red no soportados" }, 400);
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash ?? "")) return json({ error: "Hash de transacción inválido" }, 400);

    // Reject replays before touching the chain.
    const { data: existing } = await admin
      .from("crypto_payments")
      .select("id, user_id")
      .eq("tx_hash", txHash.toLowerCase())
      .maybeSingle();
    if (existing) return json({ error: "Esta transacción ya fue utilizada" }, 409);

    const recipient = await resolveRecipient("alienflow.crypto", chain);
    if (!recipient) return json({ error: "No se pudo resolver la dirección de cobro" }, 503);

    const receipt = await waitForReceipt(chainInfo.rpc, txHash);
    if (!receipt) return json({ error: "La transacción aún no se ha confirmado. Inténtalo en unos segundos." }, 202);
    if (receipt.status !== "0x1") return json({ error: "La transacción falló en la red" }, 400);

    const expected = BigInt(Math.round(planInfo.price * 1_000_000));
    const toTopic = "0x" + recipient.address.toLowerCase().replace("0x", "").padStart(64, "0");

    const paid = (receipt.logs ?? []).some((log: any) =>
      log.address?.toLowerCase() === chainInfo.usdc &&
      log.topics?.[0]?.toLowerCase() === TRANSFER_TOPIC &&
      log.topics?.[2]?.toLowerCase() === toTopic &&
      BigInt(log.data) >= expected
    );
    if (!paid) return json({ error: `No se encontró un pago de ${planInfo.price} USDC a ${recipient.domain}` }, 400);

    const { error: creditError } = await admin
      .from("user_credits")
      .upsert(
        { user_id: user.id, paid_tier: planInfo.tier, used: 0, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (creditError) throw creditError;

    await admin.from("crypto_payments").insert({
      user_id: user.id,
      tx_hash: txHash.toLowerCase(),
      chain,
      plan: planInfo.tier,
      amount_usd: planInfo.price,
      wallet_address: typeof wallet === "string" ? wallet.toLowerCase() : null,
      recipient: `${recipient.domain} (${recipient.address})`,
    });

    return json({
      success: true,
      tier: planInfo.tier,
      plan,
      explorer: chainInfo.explorer + txHash,
    });
  } catch (error) {
    console.error("verify-crypto-payment", error);
    return json({ error: error instanceof Error ? error.message : "Error verificando el pago" }, 500);
  }
});

async function waitForReceipt(rpc: string, txHash: string, attempts = 12) {
  for (let i = 0; i < attempts; i++) {
    const response = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [txHash] }),
    });
    const body = await response.json();
    if (body?.result) return body.result;
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  return null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
