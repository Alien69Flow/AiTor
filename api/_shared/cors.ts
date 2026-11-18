/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * Portado de WorldMonitor (C) 2026 Elie Habib — https://github.com/koala73/worldmonitor
 *
 * CORS con allowlist para las funciones `api/*.ts`.
 *
 * Hoy los handlers hacen `res.setHeader("access-control-allow-origin", "*")`
 * uno a uno. Eso está bien para un proxy público de lectura, pero deja de
 * estarlo en cuanto un endpoint acepta credenciales, escribe o cuesta dinero
 * (MCP, pagos, LLM). Este módulo centraliza la decisión, igual que
 * `api/_cors.js` en WorldMonitor.
 *
 * Añade a `.env.local` / Vercel si tienes más orígenes:
 *   ALLOWED_ORIGINS=https://aitor.alienflow.space,https://alienflow.space
 */

import type { ApiRequest, ApiResponse, HeaderValue } from "./types.js";

/** Orígenes de primera parte. Amplía aquí o por `ALLOWED_ORIGINS`. */
const APP_ORIGINS = [
  "https://aitor.alienflow.space",
  "https://alienflow.space",
  "https://www.alienflow.space",
];

const MAX_ORIGIN_BYTES = 300;

function extraOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

/** Solo los previews propios: nunca por patrón de nombre. */
function isOwnPreview(origin: string): boolean {
  if (process.env.VERCEL_ENV !== "preview") return false;
  return [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
    .filter(Boolean)
    .some((host) => origin === `https://${host}`);
}

function isLocalDev(origin: string): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

export function isAllowedOrigin(origin: string): boolean {
  if (!origin || origin.length > MAX_ORIGIN_BYTES) return false;
  if ([...APP_ORIGINS, ...extraOrigins()].includes(origin)) return true;
  if (isOwnPreview(origin)) return true;
  if (isLocalDev(origin)) return true;
  return false;
}

/** Cabeceras CORS para un origen ya validado. */
export function corsHeaders(origin: string, methods = "GET, OPTIONS"): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Api-Key, MCP-Protocol-Version, Mcp-Session-Id",
    "Access-Control-Expose-Headers": [
      "ETag",
      "Retry-After",
      "RateLimit",
      "RateLimit-Policy",
      "RateLimit-Limit",
      "RateLimit-Remaining",
      "RateLimit-Reset",
      "X-Aitor-Cache",
    ].join(", "),
    "Access-Control-Max-Age": "3600",
    Vary: "Origin",
  };
}

/**
 * Cabeceras para respuestas públicas cacheables (datos que no dependen del
 * usuario). Con `ACAO: *` la CDN guarda UNA entrada por URL; con el origen
 * ecoado + `Vary: Origin` guarda una por cada origen distinto.
 */
export function publicCorsHeaders(methods = "GET, OPTIONS"): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Api-Key",
    "Access-Control-Max-Age": "3600",
  };
}

/**
 * Aplica CORS. Devuelve true si la petición ya fue respondida (OPTIONS o
 * origen no permitido), de modo que el handler puede hacer `return` directo.
 */
export function applyCors(
  req: ApiRequest,
  res: ApiResponse,
  opts: { methods?: string; publicRead?: boolean } = {},
): boolean {
  const origin = String((req.headers?.origin as HeaderValue) || "");
  const methods = opts.methods ?? "GET, OPTIONS";

  if (req.method === "OPTIONS") {
    const headers = opts.publicRead || isAllowedOrigin(origin) ? (opts.publicRead ? publicCorsHeaders(methods) : corsHeaders(origin, methods)) : {};
    for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
    res.status(204).end();
    return true;
  }

  if (opts.publicRead) {
    for (const [name, value] of Object.entries(publicCorsHeaders(methods))) res.setHeader(name, value);
    return false;
  }

  if (!origin) return false; // curl / server-to-server: sin CORS que aplicar
  if (!isAllowedOrigin(origin)) {
    // Ecoamos el origen en la negativa para que el navegador pueda leer el 403
    // (con ACAO distinto, el fetch falla de forma opaca y no se depura).
    for (const [name, value] of Object.entries(corsHeaders(origin, methods))) res.setHeader(name, value);
    res.status(403).json({ error: "origin not allowed" });
    return true;
  }
  for (const [name, value] of Object.entries(corsHeaders(origin, methods))) res.setHeader(name, value);
  return false;
}
