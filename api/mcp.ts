/**
 * `POST /api/mcp` — servidor MCP de AI-TOR en Vercel.
 *
 * Acepta los dos cuerpos que ya describe `src/lib/mcp/http.ts`:
 *
 *   { "jsonrpc": "2.0", "method": "tools/list" }  → protocolo MCP
 *   { "prompt": "¿dónde está la ISS ahora?" }     → agente con herramientas
 *
 * Reglas que no se negocian:
 *
 *  - La identidad sale del `Bearer`, verificado contra el proyecto de
 *    **identidad** (el que firma la sesión del navegador). El plan se lee de
 *    `profiles.tier` con ese mismo token: nunca se acepta un `tier` del cuerpo.
 *  - `db.select` va con el token del llamante, no con la service role, así que
 *    el RLS decide qué filas ve el modelo.
 *  - `GEMINI_API_KEY` vive solo aquí; el navegador recibe texto, nunca la clave.
 *
 * Hasta ahora el cliente del chat apuntaba a `/api/mcp` y esa ruta no existía:
 * el botón de herramientas MCP funcionaba en local contra el backend Node, pero
 * en producción respondía 404. Este archivo es el punto de montaje que faltaba.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createAiTorMcpServer } from "../src/lib/mcp/index";
import { createMcpHttpHandler, type McpCaller } from "../src/lib/mcp/http";
import { createGeminiClient, createRateLimiter, runToolLoop } from "../src/lib/mcp/gemini";
import type { McpDatabase } from "../src/lib/mcp/registry";
import type { McpTier } from "../src/lib/mcp/types";

/** El bucle de herramientas puede encadenar varias rondas; 10 s no bastan. */
export const maxDuration = 60;

// Proyecto de identidad: es el que firma la sesión y el que tiene `profiles`.
const AUTH_URL =
  process.env.AUTH_SUPABASE_URL ||
  process.env.VITE_AUTH_SUPABASE_URL ||
  "https://pnyigikagdxqaogbiift.supabase.co";

const AUTH_KEY =
  process.env.AUTH_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_AUTH_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_c4VVYw8uPzt7-24KvOre6A_91csa5Xp";

const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

const TIERS = new Set<string>(["free", "pro", "dao"]);

/** Un cubo de cuota por usuario; el mapa se vacía si crece demasiado. */
const limiters = new Map<string, ReturnType<typeof createRateLimiter>>();

function limiterFor(userId: string) {
  let limiter = limiters.get(userId);
  if (!limiter) {
    limiter = createRateLimiter();
    limiters.set(userId, limiter);
    if (limiters.size > 5_000) limiters.clear();
  }
  return limiter;
}

async function verifiedUserId(token: string): Promise<string | null> {
  try {
    const response = await fetch(`${AUTH_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: AUTH_KEY },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const user = (await response.json()) as { id?: unknown };
    return typeof user.id === "string" ? user.id : null;
  } catch {
    return null;
  }
}

/** Filas del propio usuario: el token del llamante es la única credencial. */
function databaseFor(token: string): McpDatabase {
  return {
    async select(table, columns, limit, filters) {
      const url = new URL(`${AUTH_URL}/rest/v1/${table}`);
      url.searchParams.set("select", columns);
      url.searchParams.set("limit", String(limit));
      for (const [column, value] of Object.entries(filters)) {
        url.searchParams.set(column, `eq.${value}`);
      }
      const response = await fetch(url, {
        headers: { apikey: AUTH_KEY, Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`Supabase respondió ${response.status} en ${table}`);
      const rows = (await response.json()) as Record<string, unknown>[];
      return Array.isArray(rows) ? rows : [];
    },
  };
}

async function tierOf(userId: string, db: McpDatabase): Promise<McpTier> {
  try {
    const rows = await db.select("profiles", "tier", 1, { id: userId });
    const tier = rows[0]?.tier;
    return typeof tier === "string" && TIERS.has(tier) ? (tier as McpTier) : "free";
  } catch {
    // Sin tabla o sin permiso de lectura el plan es el gratuito: un fallo de
    // lectura nunca asciende a nadie.
    return "free";
  }
}

const handle = createMcpHttpHandler({
  server: createAiTorMcpServer(),
  resolveCaller: async (request) => {
    const header = request.headers.get("authorization");
    if (!header?.startsWith("Bearer ")) return null;
    const token = header.slice("Bearer ".length).trim();
    if (!token) return null;

    const userId = await verifiedUserId(token);
    if (!userId) return null;

    const db = databaseFor(token);
    return { userId, tier: await tierOf(userId, db), db } satisfies McpCaller;
  },
  agent: async (prompt, caller: McpCaller) => {
    if (!GEMINI_KEY) {
      throw new Error("GEMINI_API_KEY no está configurada en el despliegue");
    }
    const server = createAiTorMcpServer({ db: caller.db });
    const result = await runToolLoop({
      client: createGeminiClient({ apiKey: GEMINI_KEY }),
      server,
      context: { tier: caller.tier, db: caller.db, fetch },
      prompt,
      // La cuota es por identidad verificada, no por plan ni por pregunta.
      limiter: limiterFor(caller.userId ?? "sin-identidad"),
      systemInstruction:
        "Eres el operador de AI-TOR. Usa las herramientas cuando necesites telemetría " +
        "orbital o eventos OSINT, y cita siempre la fuente y la hora del dato. Si una " +
        "herramienta falla, explícalo en vez de estimar cifras.",
    });
    return { answer: result.text, toolCalls: result.toolCalls };
  },
});

function toHeaders(headers: VercelRequest["headers"]): Headers {
  const out = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") out.set(key, value);
    else if (Array.isArray(value)) out.set(key, value.join(", "));
  }
  return out;
}

export default async function mcp(req: VercelRequest, res: VercelResponse) {
  const host = req.headers.host ?? "localhost";
  const url = `https://${host}${req.url ?? "/api/mcp"}`;

  const request = new Request(url, {
    method: req.method ?? "POST",
    headers: toHeaders(req.headers),
    body:
      req.method === "GET" || req.method === "HEAD"
        ? undefined
        : JSON.stringify(req.body ?? {}),
  });

  const response = await handle(request);

  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.send(await response.text());
}
