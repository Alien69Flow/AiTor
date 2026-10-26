import { supabase } from "@/integrations/supabase/client";
import { extractCoinIds, extractRepo, type SkillId, skillLabel } from "@/lib/ai-skills";

/**
 * Runs the skills the router selected and turns each answer into a compact block
 * of context the model can reason over.
 *
 * Two rules learned from this codebase's own failures:
 *
 *   1. A skill that fails is reported as failed. Silence here would look exactly
 *      like "the model had nothing to say", which is the trap that kept the
 *      sign-in buttons broken for a day.
 *   2. Everything is bounded. A slow third-party API must not hold the chat
 *      hostage, so each call has its own deadline and the whole turn has a cap.
 */

export interface SkillRunResult {
  id: SkillId;
  label: string;
  ok: boolean;
  context?: string;
  error?: string;
}

const SKILL_TIMEOUT_MS = 9_000;

/**
 * Calls an Edge Function and never lets it hang the turn: the deadline rejects
 * and the skill is reported as failed. The provider's own message is preferred
 * over supabase-js's generic "non-2xx" so the chip can say *why* it failed.
 */
async function invoke<T>(name: string, body: unknown): Promise<T> {
  const pending = supabase.functions.invoke(name, { body });
  const deadline = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("tiempo de espera agotado")), SKILL_TIMEOUT_MS),
  );

  const settled = (await Promise.race([pending, deadline])) as {
    data: unknown;
    error: { message?: string; context?: Response } | null;
  };

  if (settled.error) throw new Error(await providerMessage(settled.error));
  return settled.data as T;
}

async function providerMessage(error: { message?: string; context?: Response }): Promise<string> {
  const response = error.context;
  if (response && typeof response.json === "function") {
    try {
      const body = (await response.json()) as { error?: unknown; message?: unknown };
      const detail = body?.error ?? body?.message;
      if (typeof detail === "string" && detail.trim()) return detail.trim();
    } catch {
      // Not JSON: fall through to the generic message.
    }
  }
  return error.message ?? "error desconocido";
}

/** Turns provider jargon into something a person can act on. */
function describeError(message: string): string {
  if (/unauthor|401/i.test(message)) return "requiere sesión iniciada";
  if (/forbidden origin/i.test(message)) return "origen no permitido por la función";
  if (/not configured|missing|no api key/i.test(message)) return "falta una clave en el backend";
  return message.slice(0, 140);
}

const stamp = () => new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";

// --- Web search -------------------------------------------------------------

interface SearchHit {
  title?: string;
  url?: string;
  description?: string;
}

async function runWeb(query: string): Promise<string | null> {
  const data = await invoke<{ data?: SearchHit[] }>("firecrawl-search", {
    query: query.slice(0, 300),
    options: { limit: 4 },
  });
  const hits = (data?.data ?? []).filter((hit) => hit?.url || hit?.title);
  if (hits.length === 0) return null;

  return hits
    .map((hit, index) => {
      const title = hit.title?.trim() || "Sin título";
      const summary = hit.description?.replace(/\s+/g, " ").trim().slice(0, 240);
      return `[${index + 1}] ${title}\nURL: ${hit.url ?? "—"}${summary ? `\n${summary}` : ""}`;
    })
    .join("\n\n");
}

// --- Crypto market ----------------------------------------------------------

interface CoinQuote {
  usd?: number;
  usd_24h_change?: number;
}

async function runMarket(text: string): Promise<string | null> {
  const coinIds = extractCoinIds(text);
  if (coinIds.length === 0) return null;

  const data = await invoke<{ prices?: Record<string, CoinQuote> }>("crypto-price", {
    coinIds,
  });
  const prices = data?.prices;
  if (!prices) return null;

  const lines = Object.entries(prices)
    .filter(([, quote]) => typeof quote?.usd === "number")
    .map(([coin, quote]) => {
      const change = quote.usd_24h_change;
      const delta =
        typeof change === "number" ? ` (${change > 0 ? "+" : ""}${change.toFixed(2)} % en 24 h)` : "";
      return `- ${coin}: $${quote.usd!.toLocaleString("en-US")}${delta}`;
    });

  return lines.length ? lines.join("\n") : null;
}

// --- GitHub repository ------------------------------------------------------

interface RepoInfo {
  description?: string;
  language?: string;
  stargazers_count?: number;
  forks_count?: number;
  private?: boolean;
}

interface RepoTree {
  tree?: Array<{ path?: string; type?: string }>;
}

interface RepoCommit {
  commit?: { message?: string };
}

async function runRepo(text: string): Promise<string | null> {
  const parsed = extractRepo(text);
  if (!parsed) return null;
  const { owner, repo } = parsed;

  // A repository the token cannot read fails the tree call but not the metadata,
  // so each call is settled independently instead of failing the whole skill.
  const settle = async <T,>(promise: Promise<T>): Promise<T | null> => {
    try {
      return await promise;
    } catch {
      return null;
    }
  };

  // The metadata call runs unguarded so an authentication or configuration
  // problem is reported as such; the tree and the commit list may legitimately
  // be empty (private repo, other default branch) and are tolerated.
  const info = await invoke<RepoInfo>("github-proxy", { action: "repo_info", owner, repo });
  const [tree, commits] = await Promise.all([
    settle(invoke<RepoTree>("github-proxy", { action: "tree", owner, repo, branch: "main" })),
    settle(invoke<RepoCommit[]>("github-proxy", { action: "commits", owner, repo })),
  ]);

  if (!info && !tree && !commits) return null;

  const parts: string[] = [`### ${owner}/${repo}`];
  if (info) {
    parts.push(
      [
        info.description ? `Descripción: ${info.description}` : null,
        info.language ? `Lenguaje: ${info.language}` : null,
        typeof info.stargazers_count === "number" ? `Estrellas: ${info.stargazers_count}` : null,
        typeof info.forks_count === "number" ? `Forks: ${info.forks_count}` : null,
        typeof info.private === "boolean" ? `Visibilidad: ${info.private ? "privado" : "público"}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    );
  }

  const files = (tree?.tree ?? [])
    .filter((entry) => entry.type === "blob" && entry.path)
    .slice(0, 40)
    .map((entry) => entry.path);
  if (files.length) parts.push(`Archivos (primeros ${files.length}):\n${files.join("\n")}`);

  const recent = (commits ?? [])
    .slice(0, 6)
    .map((entry) => entry.commit?.message?.split("\n")[0])
    .filter(Boolean);
  if (recent.length) parts.push(`Últimos commits:\n${recent.map((line) => `- ${line}`).join("\n")}`);

  return parts.length > 1 ? parts.join("\n\n") : null;
}

// --- OSINT ------------------------------------------------------------------

interface IntelEvent {
  title?: string;
  url?: string;
  source?: string;
  category?: string;
  severity?: string;
  summary?: string;
}

async function runOsint(): Promise<string | null> {
  const data = await invoke<{ events?: IntelEvent[] }>("osint-aggregator", { limit: 4 });
  const events = (data?.events ?? []).filter((event) => event?.title);
  if (events.length === 0) return null;

  return events
    .slice(0, 8)
    .map(
      (event, index) =>
        `[${index + 1}] (${event.severity ?? "—"} · ${event.category ?? "—"}) ${event.title}\n` +
        `${event.source ?? "fuente desconocida"} — ${event.url ?? ""}`,
    )
    .join("\n\n");
}

// --- Space weather ----------------------------------------------------------

interface SpaceWeather {
  kpIndex?: number;
  solarStorm?: boolean;
  stormLevel?: string;
  radioBlackout?: string;
  geomagneticStorm?: string;
}

async function runSpaceWeather(): Promise<string | null> {
  const data = await invoke<SpaceWeather>("noaa-space-weather", {});
  if (!data || typeof data.kpIndex !== "number") return null;

  const scale = (value?: string) => (!value || value === "none" ? "sin escala activa" : value);
  return [
    `Índice Kp actual: ${data.kpIndex}`,
    `Tormenta solar en curso: ${data.solarStorm ? "sí" : "no"}`,
    `Fulguraciones (R): ${scale(data.radioBlackout)}`,
    `Tormenta geomagnética (G): ${scale(data.geomagneticStorm)}`,
  ].join("\n");
}

// --- Orchestration ----------------------------------------------------------

async function execute(id: SkillId, text: string): Promise<string | null> {
  switch (id) {
    case "web":
      return runWeb(text);
    case "market":
      return runMarket(text);
    case "repo":
      return runRepo(text);
    case "osint":
      return runOsint();
    case "spaceWeather":
      return runSpaceWeather();
  }
}

/**
 * Runs every selected skill in parallel. Never throws: a dead source becomes a
 * failed result, which the caller shows on the message instead of dropping.
 */
export async function runSkills(ids: SkillId[], text: string): Promise<SkillRunResult[]> {
  return Promise.all(
    ids.map(async (id) => {
      try {
        const context = await execute(id, text);
        return context
          ? { id, label: skillLabel(id), ok: true, context }
          : {
              id,
              label: skillLabel(id),
              ok: false,
              error: "la fuente no devolvió datos utilizables",
            };
      } catch (error) {
        return {
          id,
          label: skillLabel(id),
          ok: false,
          error: describeError(error instanceof Error ? error.message : "error desconocido"),
        };
      }
    }),
  );
}

/**
 * Turns the successful results into the block that rides along with the request.
 * Failed skills are listed by name so the model can say what it could not check
 * instead of inventing an answer.
 */
export function buildSkillContext(results: SkillRunResult[]): string[] {
  const blocks = results
    .filter((result) => result.ok && result.context)
    .map((result) => `### ${result.label} · ${stamp()}\n${result.context}`);

  const failed = results.filter((result) => !result.ok);
  if (failed.length) {
    blocks.push(
      `### Sin datos\nNo se pudo consultar: ${failed
        .map((result) => result.label)
        .join(", ")}. Dilo explícitamente en vez de suponer.`,
    );
  }

  return blocks;
}
