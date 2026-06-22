import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";

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

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setState(load());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const tier: CreditTier =
    state.paidTier ? state.paidTier : user ? "registered" : "anonymous";
  const limit = TIER_LIMITS[tier];
  const left = Math.max(0, limit - state.used);

  const consume = useCallback((cost = 1, reason?: string): boolean => {
    const current = load();
    const t: CreditTier = current.paidTier ? current.paidTier : user ? "registered" : "anonymous";
    const lim = TIER_LIMITS[t];
    if (current.used + cost > lim) {
      openPaywall(reason ?? `You used ${current.used}/${lim} ${t.toUpperCase()} credits today.`);
      return false;
    }
    const next: CreditState = { ...current, used: current.used + cost };
    persist(next);
    setState(next);
    return true;
  }, [user]);

  const setPaidTier = useCallback((paidTier: "basic" | "pro" | "quantum") => {
    const next: CreditState = { ...load(), paidTier };
    persist(next);
    setState(next);
  }, []);

  return { tier, limit, used: state.used, left, consume, setPaidTier, openPaywall };
}