/**
 * Prompt que se le manda al agente con herramientas (`POST /api/mcp`).
 *
 * El endpoint acepta una sola cadena (`{ prompt }`), no un array de mensajes,
 * así que el contexto de la conversación viaja como texto. Se recortan los
 * turnos para que una conversación larga no se coma el presupuesto del modelo:
 * el agente necesita sitio para las respuestas de las herramientas (el árbol
 * del repositorio son decenas de miles de caracteres).
 *
 * Puro a propósito: se prueba sin red ni sesión.
 */

export interface AgentTurn {
  role: "user" | "assistant";
  content: string;
}

/** Cuántos turnos previos se adjuntan. Más allá, el resumen estorba. */
export const MAX_HISTORY_TURNS = 6;

/** Tope por turno: una respuesta larga aporta poco y quita sitio a las herramientas. */
export const MAX_TURN_CHARS = 600;

/**
 * Tope del prompt completo. El endpoint recorta a 4000 caracteres **por el
 * final**, y el final es la pregunta: si el historial se pasa, el modelo
 * recibiría la conversación antigua y ninguna pregunta. Se recortan los turnos
 * más viejos desde aquí para que eso no pueda pasar.
 */
export const MAX_PROMPT_CHARS = 3_500;

const cut = (text: string, max: number): string => {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
};

/**
 * Compone el prompt final. Sin historial devuelve la pregunta tal cual: no hay
 * nada que contextualizar y cualquier preámbulo solo gasta tokens.
 */
export function buildAgentPrompt(history: AgentTurn[], question: string): string {
  const turns = history
    .filter((turn) => turn.content.trim().length > 0)
    .slice(-MAX_HISTORY_TURNS)
    .map((turn) => `${turn.role === "user" ? "Tú" : "AI Tor"}: ${cut(turn.content, MAX_TURN_CHARS)}`);

  const ask = question.trim();
  if (turns.length === 0) return ask;

  const compose = (kept: string[]) =>
    [
      "Contexto de los últimos mensajes (para no repetir lo ya dicho):",
      ...kept,
      "",
      "Responde ahora a esto. Usa las herramientas cuando la respuesta dependa de datos reales " +
        "(repositorio, telemetría, base de datos, previsión) en vez de contestar de memoria.",
      "",
      ask,
    ].join("\n");

  // Se van soltando los turnos más antiguos hasta que quepa la pregunta entera.
  const kept = [...turns];
  let prompt = compose(kept);
  while (prompt.length > MAX_PROMPT_CHARS && kept.length > 0) {
    kept.shift();
    prompt = compose(kept);
  }
  return prompt;
}
