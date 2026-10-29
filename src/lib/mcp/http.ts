import type { McpDatabase, McpServer } from "./registry";
import type { JsonRpcRequest, McpTier } from "./types";

/**
 * Handler HTTP del servidor MCP, en `Request`/`Response` estándar.
 *
 * No conoce Express, ni Vercel, ni Deno: se monta donde haga falta. Eso importa
 * aquí porque el runtime de Vercel ya falló resolviendo imports hermanos (ver
 * la cabecera de `api/predictions.ts`), así que la lógica vive en `src/` y el
 * punto de montaje puede ser una copia autocontenida o el backend Node.
 *
 * Dos cuerpos aceptados en `POST`:
 *
 *   { "jsonrpc": "2.0", "method": "tools/list" }   → protocolo MCP
 *   { "prompt": "¿dónde está la ISS ahora?" }      → agente con herramientas
 *
 * Quién llama lo decide `resolveCaller`: firma del JWT y lectura de
 * `profiles.tier`. El handler no acepta un plan enviado por el cliente — si lo
 * hiciera, cualquiera se daría `dao` en una línea de `curl`.
 */

export interface McpCaller {
  tier: McpTier;
  db?: McpDatabase;
  /** Identidad verificada, cuando el montaje la conoce: la cuota es por usuario. */
  userId?: string;
}

export interface McpAgentResult {
  answer: string;
  toolCalls: Array<{ name: string; args: Record<string, unknown>; isError: boolean }>;
}

export interface McpHttpOptions {
  server: McpServer;
  /** Devuelve el llamante verificado, o null si no hay sesión válida. */
  resolveCaller: (request: Request) => Promise<McpCaller | null>;
  /** Ejecuta el bucle con el modelo. Sin esto, sólo se sirve el protocolo. */
  agent?: (prompt: string, caller: McpCaller) => Promise<McpAgentResult>;
  /** Inyectable para pruebas. */
  fetchImpl?: typeof fetch;
}

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
} as const;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}

function isJsonRpc(value: unknown): value is JsonRpcRequest {
  return typeof value === "object" && value !== null && "method" in value;
}

export function createMcpHttpHandler(options: McpHttpOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;

  return async function handle(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== "POST") {
      return json({ error: "Método no permitido: usa POST" }, 405);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "El cuerpo debe ser JSON" }, 400);
    }

    const caller = await options.resolveCaller(request).catch(() => null);
    if (!caller) return json({ error: "No autorizado" }, 401);

    const context = { tier: caller.tier, db: caller.db, fetch: fetchImpl };

    if (isJsonRpc(body)) {
      const response = await options.server.handle(body, context);
      return json(response);
    }

    const prompt = (body as { prompt?: unknown } | null)?.prompt;
    if (typeof prompt === "string" && prompt.trim()) {
      if (!options.agent) {
        return json({ error: "El agente no está configurado en este despliegue" }, 501);
      }
      try {
        const result = await options.agent(prompt.trim().slice(0, 4000), caller);
        return json(result);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Error del agente" }, 502);
      }
    }

    return json({ error: "Se esperaba una petición JSON-RPC o { prompt }" }, 400);
  };
}
