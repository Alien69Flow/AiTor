// Sign-in with Ethereum: verifies a wallet signature and returns a magic-link
// token hash the client exchanges for a real session.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { verifyMessage } from "https://esm.sh/viem@2.21.54";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WALLET_EMAIL_DOMAIN = "wallet.alienflow.space";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { address, message, signature } = await req.json();
    if (!/^0x[a-fA-F0-9]{40}$/.test(address ?? "")) return json({ error: "Dirección inválida" }, 400);
    if (typeof message !== "string" || message.length < 20 || message.length > 1000) {
      return json({ error: "Mensaje inválido" }, 400);
    }
    if (!/^0x[a-fA-F0-9]{130,}$/.test(signature ?? "")) return json({ error: "Firma inválida" }, 400);
    if (!message.includes(address)) return json({ error: "El mensaje no corresponde a la wallet" }, 400);

    const valid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
    if (!valid) return json({ error: "La firma no es válida" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const email = `${address.toLowerCase()}@${WALLET_EMAIL_DOMAIN}`;

    const { error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { wallet_address: address.toLowerCase(), auth_method: "wallet" },
    });
    if (createError && !/already|registered|exists/i.test(createError.message)) throw createError;

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkError) throw linkError;

    return json({ email, token_hash: link.properties?.hashed_token });
  } catch (error) {
    console.error("wallet-auth", error);
    return json({ error: error instanceof Error ? error.message : "Error de autenticación" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
