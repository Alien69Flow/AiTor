import type { Severity } from "./severity";

/**
 * Registro herramienta -> tarjeta del chat.
 *
 * Sin React a proposito: se puede probar con Vitest sin montar nada, y el
 * componente que lo pinta (`ToolCard`) solo traduce un id a un icono.
 *
 * Habla DOS vocabularios, porque `message.skills` sale de dos sitios:
 *
 *   · el agente manda el nombre crudo de la herramienta MCP (`call.name`), con
 *     forma `mcp__weather__get`, `weather_current` o `getWeather`;
 *   · sin agente, `runSkills` manda `skillLabel(id)`: "Web", "Mercado",
 *     "Repositorio", "Código del proyecto", "OSINT", "Clima espacial".
 *
 * Si una etiqueta nueva no aparece aqui, cae en la tarjeta generica gris. El
 * test recorre `SKILLS` de `ai-skills.ts` justo para que eso no pase inadvertido.
 */

export type ToolIcon =
  | "cloud"
  | "satellite"
  | "radar"
  | "github"
  | "database"
  | "search"
  | "coins"
  | "code"
  | "sun"
  | "wrench";

export interface ToolCardMeta {
  id: string;
  label: string;
  /** Nombres alternativos: ids namespaced, etiquetas en espanol, prefijos. */
  aliases: string[];
  icon: ToolIcon;
  /** Tono cuando la fuente responde. Si falla, `ToolCard` pinta `critical`. */
  tone: Severity;
  emptyHint: string;
}

export const TOOL_CARDS: Record<string, ToolCardMeta> = {
  // --- Skills del chat (src/lib/ai-skills.ts) --------------------------------
  web: {
    id: "web",
    label: "Web",
    aliases: ["busqueda", "búsqueda", "internet", "search", "firecrawl"],
    icon: "search",
    tone: "info",
    emptyHint: "Sin resultados de búsqueda",
  },
  market: {
    id: "market",
    label: "Mercado",
    aliases: ["precio", "price", "cripto", "crypto", "coingecko", "cotizacion"],
    icon: "coins",
    tone: "info",
    emptyHint: "Sin cotización",
  },
  repo: {
    id: "repo",
    label: "Repositorio",
    aliases: ["github", "git", "repositorio", "github-proxy", "repos"],
    icon: "github",
    tone: "info",
    emptyHint: "Sin respuesta de GitHub",
  },
  code: {
    id: "code",
    label: "Código",
    aliases: ["codigo", "código del proyecto", "arbol", "tree", "fuente"],
    icon: "code",
    tone: "info",
    emptyHint: "Sin árbol del proyecto",
  },
  osint: {
    id: "osint",
    label: "OSINT",
    aliases: ["radar", "inteligencia", "fuentes abiertas", "osint-aggregator", "uap"],
    icon: "radar",
    tone: "info",
    emptyHint: "Sin resultados públicos",
  },
  spaceWeather: {
    id: "spaceWeather",
    label: "Clima espacial",
    aliases: ["space weather", "clima espacial", "spaceweather", "noaa", "kp", "aurora"],
    icon: "sun",
    tone: "info",
    emptyHint: "Sin datos de NOAA",
  },
  // --- Familias de herramientas MCP (src/lib/mcp/tools/) ---------------------
  weather: {
    id: "weather",
    label: "Meteo",
    aliases: ["meteo", "tiempo", "clima", "surface-weather", "aemet"],
    icon: "cloud",
    tone: "info",
    emptyHint: "Sin lectura de superficie",
  },
  satellites: {
    id: "satellites",
    label: "Satélites",
    aliases: ["satelite", "satélites", "tle", "pases", "orbita"],
    icon: "satellite",
    tone: "info",
    emptyHint: "Sin pases en la ventana",
  },
  database: {
    id: "database",
    label: "Base de datos",
    aliases: ["db", "supabase", "base de datos", "sql", "query"],
    icon: "database",
    tone: "info",
    emptyHint: "Consulta sin filas",
  },
};

/** Lo desconocido se pinta igual de bien: gris, con nombre genérico y sin romper. */
export const FALLBACK_CARD: ToolCardMeta = {
  id: "generic",
  label: "Herramienta",
  aliases: [],
  icon: "wrench",
  tone: "unknown",
  emptyHint: "Sin datos",
};

/**
 * Minúsculas, sin acentos y sin espacios de sobra. Separa camelCase para que
 * `getWeather` se pueda partir por palabras como `get_weather`.
 */
export function normalizeToolKey(raw: string | null | undefined): string {
  return (raw ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const BY_KEY: Record<string, ToolCardMeta> = Object.values(TOOL_CARDS).reduce(
  (acc, card) => {
    acc[normalizeToolKey(card.id)] = card;
    acc[normalizeToolKey(card.label)] = card;
    for (const alias of card.aliases) acc[normalizeToolKey(alias)] = card;
    return acc;
  },
  {} as Record<string, ToolCardMeta>,
);

export function resolveToolCard(raw: string | null | undefined): ToolCardMeta {
  const key = normalizeToolKey(raw);
  if (!key) return FALLBACK_CARD;
  if (BY_KEY[key]) return BY_KEY[key];
  // Nombres namespaced: `mcp__weather__get`, `weather.get`, `tool:weather`.
  const token = key.split(/[^a-z0-9]+/).find((part) => part in BY_KEY);
  return token ? BY_KEY[token] : FALLBACK_CARD;
}
