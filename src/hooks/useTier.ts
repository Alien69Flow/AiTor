import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/integrations/supabase/client";
import { TIER_RANK, type Tier } from "@/lib/globe-layers";

const DB_TO_TIER: Record<string, Tier> = {
  registered: "node",
  basic: "synapse",
  pro: "oracle",
  quantum: "quantum",
};

export function useTier() {
  const [state, setState] = useState<{ tier: Tier; loading: boolean; authed: boolean }>({
    tier: "signal",
    loading: true,
    authed: false,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Créditos y sesión viven juntos: se leen del proyecto de identidad, que
      // es el único que puede validar este JWT (RLS: sólo tu propia fila).
      const { data: userData } = await authClient.auth.getUser();
      const user = userData?.user;
      if (!user) {
        if (!cancelled) setState({ tier: "signal", loading: false, authed: false });
        return;
      }
      const { data } = await authClient
        .from("user_credits")
        .select("paid_tier")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const dbTier = (data as { paid_tier?: string } | null)?.paid_tier ?? "registered";
      setState({ tier: DB_TO_TIER[dbTier] ?? "node", loading: false, authed: true });
    };

    load();
    const { data: sub } = authClient.auth.onAuthStateChange(() => { load(); });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  const hasAccess = useCallback(
    (required: Tier) => TIER_RANK[state.tier] >= TIER_RANK[required],
    [state.tier]
  );

  return { tier: state.tier, loading: state.loading, authed: state.authed, hasAccess };
}
