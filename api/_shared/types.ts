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
 * IP del llamante.
 *
 * `x-real-ip` y `x-vercel-forwarded-for` los escribe la plataforma. El primer
 * salto de `x-forwarded-for` lo aporta quien llama, así que leerlo permitía
 * estrenar cubo de rate limit inventando la cabecera. Se toma el último salto
 * (el que añade el proxy más cercano) y sólo como respaldo.
 */
export function clientIp(req: ApiRequest): string {
  const real = header(req, "x-real-ip").trim();
  if (real) return real;

  for (const name of ["x-vercel-forwarded-for", "x-forwarded-for"]) {
    const chain = header(req, name)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (chain.length > 0) return chain[chain.length - 1];
  }

  return header(req, "cf-connecting-ip").trim() || "unknown";
}
