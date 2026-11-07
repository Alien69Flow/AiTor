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
 * Filas de las herramientas MCP.
 *
 * `listed` es lo que el despliegue dice que tiene (`toolNames` de `/api/mcp`).
 * `null` = todavía no se ha preguntado: ni verde ni rojo, gris.
 */
export function mcpToolRows(
  tools: readonly McpToolLike[],
  listed: readonly string[] | null,
): ConnectionRow[] {
  return tools.map((tool) => {
    const row: ConnectionRow = {
      id: tool.name,
      title: tool.title || tool.name,
      detail: tool.description || tool.name,
      state: "idle",
    };
    if (listed === null) return row;
    const present = listed.includes(tool.name);
    return {
      ...row,
      state: present ? "ok" : "fail",
      error: present ? undefined : "no está en este despliegue",
      detail: tool.minTier ? `${row.detail} · plan ${tool.minTier}` : row.detail,
    };
  });
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
