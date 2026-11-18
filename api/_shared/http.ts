/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * Portado de WorldMonitor (C) 2026 Elie Habib — https://github.com/koala73/worldmonitor
 *
 * Utilidades HTTP para los handlers de `api/*.ts`.
 *
 * El objetivo es que migrar un handler cueste tres líneas, no una reescritura:
 *
 *   import { applyCors } from "./_shared/cors.js";
 *   import { sendJson, sendError } from "./_shared/http.js";
 *
 *   export default async function handler(req, res) {
 *     if (applyCors(req, res, { publicRead: true })) return;
 *     ...
 *     sendJson(req, res, 200, payload, { cache: "medium" });
 *   }
 *
 * Qué aporta frente a `res.json()` a pelo:
 *  - ETag (FNV-1a) + 304 con `If-None-Match`: menos bytes y menos repintados.
 *  - Tiers de `Cache-Control` / `CDN-Cache-Control` con `stale-while-revalidate`
 *    y `stale-if-error`, en vez de "no-store" o nada.
 *  - Errores con forma estable `{ error, code, requestId }` y sin stack al
 *    cliente.
 */

import type { ApiRequest, ApiResponse } from "./types.js";
import { header } from "./types.js";
import { applyCors } from "./cors.js";
import { checkRateLimit, type RateLimitPolicy } from "./rate-limit.js";

export type CacheTier = "fast" | "medium" | "slow" | "static" | "daily" | "no-store";

/**
 * `s-maxage` = CDN. `max-age=0, must-revalidate` deja que el navegador
 * revalide con ETag en lugar de servir datos viejos de la pestaña.
 */
export const CACHE_TIERS: Record<CacheTier, { cacheControl: string; cdn: string }> = {
  fast: { cacheControl: "public, max-age=0, must-revalidate", cdn: "public, s-maxage=300, stale-while-revalidate=120, stale-if-error=900" },
  medium: { cacheControl: "public, max-age=0, must-revalidate", cdn: "public, s-maxage=600, stale-while-revalidate=300, stale-if-error=1800" },
  slow: { cacheControl: "public, max-age=0, must-revalidate", cdn: "public, s-maxage=1800, stale-while-revalidate=600, stale-if-error=3600" },
  static: { cacheControl: "public, max-age=0, must-revalidate", cdn: "public, s-maxage=7200, stale-while-revalidate=1800, stale-if-error=7200" },
  daily: { cacheControl: "public, max-age=0, must-revalidate", cdn: "public, s-maxage=86400, stale-while-revalidate=3600, stale-if-error=86400" },
  "no-store": { cacheControl: "no-store", cdn: "no-store" },
};

/** FNV-1a de 32 bits en hex: barato y suficiente para ETag. */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function setCacheHeaders(res: ApiResponse, tier: CacheTier): void {
  const value = CACHE_TIERS[tier];
  res.setHeader("Cache-Control", value.cacheControl);
  res.setHeader("CDN-Cache-Control", value.cdn);
}

export interface SendOpts {
  cache?: CacheTier;
  /** Desactiva el 304 (p. ej. respuestas con datos por usuario). */
  etag?: boolean;
  /** Cabeceras extra (x-aitor-egress, etc.). */
  headers?: Record<string, string>;
}

/** Responde JSON con ETag, 304 y cabeceras de caché por tier. */
export function sendJson(
  req: ApiRequest,
  res: ApiResponse,
  status: number,
  body: unknown,
  opts: SendOpts = {},
): void {
  const tier = opts.cache ?? "no-store";
  const json = JSON.stringify(body);
  for (const [name, value] of Object.entries(opts.headers ?? {})) res.setHeader(name, value);
  setCacheHeaders(res, tier);
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const useEtag = opts.etag ?? (tier !== "no-store");
  if (useEtag && status === 200) {
    const etag = `"${fnv1a(json)}"`;
    res.setHeader("ETag", etag);
    if (header(req, "if-none-match") === etag) {
      res.status(304).end();
      return;
    }
  }

  res.status(status).json(body);
}

export interface ApiErrorBody {
  error: string;
  code?: string;
  requestId?: string;
  retryAfterSeconds?: number;
}

export function sendError(
  res: ApiResponse,
  status: number,
  body: ApiErrorBody,
  headers: Record<string, string> = {},
): void {
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

export interface WithApiOpts {
  cache?: CacheTier;
  methods?: string[];
  /** Datos idénticos para todos: ACAO * para que la CDN no fragmente. */
  publicRead?: boolean;
  rateLimit?: RateLimitPolicy;
  etag?: boolean;
}

/**
 * Envoltorio opcional para handlers nuevos. Los existentes pueden seguir
 * llamando a `applyCors` + `sendJson` sin cambiar de forma.
 */
export function withApi(
  opts: WithApiOpts,
  handler: (req: ApiRequest, res: ApiResponse) => Promise<void> | void,
): (req: ApiRequest, res: ApiResponse) => Promise<void> {
  const methods = opts.methods ?? ["GET", "HEAD"];
  return async (req, res) => {
    if (applyCors(req, res, { methods: [...methods, "OPTIONS"].join(", "), publicRead: opts.publicRead })) return;

    const method = (req.method || "GET").toUpperCase();
    if (!methods.includes(method)) {
      sendError(res, 405, { error: "method not allowed", code: "method_not_allowed" }, { Allow: [...methods, "OPTIONS"].join(", ") });
      return;
    }

    if (opts.rateLimit && !(await checkRateLimit(req, res, opts.rateLimit))) return;

    try {
      await handler(req, res);
    } catch (error) {
      const requestId = fnv1a(`${Date.now()}:${Math.random()}`);
      console.error(`[api] ${req.url ?? ""} requestId=${requestId}`, error);
      if (!res.statusCode || res.statusCode === 200) {
        sendError(res, 500, { error: "internal error", code: "internal_error", requestId });
      }
    }
  };
}
