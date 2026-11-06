import express, { type Request, type Response, type Router } from "express";
import { createAiTorMcpServer } from "../src/lib/mcp/index";
import { createGeminiClient, createRateLimiter, runToolLoop } from "../src/lib/mcp/gemini";
import type { McpDatabase, McpTier } from "../src/lib/mcp";

/**
 * MCP sobre Express, con la identidad verificada en el servidor.
 *
 * Es el punto de montaje del handler: aquí sí resuelven los imports del
 * proyecto (`../src/lib/mcp`), al contrario que en el runtime de Vercel, que ya
 * falló con un import hermano y está documentado en `api/predictions.ts`.
 *
 * Reglas que aplica:
 *   - El plan **nunca** llega del cuerpo: se lee de `profiles.tier` con el JWT
 *     del llamante, así que el RLS decide y no el cliente.
 *   - `db.select` consulta con **ese** JWT, no con la service role: el modelo no
 *     puede ver filas de otra cuenta ni aunque acierte el filtro.
 *   - `GEMINI_API_KEY` no sale de este proceso; el navegador sólo recibe texto.
 *   - Cada usuario tiene su propio cubo de cuota del free tier.
 */

export interface McpRouterConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  geminiKey?: string;
  /** Inyectable para pruebas: evita salir a la red. */
  fetchImpl?: typeof fetch;
}

interface Caller {
  userId: string;
  token: string;
  tier: McpTier;
  db: McpDatabase;
}

const TIERS = new Set<string>(["free", "pro", "dao"]);

export function createMcpRouter(config: McpRouterConfig): Router {
  const doFetch = config.fetchImpl ?? fetch;
  const router = express.Router();
  const limiters = new Map<string, ReturnType<typeof createRateLimiter>>();

  const authorized = async (token: string): Promise<string | null> => {
    if (!config.supabaseUrl || !config.supabaseAnonKey) return null;
    try {
      const response = await doFetch(`${config.supabaseUrl}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}`, apikey: config.supabaseAnonKey },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) return null;
      const user = (await response.json()) as { id?: string };
      return typeof user.id === "string" ? user.id : null;
    } catch {
      return null;
    }
  };

  const dbFor = (token: string): McpDatabase => ({
    async select(table, columns, limit, filters) {
      const url = new URL(`${config.supabaseUrl}/rest/v1/${table}`);
      url.searchParams.set("select", columns);
      url.searchParams.set("limit", String(limit));
      for (const [column, value] of Object.entries(filters)) {
        url.searchParams.set(column, `eq.${value}`);
      }
      const response = await doFetch(url, {
        headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`Supabase respondió ${response.status} en ${table}`);
      const rows = (await response.json()) as Record<string, unknown>[];
      return Array.isArray(rows) ? rows : [];
    },
  });

  const tierOf = async (userId: string, token: string): Promise<McpTier> => {
    try {
      const rows = await dbFor(token).select("profiles", "tier", 1, { id: userId });
      const tier = rows[0]?.tier;
      return typeof tier === "string" && TIERS.has(tier) ? (tier as McpTier) : "free";
    } catch {
      // Sin tabla de perfiles (migración no aplicada) el plan es el gratuito:
      // nunca se asciende por un fallo de lectura.
      return "free";
    }
  };

  const resolveCaller = async (req: Request): Promise<Caller | null> => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return null;
    const token = header.slice("Bearer ".length).trim();
    if (!token) return null;
    const userId = await authorized(token);
    if (!userId) return null;
    return { userId, token, tier: await tierOf(userId, token), db: dbFor(token) };
  };

  const limiterFor = (userId: string) => {
    let limiter = limiters.get(userId);
    if (!limiter) {
      limiter = createRateLimiter();
      limiters.set(userId, limiter);
      // Un mapa que crece sin fin acabaría pesando más que la propia cuota.
      if (limiters.size > 5_000) limiters.clear();
    }
    return limiter;
  };

  router.post("/mcp", async (req: Request, res: Response) => {
    const caller = await resolveCaller(req);
    if (!caller) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const body = req.body as { jsonrpc?: string; method?: string; prompt?: string } | undefined;

    if (body && typeof body.prompt === "string" && body.prompt.trim()) {
      if (!config.geminiKey) {
        return res.status(501).json({ error: "GEMINI_API_KEY no está configurada en el servidor" });
      }
      const server = createAiTorMcpServer({ db: caller.db });
      try {
        const result = await runToolLoop({
          client: createGeminiClient({ apiKey: config.geminiKey }),
          server,
          context: { tier: caller.tier, db: caller.db, fetch: doFetch },
          prompt: body.prompt.trim().slice(0, 4000),
          limiter: limiterFor(caller.userId),
          systemInstruction:
            "Eres el operador de AI-TOR. Usa las herramientas cuando necesites telemetría " +
            "orbital o eventos OSINT, y cita siempre la fuente y la hora del dato. Si una " +
            "herramienta falla, explícalo en vez de estimar cifras.",
        });
        return res.json({ answer: result.text, toolCalls: result.toolCalls, model: result.model });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error del agente";
        const limited = /Límite de peticiones/i.test(message);
        return res.status(limited ? 429 : 502).json({ error: message });
      }
    }

    if (!body || body.jsonrpc || body.method) {
      const server = createAiTorMcpServer({ db: caller.db });
      const response = await server.handle(
        (body ?? {}) as never,
        { tier: caller.tier, db: caller.db, fetch: doFetch },
      );
      return res.json(response);
    }

    return res.status(400).json({ error: "Se esperaba una petición JSON-RPC o { prompt }" });
  });

  /** Herramientas visibles para quien llama, con su plan real. */
  router.get("/mcp/tools", async (req: Request, res: Response) => {
    const caller = await resolveCaller(req);
    if (!caller) return res.status(401).json({ error: "No autorizado" });
    const server = createAiTorMcpServer({ db: caller.db });
    return res.json({ tier: caller.tier, tools: server.listTools(caller.tier) });
  });

  return router;
}
