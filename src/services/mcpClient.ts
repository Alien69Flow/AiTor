import {
  AUTH_SUPABASE_PUBLISHABLE_KEY,
  AUTH_SUPABASE_URL,
  authClient,
} from "@/integrations/supabase/client";
import { createAiTorMcpServer } from "@/lib/mcp";
import { DEFAULT_TIER } from "@/lib/mcp/gemini";
import type { McpDatabase, McpGitHub, McpServer } from "@/lib/mcp";
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

/**
 * Acciones de lectura: el repositorio es público, así que se leen sin sesión y
 * sin PAT desde `/api/github`.
 */
const GITHUB_READ_ACTIONS = [
  "repo_info",
  "tree",
  "contents",
  "get_file",
  "branches",
  "commits",
  "get_ref",
  "pull_requests",
  "check_runs",
] as const;

/**
 * Puerto de GitHub, con dos caminos a propósito:
 *
 *  - **lectura** → `/api/github`, la función de Vercel. El repositorio es
 *    público, así que no pide sesión ni token. Antes toda lectura pasaba por el
 *    proxy de Supabase y, sin sesión o sin el proxy desplegado, AI Tor no podía
 *    ni leer su propio árbol de ficheros.
 *  - **escritura** → `github-proxy`, que es el único sitio con token y
 *    allowlist, y exige rol `admin`. Ahí sí hace falta la sesión.
 */
async function githubCall(params: Record<string, unknown>): Promise<unknown> {
  const action = typeof params.action === "string" ? params.action : "";
  if ((GITHUB_READ_ACTIONS as readonly string[]).includes(action)) {
    return publicGithubCall(params);
  }

  const token = await sessionToken();
  if (!token) throw new Error("Necesitas iniciar sesión para proponer cambios en GitHub");

  const response = await fetch(`${AUTH_SUPABASE_URL}/functions/v1/github-proxy`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: AUTH_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(25_000),
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; message?: string }
    | null;

  if (response.status === 404) {
    throw new Error(
      "GitHub: el proxy no está desplegado en el proyecto de identidad (github-proxy).",
    );
  }
  if (!response.ok) {
    throw new Error(`GitHub: ${payload?.error ?? payload?.message ?? `HTTP ${response.status}`}`);
  }
  if (payload && typeof payload === "object" && "error" in payload && payload.error) {
    throw new Error(`GitHub: ${payload.error}`);
  }
  return payload;
}

/** Lectura pública: sin `Authorization`, sin `apikey`, sin nada del usuario. */
async function publicGithubCall(params: Record<string, unknown>): Promise<unknown> {
  const response = await fetch("/api/github", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(25_000),
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; message?: string }
    | null;

  if (response.status === 404) {
    throw new Error(
      "GitHub: `/api/github` no está disponible en este despliegue (en local, usa el build de Vercel o el chat con sesión).",
    );
  }
  if (!response.ok) {
    throw new Error(`GitHub: ${payload?.error ?? payload?.message ?? `HTTP ${response.status}`}`);
  }
  return payload;
}

export const githubPort: McpGitHub = { call: githubCall };

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
  return createAiTorMcpServer({ db: sessionDatabase, github: githubPort });
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
    github: githubPort,
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
