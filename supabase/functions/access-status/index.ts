import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Entitlement = {
  tier: string;
  source: "crypto_payment" | "nft" | "manual";
  starts_at: string;
  ends_at: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  const authorization = req.headers.get("Authorization");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!authorization || !url || !anonKey) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  const now = new Date().toISOString();
  const { data, error } = await client
    .from("access_entitlements")
    .select("tier, source, starts_at, ends_at")
    .eq("user_id", authData.user.id)
    .is("revoked_at", null)
    .lte("starts_at", now)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Unable to load access status", error.message);
    return Response.json({ error: "Unable to load access status" }, { status: 500, headers: corsHeaders });
  }

  return Response.json(
    { active: (data ?? []).length > 0, entitlements: (data ?? []) as Entitlement[] },
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
