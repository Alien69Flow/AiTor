import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TIER_RANK, type Tier } from "@/lib/globe-layers";

const DB_TO_TIER: Record<string, Tier> = {
  registered: "explorer",
  basic: "architect",
  pro: "alien",
  quantum: "alien",
};

type AccessStatus = {
  entitlements?: { tier: string }[];
};

function highestTier(tiers: string[]) {
  return tiers.reduce<Tier>((highest, candidate) => {
    const mapped = DB_TO_TIER[candidate] ?? "explorer";
    return TIER_RANK[mapped] > TIER_RANK[highest] ? mapped : highest;
  }, "explorer");
}

export function useTier() {
  const [state, setState] = useState<{ tier: Tier; loading: boolean; authed: boolean }>({
    tier: "explorer",
    loading: true,
    authed: false,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        if (!cancelled) setState({ tier: "explorer", loading: false, authed: false });
        return;
      }
      const { data } = await supabase
        .from("user_credits")
        .select("paid_tier")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const dbTier = (data as { paid_tier?: string } | null)?.paid_tier ?? "registered";
      const { data: accessData, error: accessError } = await supabase.functions.invoke<AccessStatus>("access-status", {
        body: {},
      });
      if (cancelled) return;
      const entitlementTier = accessError ? "explorer" : highestTier(accessData?.entitlements?.map((item) => item.tier) ?? []);
      const tier = TIER_RANK[entitlementTier] > TIER_RANK[DB_TO_TIER[dbTier] ?? "explorer"]
        ? entitlementTier
        : DB_TO_TIER[dbTier] ?? "explorer";
      setState({ tier, loading: false, authed: true });
    };

    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { load(); });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  const hasAccess = useCallback(
    (required: Tier) => TIER_RANK[state.tier] >= TIER_RANK[required],
    [state.tier]
  );

  return { tier: state.tier, loading: state.loading, authed: state.authed, hasAccess };
}
