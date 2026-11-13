/**
 * Registro herramienta -> tarjeta del chat.
 *
 * Sin React a proposito: se puede probar con Vitest sin montar nada, y el
 * componente que lo pinta (`ToolCard`) solo traduce un id a un icono.
 *
 * Antes `ChatMessage` decidia todo con `skill.ok`: un check o un triangulo. Eso
 * hacia indistinguibles una lectura de meteo y una de GitHub, y no habia sitio
 * donde annadir una herramienta nueva.
 */

export type ToolTone = "ok" | "info" | "warn" | "critical" | "unknown";
export type ToolIcon = "cloud" | "satellite" | "radar" | "github" | "database" | "wrench";

export interface ToolCardMeta {
  id: string;
  label: string;
  /** Nombres alternativos: ids namespaced, etiquetas en espanol, prefijos. */
  aliases: string[];
  icon: ToolIcon;
  tone: ToolTone;
  emptyHint: string;
}

export const TOOL_CARDS: Record<string, ToolCardMeta> = {
  weather: {
    id: "weather",
    label: "Meteo",
    aliases: ["meteo", "tiempo", "clima", "surface-weather"],
    icon: "cloud",
    tone: "info",
    emptyHint: "Sin lectura de superficie",
  },
  satellites: {
    id: "satellites",
    label: "Satélites",
    aliases: ["satelite", "satélites", "tle", "pases"],
    icon: "satellite",
    tone: "info",
    emptyHint: "Sin pases en la ventana",
  },
  osint: {
    id: "osint",
    label: "OSINT",
    aliases: ["radar", "fuentes abiertas"],
    icon: "radar",
    tone: "info",
    emptyHint: "Sin resultados públicos",
  },
  github: {
    id: "github",
    label: "GitHub",
    aliases: ["git", "repo", "repositorio"],
    icon: "github",
    tone: "info",
    emptyHint: "Sin respuesta de la API",
  },
  database: {
    id: "database",
    label: "Base de datos",
    aliases: ["db", "supabase", "base de datos", "sql"],
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

/** Minúsculas, sin acentos y sin espacios de sobra. */
export function normalizeToolKey(raw: string | null | undefined): string {
  return (raw ?? "")
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
