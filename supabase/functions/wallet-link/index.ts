import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyMessage } from "https://esm.sh/viem@2.53.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const addressPattern = /^0x[a-fA-F0-9]{40}$/;

type Challenge = {
  id: string;
  user_id: string;
  chain_id: string;
  address: string;
  message: string;
  expires_at: string;
  used_at: string | null;
};

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authorization || !url || !anonKey || !serviceKey) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  const user = authData.user;
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const action = payload.action;
  const rawAddress = typeof payload.address === "string" ? payload.address : "";
  const address = rawAddress.toLowerCase();
  const chainId = typeof payload.chain_id === "string" ? payload.chain_id : "eip155:137";
  if (!addressPattern.test(address) || !/^eip155:\d+$/.test(chainId)) {
    return json({ error: "Invalid wallet address or chain" }, 400);
  }

  const admin = createClient(url, serviceKey);

  if (action === "challenge") {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
    const id = crypto.randomUUID();
    const message = [
      "AI Tor wallet verification",
      "",
      `Wallet: ${address}`,
      `Chain: ${chainId}`,
      `Account: ${user.id}`,
      `Nonce: ${id}`,
      `Issued At: ${now.toISOString()}`,
      `Expiration Time: ${expiresAt.toISOString()}`,
      "",
      "This signature proves wallet ownership. It does not create a transaction or grant paid access.",
    ].join("\n");

    await admin
      .from("wallet_verification_challenges")
      .update({ used_at: now.toISOString() })
      .eq("user_id", user.id)
      .eq("chain_id", chainId)
      .eq("address", address)
      .is("used_at", null);

    const { error } = await admin.from("wallet_verification_challenges").insert({
      id,
      user_id: user.id,
      chain_id: chainId,
      address,
      message,
      expires_at: expiresAt.toISOString(),
    });
    if (error) {
      console.error("Unable to create wallet challenge", error.message);
      return json({ error: "Unable to create verification challenge" }, 500);
    }
    return json({ id, message, expires_at: expiresAt.toISOString() });
  }

  if (action !== "verify") return json({ error: "Unsupported action" }, 400);
  const challengeId = typeof payload.challenge_id === "string" ? payload.challenge_id : "";
  const signature = typeof payload.signature === "string" ? payload.signature : "";
  if (!challengeId || !/^0x[0-9a-fA-F]+$/.test(signature)) {
    return json({ error: "Invalid verification payload" }, 400);
  }

  const { data: challengeData, error: challengeError } = await admin
    .from("wallet_verification_challenges")
    .select("id, user_id, chain_id, address, message, expires_at, used_at")
    .eq("id", challengeId)
    .maybeSingle();
  const challenge = challengeData as Challenge | null;
  if (challengeError || !challenge || challenge.user_id !== user.id || challenge.address !== address || challenge.chain_id !== chainId) {
    return json({ error: "Verification challenge not found" }, 404);
  }
  if (challenge.used_at || new Date(challenge.expires_at).getTime() <= Date.now()) {
    return json({ error: "Verification challenge expired" }, 410);
  }

  const validSignature = await verifyMessage({
    address: challenge.address as `0x${string}`,
    message: challenge.message,
    signature: signature as `0x${string}`,
  });
  if (!validSignature) return json({ error: "Wallet signature could not be verified" }, 401);

  const { data: existing, error: identityError } = await admin
    .from("wallet_identities")
    .select("id, user_id")
    .eq("chain_id", chainId)
    .eq("address", address)
    .maybeSingle();
  if (identityError) return json({ error: "Unable to check wallet identity" }, 500);
  if (existing && existing.user_id !== user.id) {
    return json({ error: "This wallet is already linked to another account" }, 409);
  }

  const verifiedAt = new Date().toISOString();
  const identity = {
    user_id: user.id,
    chain_id: chainId,
    address,
    verification_message: challenge.message,
    verified_at: verifiedAt,
    updated_at: verifiedAt,
  };
  const write = existing
    ? admin.from("wallet_identities").update(identity).eq("id", existing.id)
    : admin.from("wallet_identities").insert(identity);
  const { error: writeError } = await write;
  if (writeError) {
    console.error("Unable to save wallet identity", writeError.message);
    return json({ error: "Unable to link wallet" }, 500);
  }

  await admin.from("wallet_verification_challenges").update({ used_at: verifiedAt }).eq("id", challenge.id);
  return json({ linked: true, address, chain_id: chainId, verified_at: verifiedAt });
});
