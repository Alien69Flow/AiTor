import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/integrations/supabase/client";
import { TIER_RANK, type Tier } from "@/lib/globe-layers";
import { resolveTier } from "@/lib/tier-access";

/**
 * Plan del visitante para el gating de capas.
 *
 * Antes, si la consulta de `user_credits` rechazaba, no había `catch`: el estado
 * se quedaba cargando y el plan en `signal`, así que una cuenta registrada veía
 * media leyenda bloqueada. Ahora la resolución vive en `resolveTier` (probada) y
 * un fallo de lectura como mucho deja de reconocer un plan de pago, nunca quita
 * el Node que da tener sesión.
 */
export function useTier() {
  const [state, setState] = useState<{ tier: Tier; loading: boolean; authed: boolean }>({
    tier: "signal",
    loading: true,
    authed: false,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      let authed = false;
      let paidTier: string | null = null;

      try {
        // Créditos y sesión viven juntos: se leen del proyecto de identidad, que
        // es el único que puede validar este JWT (RLS: sólo tu propia fila).
        const { data: userData } = await authClient.auth.getUser();
        const user = userData?.user;
        authed = Boolean(user);
        if (user) {
          const { data } = await authClient
            .from("user_credits")
            .select("paid_tier")
            .eq("user_id", user.id)
            .maybeSingle();
          paidTier = (data as { paid_tier?: string } | null)?.paid_tier ?? null;
        }
      } catch (error) {
        // Se registra y se sigue: con sesión conocida el plan mínimo ya es Node.
        console.warn("[useTier] no se pudo leer el plan; se usa el mínimo de la sesión:", error);
      }

      if (cancelled) return;
      setState({ tier: resolveTier({ authed, paidTier }), loading: false, authed });
    };

    void load();
    const { data: sub } = authClient.auth.onAuthStateChange(() => void load());
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const hasAccess = useCallback(
    (required: Tier) => TIER_RANK[state.tier] >= TIER_RANK[required],
    [state.tier],
  );

  return { tier: state.tier, loading: state.loading, authed: state.authed, hasAccess };
}
