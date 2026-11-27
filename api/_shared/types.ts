/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * Portado de WorldMonitor (C) 2026 Elie Habib — https://github.com/koala73/worldmonitor
 *
 * Tipos estructurales mínimos de request/response.
 *
 * No importamos `@vercel/node`: los handlers pasan `VercelRequest` y
 * `VercelResponse` sin fricción porque son estructuralmente compatibles, y así
 * este módulo se puede probar (y typechequear) sin instalar la dependencia.
 */
export type HeaderValue = string | string[] | undefined;

export interface ApiRequest {
  method?: string;
  headers: Record<string, HeaderValue>;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
  body?: unknown;
}
export interface ApiResponse {
  statusCode: number;
  status(code: number): ApiResponse;
  json(body: unknown): unknown;
  setHeader(name: string, value: string | number | string[]): unknown;
  end(chunk?: string): unknown;
}

/** Primer valor de una cabecera, o "" si no viene. */
export function header(req: ApiRequest, name: string): string {
  const raw = req.headers?.[name.toLowerCase()] ?? req.headers?.[name];
  if (Array.isArray(raw)) return raw[0] ?? "";
  return raw ?? "";
}

/**
 * IP del llamante, y sólo de cabeceras que escribe la plataforma.
 *
 * Vercel sobrescribe estas tres con la IP pública del visitante —una sola, sin
 * cadena— y no reenvía la que mande el cliente (salvo Enterprise con proxy de
 * confianza). `x-vercel-forwarded-for` es la que sobrevive si algún día hay un
 * proxy encima; `x-real-ip` lleva el mismo valor.
 *
 * `x-forwarded-for` queda para cuando no hay Vercel delante (dev en local),
 * donde sí puede ser una cadena: ahí manda el último salto, el que añade el
 * proxy, no el que pudo poner el cliente.
 *
 * `cf-connecting-ip` no se lee: no hay Cloudflare delante, así que sólo puede
 * venir del visitante, y aceptarla permitía estrenar un cubo de rate limit con
 * cada petición.
 */
export function clientIp(req: ApiRequest): string {
  const platform = header(req, "x-vercel-forwarded-for") || header(req, "x-real-ip");
  if (platform) return platform;

  const hops = header(req, "x-forwarded-for")
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean);

  return hops.pop() || "unknown";
}
