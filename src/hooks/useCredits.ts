import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

export type CreditTier = "anonymous" | "registered" | "basic" | "pro" | "quantum";

export const TIER_LIMITS: Record<CreditTier, number> = {
  anonymous: 5,
  registered: 15,
  basic: 60,
  pro: 200,
  quantum: 99999,
};

const STORAGE_KEY = "alienflow_credits_v1";
const DAY_MS = 24 * 60 * 60 * 1000;

interface CreditState {
  used: number;
  resetAt: number;
  paidTier?: "basic" | "pro" | "quantum";
}

function load(): CreditState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as CreditState;
      if (Date.now() > s.resetAt) {
        const fresh: CreditState = { used: 0, resetAt: Date.now() + DAY_MS, paidTier: s.paidTier };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
        return fresh;
      }
      return s;
    }
  } catch { /* ignore */ }
  const fresh: CreditState = { used: 0, resetAt: Date.now() + DAY_MS };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)); } catch { /* ignore */ }
  return fresh;
}

function persist(s: CreditState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export const PAYWALL_EVENT = "alienflow:paywall";

export function openPaywall(reason?: string) {
  window.dispatchEvent(new CustomEvent(PAYWALL_EVENT, { detail: { reason } }));
}

export function useCredits() {
  const { user } = useAuth();
  const [state, setState] = useState<CreditState>(() => load());
  const [server, setServer] = useState<{
    tier: "registered" | "basic" | "pro" | "quantum" | null;
    used: number | null;
    limit: number | null;
  }>({ tier: null, used: null, limit: null });

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setState(load());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Hydrate server-side credit state for authenticated users — paid tier is
  // never trusted from localStorage when a session exists.
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setServer({ tier: null, used: null, limit: null });
      return;
    }
    supabase
      .from("user_credits")
      .select("used, paid_tier")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const t = (data?.paid_tier as "registered" | "basic" | "pro" | "quantum" | undefined) ?? "registered";
        setServer({ tier: t, used: data?.used ?? 0, limit: TIER_LIMITS[t] });
      });
    return () => { cancelled = true; };
  }, [user]);

  const tier: CreditTier = user
    ? (server.tier ?? "registered")
    : "anonymous";
  const limit = user ? (server.limit ?? TIER_LIMITS[tier]) : TIER_LIMITS["anonymous"];
  const used = user ? (server.used ?? 0) : state.used;
  const left = Math.max(0, limit - used);

  const consume = useCallback(async (cost = 1, reason?: string): Promise<boolean> => {
    // Authenticated users: enforce server-side via consume_credits RPC.
    if (user) {
      const { data, error } = await supabase.functions.invoke("consume-credits", {
        body: { cost },
      });
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) {
        openPaywall(reason ?? "Credit check failed. Please retry.");
        return false;
      }
      const t = (row.tier as "registered" | "basic" | "pro" | "quantum") ?? "registered";
      setServer({ tier: t, used: row.used ?? 0, limit: row.limit ?? TIER_LIMITS[t] });
      if (!row.allowed) {
        openPaywall(reason ?? `You used ${row.used}/${row.limit} ${t.toUpperCase()} credits today.`);
        return false;
      }
      return true;
    }
    // Anonymous: localStorage fallback (no paid tiers possible).
    const current = load();
    const t: CreditTier = "anonymous";
    const lim = TIER_LIMITS[t];
    if (current.used + cost > lim) {
      openPaywall(reason ?? `You used ${current.used}/${lim} ${t.toUpperCase()} credits today.`);
      return false;
    }
    const next: CreditState = { used: current.used + cost, resetAt: current.resetAt };
    persist(next);
    setState(next);
    return true;
  }, [user]);

  // Paid tier is no longer settable from the client — must be granted
  // server-side (e.g. via a Stripe webhook updating user_credits.paid_tier
  // with the service role). Kept as a no-op for API compatibility.
  const setPaidTier = useCallback((_paidTier: "basic" | "pro" | "quantum") => {
    if (typeof console !== "undefined") {
      console.warn("[useCredits] setPaidTier is server-controlled and ignored on the client.");
    }
  }, []);

  return { tier, limit, used, left, consume, setPaidTier, openPaywall };
}