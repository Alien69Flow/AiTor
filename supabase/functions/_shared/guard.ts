// Shared request guards for public proxy edge functions.
// These endpoints must stay reachable by guests (the globe/intel feeds are
// public), so abuse is contained with an origin allowlist + per-IP rate limit
// instead of a JWT requirement.

const ALLOWED_ORIGIN_SUFFIXES = [
  "aitor.lovable.app",
  "aitor.alienflow.space",
  "alienflow.space",
  ".lovable.app",
  ".lovableproject.com",
  "localhost",
  "127.0.0.1",
];

export function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  if (!origin) return false;
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return false;
  }
  return ALLOWED_ORIGIN_SUFFIXES.some(
    (s) => host === s || host.endsWith(s),
  );
}

type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(req: Request, limit = 30, windowMs = 60_000): boolean {
  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown";
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.reset <= now) {
    buckets.set(ip, { count: 1, reset: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

/**
 * Guard for public (guest-accessible) proxies that spend paid API quota.
 * Returns a Response when the request must be rejected, otherwise null.
 */
export function guardPublic(
  req: Request,
  corsHeaders: Record<string, string>,
  limit = 30,
): Response | null {
  if (!isAllowedOrigin(req)) {
    return new Response(JSON.stringify({ error: "Forbidden origin" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!rateLimit(req, limit)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

/** Timing-independent-ish shared secret comparison helper. */
export function secretMatches(provided: string | null, expected: string | undefined): boolean {
  if (!expected || !provided) return false;
  return provided === expected;
}