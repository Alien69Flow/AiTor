/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * Portado de WorldMonitor (C) 2026 Elie Habib — https://github.com/koala73/worldmonitor
 *
 * Rate limit para las funciones `api/*.ts`.
 *
 * Dos decisiones que importan:
 *
 *  1. **Cabeceras IETF** (`RateLimit-Policy`, `RateLimit-Limit`,
 *     `RateLimit-Remaining`, `RateLimit-Reset`, `Retry-After`) además de las
 *     legacy `X-RateLimit-*`. Un agente o un cliente puede autolimitarse sin
 *     leer documentación.
 *  2. **Fail-open por defecto, fail-closed donde toca.** Si Redis cae, el
 *     tráfico normal no se queda a oscuras (contador en memoria de respaldo),
 *     pero los endpoints donde el límite ES la defensa (LLM, pagos, MCP)
 *     declaran `failClosed: true` y reciben un 503 explícito.
 *
 * Usa Lua para que INCR + PEXPIRE sean atómicos en una sola ida y vuelta.
 */

import type { ApiRequest, ApiResponse } from "./types.js";
import { clientIp, header } from "./types.js";
import { isRedisConfigured, redisCommand } from "./redis.js";

const LUA_SLIDING = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then ttl = tonumber(ARGV[1]) end
return {count, ttl}
`;

export interface RateLimitPolicy {
  /** Nombre del cubo; se usa en la clave y en el fingerprint de logs. */
  name: string;
  limit: number;
  windowSec: number;
  /** true → 503 cuando Redis no puede decidir. Úsalo en LLM/pagos/MCP. */
  failClosed?: boolean;
  /** Identificador estable alternativo a la IP (p. ej. userId verificado). */
  identifier?: string;
}

const MEMORY_LIMIT = 5_000;
const memory = new Map<string, { count: number; resetAt: number }>();

function memoryDecision(key: string, policy: RateLimitPolicy): { allowed: boolean; remaining: number; resetSec: number } {
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    if (memory.size >= MEMORY_LIMIT) memory.clear();
    memory.set(key, { count: 1, resetAt: now + policy.windowSec * 1_000 });
    return { allowed: true, remaining: policy.limit - 1, resetSec: policy.windowSec };
  }
  entry.count += 1;
  const resetSec = Math.max(0, Math.ceil((entry.resetAt - now) / 1_000));
  return { allowed: entry.count <= policy.limit, remaining: Math.max(0, policy.limit - entry.count), resetSec };
}

function rateHeaders(policy: RateLimitPolicy, remaining: number, resetSec: number): Record<string, string> {
  return {
    "RateLimit-Policy": `"${policy.name}";q=${policy.limit};w=${policy.windowSec}`,
    "RateLimit-Limit": String(policy.limit),
    "RateLimit-Remaining": String(Math.max(0, remaining)),
    "RateLimit-Reset": String(resetSec),
    RateLimit: `"${policy.name}";r=${Math.max(0, remaining)};t=${resetSec}`,
    "X-RateLimit-Limit": String(policy.limit),
    "X-RateLimit-Remaining": String(Math.max(0, remaining)),
    "X-RateLimit-Reset": String(resetSec),
  };
}

async function redisDecision(
  key: string,
  policy: RateLimitPolicy,
): Promise<{ allowed: boolean; remaining: number; resetSec: number } | null> {
  try {
    const reply = await redisCommand<[number, number]>([
      "EVAL",
      LUA_SLIDING,
      "1",
      key,
      String(policy.windowSec * 1_000),
    ]);
    const count = Number(reply?.[0] ?? 0);
    const ttlMs = Number(reply?.[1] ?? policy.windowSec * 1_000);
    return {
      allowed: count <= policy.limit,
      remaining: Math.max(0, policy.limit - count),
      resetSec: Math.max(0, Math.ceil(ttlMs / 1_000)),
    };
  } catch (error) {
    console.error(`[rate-limit] redis-error policy=${policy.name}`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Aplica el límite. Devuelve `true` si la petición puede seguir y `false` si
 * ya respondió 429 o 503 (el handler debe salir).
 */
export async function checkRateLimit(
  req: ApiRequest,
  res: ApiResponse,
  policy: RateLimitPolicy,
): Promise<boolean> {
  const identity = policy.identifier || `${clientIp(req)}|${header(req, "user-agent").slice(0, 80)}`;
  const key = `rl:${policy.name}:${identity}`;

  let decision = isRedisConfigured() ? await redisDecision(key, policy) : null;

  if (!decision) {
    if (policy.failClosed) {
      res.setHeader("X-RateLimit-Mode", "degraded");
      res.setHeader("Retry-After", "5");
      res.status(503).json({ error: "rate-limit service temporarily unavailable" });
      return false;
    }
    decision = memoryDecision(key, policy);
    res.setHeader("X-RateLimit-Mode", "memory");
  }

  for (const [name, value] of Object.entries(rateHeaders(policy, decision.remaining, decision.resetSec))) {
    res.setHeader(name, value);
  }

  if (!decision.allowed) {
    res.setHeader("Retry-After", String(Math.max(1, decision.resetSec)));
    res.status(429).json({ error: "too many requests", policy: policy.name, retryAfterSeconds: decision.resetSec });
    return false;
  }
  return true;
}

/** Solo para tests. */
export function __resetRateLimitMemoryForTest(): void {
  memory.clear();
}
