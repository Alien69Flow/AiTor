import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/integrations/supabase/client";
import { TIER_RANK, type Tier } from "@/lib/globe-layers";
import { readPlanExpiry, resolveTier, type PlanExpiry } from "@/lib/tier-access";

type CreditRow = { paid_tier?: string; paid_until?: string | null };

/**
 * Fila de créditos del usuario.
 *
 * Se pide `paid_until` y, si la consulta falla, se reintenta sin la fecha: una
 * base a la que todavía no se le aplicó la migración de caducidad no puede
 * dejar a un suscriptor sin su plan. Es el mismo criterio que el resto del
 * hook: un fallo de lectura como mucho deja de reconocer la caducidad, nunca
 * quita el plan que la persona está pagando.
 */
async function readCredits(userId: string): Promise<CreditRow | null> {
  const withExpiry = await authClient
    .from("user_credits")
    .select("paid_tier, paid_until")
    .eq("user_id", userId)
    .maybeSingle();
  if (!withExpiry.error) return (withExpiry.data as CreditRow | null) ?? null;

  const withoutExpiry = await authClient
    .from("user_credits")
    .select("paid_tier")
    .eq("user_id", userId)
    .maybeSingle();
  if (withoutExpiry.error) throw withoutExpiry.error;
  return (withoutExpiry.data as CreditRow | null) ?? null;
}

/**
 * Plan del visitante para el gating de capas.
 *
 * Si la consulta de `user_credits` rechaza, no hay `catch` que deje el estado a
 * medias: la resolución vive en `resolveTier` (probada) y un fallo de lectura
 * como mucho deja de reconocer un plan de pago, nunca quita el Node que da
 * tener sesión.
 *
 * El plan de pago caduca: la consulta trae `paid_until`, el tier se resuelve
 * con esa fecha y el vencimiento se expone tal cual para que la interfaz pueda
 * avisar antes de que se acabe.
 */
export function useTier() {
  const [state, setState] = useState<{
    tier: Tier;
    loading: boolean;
    authed: boolean;
    paidTier: string | null;
    paidUntil: string | null;
    expiry: PlanExpiry;
  }>({
    tier: "signal",
    loading: true,
    authed: false,
    paidTier: null,
    paidUntil: null,
    expiry: { expiresAt: null, daysLeft: null, expired: false, expiringSoon: false },
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      let authed = false;
      let paidTier: string | null = null;
      let paidUntil: string | null = null;

      try {
        // Créditos y sesión viven juntos: se leen del proyecto de identidad, que
        // es el único que puede validar este JWT (RLS: sólo tu propia fila).
        const { data: userData } = await authClient.auth.getUser();
        const user = userData?.user;
        authed = Boolean(user);
        if (user) {
          const row = await readCredits(user.id);
          paidTier = row?.paid_tier ?? null;
          paidUntil = row?.paid_until ?? null;
        }
      } catch (error) {
        // Se registra y se sigue: con sesión conocida el plan mínimo ya es Node.
        console.warn("[useTier] no se pudo leer el plan; se usa el mínimo de la sesión:", error);
      }

      if (cancelled) return;
      setState({
        tier: resolveTier({ authed, paidTier, paidUntil }),
        loading: false,
        authed,
        paidTier,
        paidUntil,
        expiry: readPlanExpiry({ paidUntil }),
      });
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

  return {
    tier: state.tier,
    loading: state.loading,
    authed: state.authed,
    hasAccess,
    /** `user_credits.paid_tier`, tal cual (puede estar vencido). */
    paidTier: state.paidTier,
    /** `user_credits.paid_until`, tal cual. */
    paidUntil: state.paidUntil,
    /** Caducidad ya interpretada: fecha, días restantes y aviso. */
    expiry: state.expiry,
  };
}
