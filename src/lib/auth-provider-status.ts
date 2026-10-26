/**
 * Which social sign-in buttons actually work, asked instead of assumed.
 *
 * `GET /auth/v1/settings` alone is not enough: it reports a provider as enabled
 * as soon as its switch is on, even when the Client ID / Secret were never
 * saved. Those providers answer `400 ... missing OAuth secret` when the browser
 * asks to start the flow — a button that looks alive and dies on click.
 *
 * So each enabled provider is tried once, the way the button would, with
 * `redirect: "manual"`:
 *
 *   · a provider that can start answers 302 → the browser exposes that as an
 *     opaque redirect, which is the "ready" signal;
 *   · one without credentials answers 400 + `missing OAuth secret`;
 *   · one switched off answers 400 + `provider is not enabled`.
 *
 * Disabled providers are not probed at all: `/settings` already says so, and
 * that keeps the login page from firing nineteen requests. A network failure
 * resolves to "unknown" and leaves the button enabled, because a flaky
 * connection must not hide a working method.
 */
import { useEffect, useState } from "react";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";
import { GOTRUE_PROVIDER, type SocialProvider } from "@/hooks/useAuth";

export type ProviderState = "ready" | "missing-secret" | "disabled" | "unknown";

export type ProviderStates = Partial<Record<SocialProvider, ProviderState>>;

const SETTINGS_TIMEOUT_MS = 6000;
const PROBE_TIMEOUT_MS = 6000;

/** Providers switched on in the project, or null when settings cannot be read. */
async function enabledProviderIds(): Promise<Set<string> | null> {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
      signal: AbortSignal.timeout(SETTINGS_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const settings = (await response.json()) as { external?: Record<string, boolean> };
    return new Set(
      Object.entries(settings.external ?? {})
        .filter(([, enabled]) => enabled)
        .map(([id]) => id),
    );
  } catch {
    return null;
  }
}

/** Tries to start the provider's OAuth flow without navigating anywhere. */
async function probeProvider(providerId: string, redirectTo: string): Promise<ProviderState> {
  try {
    const query = new URLSearchParams({ provider: providerId, redirect_to: redirectTo });
    const response = await fetch(`${SUPABASE_URL}/auth/v1/authorize?${query}`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
      redirect: "manual",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });

    // 3xx (or the opaque redirect the browser turns it into) means GoTrue is
    // handing the browser to the provider: the credentials are there.
    if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
      return "ready";
    }

    const payload = (await response.json().catch(() => null)) as { msg?: string } | null;
    const message = String(payload?.msg ?? "");
    if (/missing oauth secret|missing secret/i.test(message)) return "missing-secret";
    if (/not enabled|not supported|unsupported provider/i.test(message)) return "disabled";
    return "unknown";
  } catch {
    return "unknown";
  }
}

/** Readiness per provider. Cached for the session: it changes only in the dashboard. */
let cache: { redirectTo: string; states: ProviderStates } | null = null;
let inflight: Promise<ProviderStates> | null = null;

export async function loadProviderStates(
  providers: readonly SocialProvider[],
  redirectTo: string,
): Promise<ProviderStates> {
  if (cache && cache.redirectTo === redirectTo) return cache.states;
  if (inflight) return inflight;

  inflight = (async () => {
    const enabled = await enabledProviderIds();
    const states: ProviderStates = {};

    if (enabled === null) {
      // Settings unreachable: claim nothing, disable nothing.
      for (const provider of providers) states[provider] = "unknown";
      return states;
    }

    await Promise.all(
      providers.map(async (provider) => {
        const id = GOTRUE_PROVIDER[provider];
        states[provider] = enabled.has(id) ? await probeProvider(id, redirectTo) : "disabled";
      }),
    );
    return states;
  })();

  try {
    const states = await inflight;
    cache = { redirectTo, states };
    return states;
  } finally {
    inflight = null;
  }
}

/** Test seam: forget the cached answer (e.g. after enabling a provider). */
export function resetProviderStatesCache(): void {
  cache = null;
  inflight = null;
}

export interface ProviderAvailability {
  states: ProviderStates;
  /** False until the first answer arrives, so the UI can stay neutral. */
  checked: boolean;
  /** Drops the cached answer and asks the server again. */
  refresh: () => void;
}

export function useProviderAvailability(
  providers: readonly SocialProvider[],
  redirectTo: string,
): ProviderAvailability {
  const [availability, setAvailability] = useState<Omit<ProviderAvailability, "refresh">>({
    states: cache?.redirectTo === redirectTo ? cache.states : {},
    checked: cache?.redirectTo === redirectTo,
  });
  // Bumped to re-run the probe after the owner saves credentials in Supabase,
  // so the page does not need a hard reload to notice.
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    void loadProviderStates(providers, redirectTo).then((states) => {
      if (active) setAvailability({ states, checked: true });
    });
    return () => {
      active = false;
    };
    // `providers` is a module-level constant at every call site; comparing it by
    // identity would re-probe on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redirectTo, nonce]);

  const refresh = () => {
    resetProviderStatesCache();
    setAvailability((current) => ({ ...current, checked: false }));
    setNonce((value) => value + 1);
  };

  return { ...availability, refresh };
}

/** Short label for the badge on a dead button. */
export function providerStateLabel(state: ProviderState | undefined): string | null {
  if (state === "missing-secret") return "sin configurar";
  if (state === "disabled") return "no activado";
  return null;
}
