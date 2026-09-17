// Resolves an Unstoppable Domains Web3 domain (alienflow.crypto / alienflow.nft)
// to a payout address on-chain, so the UI never hardcodes raw wallets.
import { guardPublic } from "../_shared/guard.ts";
import { isSupportedDomain, resolveRecipient } from "../_shared/uns.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const blocked = guardPublic(req, corsHeaders, 30);
  if (blocked) return blocked;

  try {
    const { domain = "alienflow.crypto", chain = "base" } = await req.json().catch(() => ({}));
    if (!isSupportedDomain(domain)) return json({ error: "Dominio no soportado" }, 400);

    const resolved = await resolveRecipient(domain, chain);
    if (!resolved) {
      return json({ error: `El dominio ${domain} no tiene dirección de cobro para ${chain}.` }, 404);
    }
    return json(resolved);
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
