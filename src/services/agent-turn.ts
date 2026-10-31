import { askAgent, streamAgentAnswer } from "./mcpClient";
import { buildAgentPrompt, type AgentTurn } from "@/lib/agent-prompt";

/**
 * Un turno del chat resuelto por el agente con herramientas.
 *
 * Vive fuera del hook a propósito: así se puede probar sin montar React ni el
 * DOM, y el hook se queda solo con el estado. Es la pieza que decide si la
 * respuesta viene del agente (`/api/mcp`, con acceso al repositorio, la
 * telemetría y la base) o si hay que caer al chat de Supabase, que no tiene
 * herramientas.
 */
export interface AgentTurnResult {
  content: string;
  /** Herramientas que el modelo ejecutó, en orden. */
  tools: string[];
  /** Herramientas que fallaron: se marcan en el mensaje, no se ocultan. */
  failed: string[];
}

export interface AgentTurnOptions {
  /**
   * El bucle de herramientas no acepta adjuntos, así que con imagen se va por
   * el camino de siempre en vez de perder la imagen sin avisar.
   */
  hasImage?: boolean;
  /**
   * Con este callback la respuesta se pide en flujo y el chat la pinta según
   * llega; sin él se espera a la respuesta entera (más simple de probar).
   */
  onDelta?: (text: string) => void;
  /** Aviso de herramienta ejecutada, mientras el flujo sigue abierto. */
  onTool?: (name: string, isError: boolean) => void;
}

/** Un fallo por falta de sesión es el caso normal del invitado, no un error. */
const isMissingSession = (detail: string) => /iniciar sesión/i.test(detail);

export async function runAgentTurn(
  history: AgentTurn[],
  question: string,
  options: AgentTurnOptions = {},
): Promise<AgentTurnResult | null> {
  if (options.hasImage) return null;

  try {
    const prompt = buildAgentPrompt(history, question);
    const answer = options.onDelta
      ? await streamAgentAnswer(prompt, { onDelta: options.onDelta, onTool: options.onTool })
      : await askAgent(prompt);
    const content = answer?.answer?.trim();
    if (!content) return null;

    const calls = answer.toolCalls ?? [];
    return {
      content,
      tools: calls.map((call) => call.name),
      failed: calls.filter((call) => call.isError).map((call) => call.name),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (!isMissingSession(detail)) {
      console.warn("[agent-turn] el agente MCP no respondió; se usa el chat sin herramientas:", detail);
    }
    return null;
  }
}
