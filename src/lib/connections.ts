import type { SkillId } from "@/lib/ai-skills";

/**
 * Panel de conexiones: qué puede consultar AI Tor ahora mismo y cuánto tarda.
 *
 * La regla es la misma que en el resto del proyecto: no se enseña una fila verde
 * porque la herramienta esté en una lista, sino porque acaba de responder. Las
 * piezas de este módulo son puras (sin red, sin React) para que la decisión de
 * pintar ✅ o ❌ se pueda probar.
 */

export type ConnectionState = "ok" | "fail" | "idle";

export interface ConnectionRow {
  id: string;
  title: string;
  detail: string;
  state: ConnectionState;
  /** Latencia medida de la llamada real, cuando la hubo. */
  ms?: number;
  error?: string;
}

/**
 * Texto mínimo que hace que `routeSkills` vuelva a elegir esa skill.
 *
 * Sirve de sonda: el panel llama a la skill con este texto y mide. Si mañana
 * cambian los patrones de `ai-skills.ts`, la prueba de este módulo falla en vez
 * de dejar el panel probando una skill que ya no se enruta.
 */
export const SKILL_PROBE_TEXT: Record<SkillId, string> = {
  web: "busca en internet el origen del nombre",
  market: "precio de bitcoin ahora",
  repo: "repositorio Alien69Flow/AiTor",
  code: "¿qué archivos hay en el repositorio del proyecto?",
  osint: "últimos eventos osint",
  spaceWeather: "viento solar y actividad geomagnética",
};

export interface McpToolLike {
  name: string;
  title?: string;
  description?: string;
  minTier?: string;
}

/**
 * Herramientas que sólo existen en el despliegue.
 *
 * `media.*` se define en `api/mcp.ts`, que es código de servidor: el catálogo
 * del navegador (`MCP_TOOLS`) no las tiene y por eso el panel enseñaba 6 de las
 * 9. Se etiquetan aquí, sin importar el módulo del servidor al bundle.
 */
export const SERVER_ONLY_TOOLS: Record<string, { title: string; detail: string }> = {
  "media.image": { title: "Generar una imagen", detail: "Gemini · imagen en el chat · plan pro" },
  "media.music": { title: "Componer música", detail: "Lyria · 30 s o tema completo · plan pro" },
  "media.speech": { title: "Poner voz a un texto", detail: "Gemini TTS · locución · plan pro" },
  "media.video": { title: "Generar un vídeo", detail: "Veo · clip de 4-8 s por operación · plan pro" },
  "weather.aemet": {
    title: "Tiempo oficial en España",
    detail: "AEMET OpenData · previsión y observación · plan free",
  },
};

/**
 * Cada grupo de herramientas con su clave. No es una lista única porque las
 * claves son independientes: sin GEMINI_API_KEY no hay imagen, música ni vídeo,
 * y sin AEMET_API_KEY no hay AEMET — pero una no tapa a la otra.
 */
export const MODEL_KEY_TOOLS = ["media.image", "media.music", "media.speech", "media.video"];

/** Herramientas que dependen de la clave de AEMET OpenData. */
export const AEMET_KEY_TOOLS = ["weather.aemet"];

/** Todas las que necesitan alguna clave, para contarlas de una vez. */
export const KEYED_TOOLS = [...MODEL_KEY_TOOLS, ...AEMET_KEY_TOOLS];

/**
 * Filas de las herramientas MCP.
 *
 * `listed` es lo que el despliegue dice que publica (`toolNames` de
 * `/api/mcp`), y manda: una herramienta que el servidor anuncia se lista aunque
 * el navegador no la conozca, y una del catálogo que no llega se marca en rojo.
 * `null` = todavía no se ha preguntado: gris, ni verde ni rojo.
 *
 * `keyState` decide el estado real de las herramientas que gastan clave: con la
 * clave ausente la fila no puede estar verde aunque la herramienta esté
 * publicada, porque llamarla falla.
 */
export function mcpToolRows(
  tools: readonly McpToolLike[],
  listed: readonly string[] | null,
  keyState: string = "unknown",
  aemetKeyState: string = "unknown",
): ConnectionRow[] {
  const known = new Set(tools.map((tool) => tool.name));
  const extras = (listed ?? [])
    .filter((name) => !known.has(name))
    .map((name) => ({ name } as McpToolLike));
  const catalog = [...tools, ...extras];

  return catalog.map((tool) => {
    const serverOnly = SERVER_ONLY_TOOLS[tool.name];
    const base: ConnectionRow = {
      id: tool.name,
      title: tool.title || serverOnly?.title || tool.name,
      detail: tool.description || serverOnly?.detail || tool.name,
      state: "idle",
    };
    if (listed === null) return base;

    const present = listed.includes(tool.name);
    if (!present) {
      return { ...base, state: "fail", error: "no está en este despliegue" };
    }

    const detail = tool.minTier ? `${base.detail} · plan ${tool.minTier}` : base.detail;
    if (MODEL_KEY_TOOLS.includes(tool.name) && keyState !== "ok") {
      return {
        ...base,
        detail,
        state: "fail",
        error: "publicada, pero sin GEMINI_API_KEY no puede ejecutarse",
      };
    }
    if (AEMET_KEY_TOOLS.includes(tool.name) && aemetKeyState !== "ok") {
      return {
        ...base,
        detail,
        state: "fail",
        error: "publicada, pero sin AEMET_API_KEY no puede ejecutarse",
      };
    }
    return { ...base, detail, state: "ok" };
  });
}

/** Cómo se lee la clave del modelo, que es lo que decide si hay imagen y audio. */
export function modelKeyRow(
  payload: { geminiKeyState?: string } | null,
  ms: number | null,
): ConnectionRow {
  const state = payload?.geminiKeyState;
  const base: ConnectionRow = {
    id: "model-key",
    title: "Clave del modelo (GEMINI_API_KEY)",
    detail: "Imagen, música y voz dependen de esta clave",
    state: "idle",
    ms: ms ?? undefined,
  };
  if (payload === null) return base;
  if (state === "ok") return { ...base, state: "ok", detail: "presente: imagen, música y voz disponibles" };
  if (state === "placeholder")
    return { ...base, state: "fail", error: "marcador de posición, no una clave real" };
  return { ...base, state: "fail", error: "ausente: la cuenta no genera imagen ni audio" };
}

/** Cómo se lee el estado de la clave del modelo en una línea. */
export function mcpSummary(
  payload: { tools?: number; geminiKeyState?: string } | null,
  ms: number | null,
): { state: ConnectionState; detail: string } {
  if (!payload) return { state: "fail", detail: "sin respuesta de /api/mcp" };
  const estadoClave =
    payload.geminiKeyState === "ok"
      ? "clave del modelo ok"
      : payload.geminiKeyState === "placeholder"
        ? "clave con marcador de posición"
        : "sin clave: responde sin herramientas";
  return {
    state: payload.geminiKeyState === "ok" ? "ok" : "fail",
    detail: `${payload.tools ?? 0} herramientas · ${estadoClave}${ms === null ? "" : ` · ${ms} ms`}`,
  };
}

/** Cuántas conexiones responden, para el resumen de cabecera. */
export function summarize(rows: readonly ConnectionRow[]): {
  ok: number;
  fail: number;
  idle: number;
} {
  return {
    ok: rows.filter((row) => row.state === "ok").length,
    fail: rows.filter((row) => row.state === "fail").length,
    idle: rows.filter((row) => row.state === "idle").length,
  };
}
