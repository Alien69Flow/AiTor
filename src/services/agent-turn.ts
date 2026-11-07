import { askAgent, streamAgentAnswer, type AgentImage } from "./mcpClient";
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
  /** Razonamiento previo del modelo, para el panel plegable del chat. */
  reasoning: string;
  /** Imágenes generadas por herramientas en este turno. */
  images: AgentImage[];
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
  /** Razonamiento en flujo, antes de la respuesta; puede llegar a trozos. */
  onThought?: (text: string) => void;
  /** Imagen lista: el hook la cuelga del mensaje sin esperar al final. */
  onImage?: (image: AgentImage) => void;
  /** Aviso de herramienta ejecutada, mientras el flujo sigue abierto. */
  onTool?: (name: string, isError: boolean) => void;
  /**
   * Por qué no hubo respuesta del agente. Sin esto el chat caía al modelo sin
   * herramientas en silencio y el usuario sólo veía una respuesta rara: así
   * puede decir «falta GEMINI_API_KEY» o «inicia sesión» en vez de dejarlo
   * adivinar.
   */
  onFailure?: (failure: AgentTurnFailure) => void;
}

export type AgentTurnFailureKind = "no-session" | "no-key" | "unavailable";

export interface AgentTurnFailure {
  kind: AgentTurnFailureKind;
  /** Mensaje del servidor, ya recortado, para enseñarlo tal cual. */
  detail: string;
  /** Código HTTP del endpoint cuando lo hubo. */
  status: number | null;
}

/** Un fallo por falta de sesión es el caso normal del invitado, no un error. */
const isMissingSession = (detail: string) => /iniciar sesión/i.test(detail);

/**
 * Traduce el error del endpoint a algo accionable.
 *
 * «El agente respondió 501: GEMINI_API_KEY no está configurada» y «no hay red»
 * no se arreglan igual, así que no pueden acabar en el mismo mensaje.
 */
export function describeAgentFailure(error: unknown): AgentTurnFailure {
  const detail = error instanceof Error ? error.message : String(error);
  const status = Number(/respondió (\d{3})/.exec(detail)?.[1] ?? NaN);
  const code = Number.isFinite(status) ? status : null;

  if (isMissingSession(detail)) return { kind: "no-session", detail, status: code };
  if (/GEMINI_API_KEY|GOOGLE_API_KEY|no está configurada|501/i.test(detail)) {
    return { kind: "no-key", detail, status: code };
  }
  return { kind: "unavailable", detail: detail.slice(0, 200), status: code };
}

export async function runAgentTurn(
  history: AgentTurn[],
  question: string,
  options: AgentTurnOptions = {},
): Promise<AgentTurnResult | null> {
  if (options.hasImage) return null;

  try {
    const prompt = buildAgentPrompt(history, question);
    const answer = options.onDelta
      ? await streamAgentAnswer(prompt, {
          onDelta: options.onDelta,
          onThought: options.onThought,
          onImage: options.onImage,
          onTool: options.onTool,
        })
      : await askAgent(prompt);
    const content = answer?.answer?.trim();
    if (!content) return null;

    const calls = answer.toolCalls ?? [];
    return {
      content,
      reasoning: answer.reasoning ?? "",
      images: answer.images ?? [],
      tools: calls.map((call) => call.name),
      failed: calls.filter((call) => call.isError).map((call) => call.name),
    };
  } catch (error) {
    const failure = describeAgentFailure(error);
    if (failure.kind !== "no-session") {
      console.warn("[agent-turn] el agente MCP no respondió; se usa el chat sin herramientas:", failure.detail);
    }
    options.onFailure?.(failure);
    return null;
  }
}
