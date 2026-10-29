import {
  AUTH_SUPABASE_PUBLISHABLE_KEY,
  AUTH_SUPABASE_URL,
  authClient,
} from "@/integrations/supabase/client";
import { createAiTorMcpServer } from "@/lib/mcp";
import { DEFAULT_TIER } from "@/lib/mcp/gemini";
import type { McpDatabase, McpServer } from "@/lib/mcp";
import type { McpToolDefinition, McpToolResult, McpTier } from "@/lib/mcp";

/**
 * Cliente MCP del navegador.
 *
 * Habla con las herramientas públicas y con las filas propias del usuario, y
 * para eso usa la **sesión** del proyecto de identidad: la consulta la autoriza
 * el RLS, no una comprobación en JavaScript. Nunca lleva la clave del modelo —
 * la conversación con Gemini va por el endpoint del servidor, que es el único
 * sitio donde `GEMINI_API_KEY` existe.
 */

/** Endpoint del agente. Se puede apuntar al backend Node en desarrollo. */
const AGENT_ENDPOINT = (import.meta.env.VITE_MCP_ENDPOINT as string) || "/api/mcp";

async function sessionToken(): Promise<string | null> {
  const { data } = await authClient.auth.getSession();
  return data.session?.access_token ?? null;
}

async function restSelect(
  table: string,
  columns: string,
  limit: number,
  filters: Record<string, string>,
): Promise<Record<string, unknown>[]> {
  const token = await sessionToken();
  if (!token) throw new Error("Necesitas iniciar sesión para leer tus datos");

  const url = new URL(`${AUTH_SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set("select", columns);
  url.searchParams.set("limit", String(limit));
  for (const [column, value] of Object.entries(filters)) {
    url.searchParams.set(column, `eq.${value}`);
  }

  const response = await fetch(url, {
    headers: {
      apikey: AUTH_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Supabase respondió ${response.status} en ${table}`);
  const rows = (await response.json()) as Record<string, unknown>[];
  return Array.isArray(rows) ? rows : [];
}

/** Puerto de base de datos: la sesión del usuario, sin privilegios extra. */
export const sessionDatabase: McpDatabase = { select: restSelect };

/** Plan real del usuario. Sin fila legible (o sin tabla) se asume el gratuito. */
export async function getSessionTier(): Promise<McpTier> {
  const userId = (await authClient.auth.getUser()).data.user?.id;
  if (!userId) return DEFAULT_TIER;
  try {
    const rows = await restSelect("profiles", "tier", 1, { id: userId });
    const tier = rows[0]?.tier;
    return tier === "pro" || tier === "dao" ? tier : DEFAULT_TIER;
  } catch {
    return DEFAULT_TIER;
  }
}

/** Servidor MCP local listo para usar desde la interfaz. */
export function createSessionMcpServer(): McpServer {
  return createAiTorMcpServer({ db: sessionDatabase });
}

/** Herramientas que este usuario puede ver, ya filtradas por plan. */
export async function listSessionTools(): Promise<McpToolDefinition[]> {
  return createSessionMcpServer().listTools(await getSessionTier());
}

/** Ejecuta una herramienta con el plan real del usuario. */
export async function callSessionTool(
  name: string,
  args: Record<string, unknown> = {},
): Promise<McpToolResult> {
  const tier = await getSessionTier();
  return createSessionMcpServer().callTool(name, args, {
    tier,
    db: sessionDatabase,
    fetch,
  });
}

export interface AgentAnswer {
  answer: string;
  toolCalls: Array<{ name: string; args: Record<string, unknown>; isError: boolean }>;
}

/** Pregunta al modelo a través del servidor: la clave nunca llega al navegador. */
export async function askAgent(prompt: string): Promise<AgentAnswer> {
  const token = await sessionToken();
  if (!token) throw new Error("Necesitas iniciar sesión para usar el agente");

  const response = await fetch(AGENT_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ prompt }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`El agente respondió ${response.status}: ${detail.slice(0, 200)}`);
  }
  return (await response.json()) as AgentAnswer;
}
