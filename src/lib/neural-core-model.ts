import { AI_MODELS } from "./ai-models";
import { MOLTBOOK_AGENT } from "./moltbook-config";
import { GLOBE_LAYERS } from "./globe-layers";
import {
  CHOKEPOINTS,
  CONFLICT_ZONES,
  ECONOMIC_CENTERS,
  MILITARY_BASES,
  NUCLEAR_SITES,
  PIPELINES,
  UNDERSEA_CABLES,
} from "./geo-datasets";

/**
 * Single source of truth for the neural core view and the Agents sidebar.
 *
 * Every number exposed here is derived from data the repo already ships, or from
 * a live remote count. Nothing is invented: claims are labelled with the source
 * they come from so the view never presents decoration as telemetry.
 */

export type SkillCategory = "reasoning" | "web" | "creative" | "code" | "blockchain" | "quantum";

export interface SkillNode {
  id: string;
  label: string;
  category: SkillCategory;
  /** Configured proficiency, hand-set in the agent config — not a measured metric. */
  level: number;
  status: string;
}

const SKILL_LEVELS: Record<SkillCategory, number> = {
  reasoning: 92,
  web: 85,
  creative: 78,
  code: 95,
  blockchain: 88,
  quantum: 72,
};

export const SKILL_NODES: SkillNode[] = MOLTBOOK_AGENT.skills.map((skill) => ({
  id: skill.id,
  label: skill.label,
  category: skill.category as SkillCategory,
  level: SKILL_LEVELS[skill.category as SkillCategory] ?? 70,
  status: skill.status,
}));

export interface KnowledgeBase {
  id: string;
  label: string;
  /** Where the count comes from, shown in the UI so the number is auditable. */
  source: string;
  count: number;
  /** "local" = bundled dataset, "remote" = live count fetched from Supabase. */
  origin: "local" | "remote" | "documented";
}

const OSINT_POINTS =
  CONFLICT_ZONES.length +
  CHOKEPOINTS.length +
  NUCLEAR_SITES.length +
  MILITARY_BASES.length +
  ECONOMIC_CENTERS.length +
  UNDERSEA_CABLES.length +
  PIPELINES.length;

/** Bundled knowledge bases: counts come straight from the shipped datasets. */
export const LOCAL_KNOWLEDGE_BASES: KnowledgeBase[] = [
  { id: "geo", label: "OSINT & Geo", source: "geo-datasets.ts", count: OSINT_POINTS, origin: "local" },
  { id: "layers", label: "Capas tácticas", source: "globe-layers.ts", count: GLOBE_LAYERS.length, origin: "local" },
  { id: "models", label: "Registro de oráculos", source: "ai-models.ts", count: AI_MODELS.length, origin: "local" },
];

/** Bases whose counts are fetched live from the project database. */
export const REMOTE_KNOWLEDGE_BASES: { id: string; label: string; source: string; table: string }[] = [
  { id: "uap", label: "Registro UAP", source: "uap_sightings", table: "uap_sightings" },
  { id: "skills", label: "Base de conocimiento", source: "skills_documents", table: "skills_documents" },
];

/** Documented domains from the project spec that are not indexed in the DB yet. */
export const DOCUMENTED_DOMAINS = [
  { id: "physics", label: "Física Tesla 3-6-9", detail: "factor 16.18 · neutrinos · geometría" },
  { id: "dao", label: "DAO & Tokenomics", detail: "AlienFlowSpace · A₿TC · governance" },
  { id: "social", label: "Social Media", detail: "voz de marca · calendario · hashtags" },
];

/**
 * Supervisor routing. Mirrors the categories documented for the Agent Supervisor:
 * deterministic keyword matching, not a model call, so it is reproducible.
 */
export type RouteId =
  | "RAG_PHYSICS"
  | "MARKET_DAO"
  | "TASK_MANUS"
  | "SOCIAL_MEDIA"
  | "SECURITY_SCAN"
  | "CHAT_GENERAL";

export interface WorkflowRoute {
  id: RouteId;
  agent: string;
  detail: string;
  keywords: string[];
}

export const WORKFLOW_ROUTES: WorkflowRoute[] = [
  {
    id: "RAG_PHYSICS",
    agent: "RAG Physics",
    detail: "Física Tesla · neutrinos",
    keywords: ["física", "fisica", "tesla", "3-6-9", "369", "neutrino", "gravedad", "16.18", "cuántic", "cuantic", "sacra", "geometría sagrada"],
  },
  {
    id: "MARKET_DAO",
    agent: "RAG DAO",
    detail: "DeFi · tokens · mercados",
    keywords: ["defi", "token", "tokens", "mercado", "mercados", "cripto", "crypto", "btc", "bitcoin", "eth", "ethereum", "solana", "yield", "staking", "tvl", "precio", "trading", "airdrop", "wallet", "nft", "on-chain", "onchain"],
  },
  {
    id: "TASK_MANUS",
    agent: "Manus",
    detail: "código · automatización",
    keywords: ["código", "codigo", "code", "script", "bug", "refactor", "api", "deploy", "automat", "función", "funcion", "workflow", "sql", "typescript", "python", "json"],
  },
  {
    id: "SOCIAL_MEDIA",
    agent: "Social Media",
    detail: "contenido · propuestas",
    keywords: ["twitter", "x.com", "hilo", "thread", "post", "linkedin", "instagram", "discord", "telegram", "farcaster", "hashtag", "rrss", "redes", "contenido", "marketing", "viral"],
  },
  {
    id: "SECURITY_SCAN",
    agent: "Security",
    detail: "auditoría · vulnerabilidades",
    keywords: ["seguridad", "security", "auditoría", "auditoria", "audit", "vulnerab", "exploit", "hackeo", "phishing", "secreto", "dependencias", "npm audit"],
  },
  {
    id: "CHAT_GENERAL",
    agent: "Supervisor",
    detail: "conversación general",
    keywords: [],
  },
];

/**
 * Deterministic intent router used to light up the live workflow lanes.
 * Returns CHAT_GENERAL when nothing matches, which is the documented fallback.
 *
 * Scoring is keyword hits weighted by keyword length, because a long specific
 * term ("seguridad") carries more intent than a short generic one ("script").
 * Ties keep the first route in the documented order.
 */
export function classifyIntent(text: string): RouteId {
  const haystack = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  let best: { id: RouteId; score: number; longest: number } = { id: "CHAT_GENERAL", score: 0, longest: 0 };
  for (const route of WORKFLOW_ROUTES) {
    if (route.id === "CHAT_GENERAL") continue;
    let score = 0;
    let longest = 0;
    for (const keyword of route.keywords) {
      const needle = keyword.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (!haystack.includes(needle)) continue;
      if (needle.length > longest) longest = needle.length;
      score += needle.length > 4 ? 2 : 1;
    }
    if (score > best.score || (score === best.score && longest > best.longest)) {
      best = { id: route.id, score, longest };
    }
  }
  return best.id;
}

/** Rough token estimate (≈4 characters per token). Labelled "≈" wherever shown. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Usage reported by the provider when the stream includes it. */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** Real usage when the provider reported it, otherwise the documented estimate. */
export function messageTokens(content: string, usage?: TokenUsage | null): number {
  return usage?.totalTokens ?? estimateTokens(content);
}

/** Reads an OpenAI-style `usage` object from a stream chunk. */
export function parseUsage(raw: unknown): TokenUsage | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const promptTokens = typeof value.prompt_tokens === "number" ? value.prompt_tokens : 0;
  const completionTokens = typeof value.completion_tokens === "number" ? value.completion_tokens : 0;
  const totalTokens =
    typeof value.total_tokens === "number" ? value.total_tokens : promptTokens + completionTokens;
  if (promptTokens === 0 && completionTokens === 0 && totalTokens === 0) return null;
  return { promptTokens, completionTokens, totalTokens };
}

export function routeById(id: RouteId): WorkflowRoute {
  return WORKFLOW_ROUTES.find((route) => route.id === id) ?? WORKFLOW_ROUTES[WORKFLOW_ROUTES.length - 1];
}

/** Oracles that are actually selectable right now. */
export const ACTIVE_ORACLES = AI_MODELS.filter((model) => model.available);

export const CORE_META = {
  name: MOLTBOOK_AGENT.name,
  version: MOLTBOOK_AGENT.version,
  protocol: MOLTBOOK_AGENT.protocol,
  collective: MOLTBOOK_AGENT.collective,
  frequency: MOLTBOOK_AGENT.frequency,
};

/** Shown wherever a token figure appears, so the number is never mistaken for billing. */
export const TOKEN_ESTIMATE_NOTE =
  "Estimación: 4 caracteres ≈ 1 token sobre los mensajes guardados. No incluye el prompt de sistema, las imágenes ni los tokens de facturación.";

/** Real, runnable task for each skill — the sidebar launches it in the chat. */
export const SKILL_PROMPTS: Record<string, string> = {
  "1": "Razona con el marco 3-6-9 este problema y separa hechos verificables de hipótesis: ",
  "2": "Busca en fuentes oficiales y devuelve enlaces con fecha para verificar esto: ",
  "3": "Genera una pieza creativa breve (texto + guion visual) para la DAO sobre: ",
  "4": "Audita este contrato o flujo on-chain: enumera riesgos comprobables, supuestos y qué falta por verificar: ",
  "5": "Explica con rigor qué física hay detrás de este fenómeno y qué parte es especulativa: ",
  "6": "Propón una automatización concreta para operar esto desde Ai Tor, con pasos y comprobaciones: ",
};

/** Example order for each supervisor lane, ready to send to the agent. */
export const ROUTE_PROMPTS: Record<RouteId, string> = {
  RAG_PHYSICS: "Aplica el marco de física 3-6-9 y el factor 16.18 a este fenómeno, marcando qué es cálculo y qué es interpretación: ",
  MARKET_DAO: "Analiza el mercado DeFi actual: liquidez, TVL y riesgos. Cita las fuentes y la fecha de los datos: ",
  TASK_MANUS: "Actúa como Manus: desglosa esta tarea técnica en pasos ejecutables con criterios de aceptación: ",
  SOCIAL_MEDIA: "Prepara una propuesta de contenido lista para revisión humana, sin publicar: ",
  SECURITY_SCAN: "Haz una revisión de seguridad de este código o diseño, distinguiendo hallazgos comprobables de riesgos hipotéticos: ",
  CHAT_GENERAL: "Resume la sesión y propón el siguiente paso más útil para la DAO.",
};

export function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

export function formatLatency(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
