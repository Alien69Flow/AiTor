/**
 * Ai Tor conversion analytics.
 *
 * One thin wrapper over @vercel/analytics so that:
 *  - a tracking failure can never break the app (everything is guarded), and
 *  - every event goes through a single, typed place with a stable name.
 *
 * Privacy: never pass secrets, wallet addresses, emails, prompts or chat
 * content. Props must stay coarse (function name, method, reason category).
 */
import { track as vercelTrack } from "@vercel/analytics";

/** The money/activation events we actually care about measuring. */
export type ConversionEvent =
  | "chat_opened"
  | "signup_completed"
  | "checkout_started"
  | "checkout_completed"
  | "checkout_failed"
  | "affiliate_click"
  | "supabase_function_error";

export type EventProps = Record<string, string | number | boolean | null | undefined>;

const MAX_PROP_LENGTH = 120;

/** Drop empty props and clamp length so we never ship a payload with user data. */
function sanitize(props: EventProps): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;
    out[key] = typeof value === "string" ? value.slice(0, MAX_PROP_LENGTH) : value;
  }
  return out;
}

/** Fire a conversion event. Never throws, never blocks the caller. */
export function track(event: ConversionEvent, props: EventProps = {}): void {
  try {
    vercelTrack(event, sanitize(props));
  } catch {
    // Analytics must never break the app.
  }
}

/** Coarse category for an error message, so we never ship raw server text. */
export function classifyError(error: unknown): string {
  const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  if (!message) return "unknown";
  if (message.includes("401") || message.includes("no autenticado") || message.includes("jwt") || message.includes("sesión")) {
    return "auth";
  }
  if (message.includes("429") || message.includes("rate limit") || message.includes("too many")) return "rate_limit";
  if (message.includes("403") || message.includes("forbidden")) return "forbidden";
  if (message.includes("404") || message.includes("not found")) return "not_found";
  if (message.includes("400") || message.includes("inválid") || message.includes("invalid")) return "bad_request";
  if (message.includes("failed to fetch") || message.includes("network")) return "network";
  return "server";
}

/**
 * Report a Supabase Edge Function failure the user could notice
 * (any `supabase.functions.invoke` error is routed here automatically).
 */
export function trackSupabaseError(functionName: string, error: unknown, context: EventProps = {}): void {
  track("supabase_function_error", {
    function: functionName,
    kind: classifyError(error),
    ...context,
  });
}
