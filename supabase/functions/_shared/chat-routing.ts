/**
 * Enrutado del chat por coste.
 *
 * El chat contestaba con un único modelo: el que pidiera el cliente. Clasificar
 * la pregunta, comprimir un historial largo o decidir el formato son trabajos
 * cortos y mecánicos, y pagarlos a precio de modelo bueno era tirar cuota. Aquí
 * queda el reparto:
 *
 *   - **barato** (`CHEAP_MODEL`): clasifica la intención, resume el historial
 *     largo y elige el formato. Una llamada corta, sin streaming.
 *   - **bueno**: el modelo que pidió el cliente, y sólo para la respuesta final.
 *
 * Y si el proveedor de la respuesta final muere por cuota, `answerChain()`
 * devuelve las claves alternativas por orden: primero modelos del mismo nivel
 * en otros proveedores, después los baratos. Nunca repite el proveedor caído,
 * porque la clave muerta es la del proveedor, no la de un modelo suelto.
 *
 * Sin APIs de Deno a propósito: recibe el entorno como función, así se prueba
 * con un objeto cualquiera y el handler es el único que toca `Deno.env`.
 */

import { keyState, providerForModel, PROVIDERS } from "./ai-providers.ts";

/**
 * El modelo de trabajo. Gemini Flash Lite es el más barato del catálogo y
 * sobra para clasificar, resumir y elegir formato.
 */
export const CHEAP_MODEL = "google/gemini-2.5-flash-lite";

/** Modelos de trabajo: respuesta corta, precio bajo. */
const CHEAP_MODELS: readonly string[] = [
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-flash",
  "openai/gpt-5-nano",
  "openai/gpt-5-mini",
  "xai/grok-2",
  "deepseek/deepseek-v3",
  "deepseek/deepseek-chat",
];

export type ChatTier = "cheap" | "good";

/** Nivel de precio de un modelo del catálogo. */
export function tierOf(model: string): ChatTier {
  return CHEAP_MODELS.includes(model) ? "cheap" : "good";
}

/** A partir de aquí el historial se comprime antes de mandarlo al modelo bueno. */
export const MAX_HISTORY_CHARS = 6_000;

/**
 * Datos de herramientas por encima de esto se resumen: el modelo bueno lee el
 * resumen, no las doce mil letras del volcado.
 */
export const MAX_CONTEXT_CHARS = 4_000;

/** Turnos recientes que se conservan literales aunque haya resumen. */
export const KEEP_RECENT_MESSAGES = 4;

export interface ChatTurn {
  role: string;
  content: string;
}

export interface PrepPlan {
  /** El planificador barato siempre clasifica; esto es la puerta general. */
  needed: boolean;
  /** Hay historial de sobra: el barato lo resume y se recortan los turnos. */
  compressHistory: boolean;
  /** Los datos de herramientas son un volcado: se resumen y no se reenvían. */
  compressContext: boolean;
  historyChars: number;
}

function historyChars(messages: readonly ChatTurn[]): number {
  return messages.reduce((total, message) => total + message.content.length, 0);
}

/**
 * Decide qué trabajo barato hace falta en este turno.
 *
 * Clasificar y elegir formato es siempre rentable: una llamada corta al modelo
 * barato evita que el bueno escriba en un formato que no toca. Comprimir el
 * historial sólo lo es cuando el historial es largo; por debajo del umbral, el
 * resumen costaría más de lo que ahorra.
 */
export function planPrep(
  messages: readonly ChatTurn[],
  context: readonly string[] = [],
): PrepPlan {
  const contextChars = context.reduce((total, block) => total + block.length, 0);
  const chars = historyChars(messages) + contextChars;
  return {
    needed: messages.length > 0,
    // Sin turnos antiguos que quitar no hay nada que ahorrar recortando.
    compressHistory: chars > MAX_HISTORY_CHARS && messages.length > KEEP_RECENT_MESSAGES,
    compressContext: contextChars > MAX_CONTEXT_CHARS,
    historyChars: chars,
  };
}

export interface PrepRequest {
  system: string;
  user: string;
}

const PREP_SYSTEM = [
  "Eres el preparador de otra IA. No contestas a la pregunta del usuario.",
  "Devuelves SÓLO un objeto JSON, sin texto alrededor ni bloques de código, con estas claves:",
  '- "intencion": qué pide el usuario, en 12 palabras como mucho.',
  '- "idioma": código ISO del idioma de la consulta (es, en, ...).',
  '- "formato": cómo conviene presentar la respuesta final (prosa breve, lista, pasos, tabla).',
  '- "resumen": sólo si se te da un historial o unos datos que comprimir; 3 a 5 frases con lo esencial, conservando cifras y fuentes.',
  "Si falta un dato, usa null. No inventes hechos ni cifras.",
].join("\n");

function clamp(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function renderTurns(turns: readonly ChatTurn[]): string {
  return turns.map((turn) => `${turn.role}: ${turn.content}`).join("\n");
}

/**
 * Prompt del planificador. El historial antiguo va marcado como material a
 * comprimir y la pregunta actual aparte, para que el modelo barato no confunda
 * lo que dijo el usuario hace diez turnos con lo que pide ahora.
 */
export function buildPrepRequest(
  messages: readonly ChatTurn[],
  plan: PrepPlan,
  context: readonly string[] = [],
): PrepRequest {
  const recent = messages.slice(-KEEP_RECENT_MESSAGES);
  const older = messages.slice(0, Math.max(0, messages.length - KEEP_RECENT_MESSAGES));
  const parts: string[] = [];

  if (plan.compressHistory && older.length > 0) {
    parts.push("HISTORIAL A COMPRIMIR (turnos antiguos):", renderTurns(older), "");
  }

  if (context.length > 0) {
    parts.push(
      "DATOS DE HERRAMIENTAS DE ESTE TURNO (para el resumen, no los repitas enteros):",
      clamp(context.join("\n\n---\n\n"), 6_000),
      "",
    );
  }

  parts.push("ÚLTIMOS TURNOS:", renderTurns(recent) || "(sin turnos)");
  return { system: PREP_SYSTEM, user: parts.join("\n") };
}

export interface PrepAnswer {
  intencion: string | null;
  idioma: string | null;
  formato: string | null;
  resumen: string | null;
}

const PREP_FIELD_LIMITS = {
  intencion: 120,
  idioma: 8,
  formato: 120,
  resumen: 1_200,
} as const;

function readField(source: Record<string, unknown>, key: keyof typeof PREP_FIELD_LIMITS): string | null {
  const value = source[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.toLowerCase() === "null") return null;
  return clamp(trimmed, PREP_FIELD_LIMITS[key]);
}

/**
 * Lee la respuesta del planificador sin fiarse de ella: puede venir con un
 * bloque de código, con prosa alrededor o sin JSON siquiera. Si no hay objeto
 * legible se devuelve `null` y el turno sigue sin plan, que nunca es peor que
 * fallar.
 */
export function parsePrepAnswer(raw: string): PrepAnswer | null {
  const text = raw.replace(/```(?:json)?/gi, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const source = parsed as Record<string, unknown>;
  const answer: PrepAnswer = {
    intencion: readField(source, "intencion"),
    idioma: readField(source, "idioma"),
    formato: readField(source, "formato"),
    resumen: readField(source, "resumen"),
  };

  return answer.intencion || answer.idioma || answer.formato || answer.resumen ? answer : null;
}

/**
 * Bloque que se añade al prompt del modelo bueno. Es contexto, no órdenes: por
 * eso va rotulado como plan y con topes de longitud.
 */
export function buildPlanBlock(answer: PrepAnswer): string {
  const lines: string[] = ["", "## PLAN DEL TURNO (preparado por el clasificador)"];
  if (answer.idioma) lines.push(`- Responde en: ${answer.idioma}.`);
  if (answer.intencion) lines.push(`- Lo que pide el usuario: ${answer.intencion}.`);
  if (answer.formato) lines.push(`- Formato pedido: ${answer.formato}.`);
  if (answer.resumen) lines.push(`- Resumen del historial: ${answer.resumen}`);
  return lines.length > 2 ? lines.join("\n") : "";
}

/**
 * Historial que se manda al modelo bueno: los turnos recientes literales y, si
 * hubo resumen, los antiguos fuera (ya están condensados en el plan).
 */
export function trimHistory(
  messages: readonly ChatTurn[],
  prep: PrepAnswer | null,
  plan: PrepPlan,
): ChatTurn[] {
  if (!prep || !plan.compressHistory || !prep.resumen) return [...messages];
  return messages.slice(-KEEP_RECENT_MESSAGES);
}

/**
 * ¿El fallo es de cuota y merece probar otra clave?
 *
 * Un 400 por cuerpo inválido no se arregla cambiando de proveedor; una clave
 * sin saldo, agotada o revocada sí.
 */
export function isQuotaDeath(status: number, errorText: string): boolean {
  if (status === 429 || status === 402) return true;
  const text = errorText.toLowerCase();
  const looksLikeQuota =
    text.includes("quota") ||
    text.includes("insufficient") ||
    text.includes("credit") ||
    text.includes("billing") ||
    text.includes("rate limit") ||
    text.includes("exceeded") ||
    text.includes("too many requests");
  if (looksLikeQuota) return true;
  return status === 401 || status === 403;
}

/**
 * Claves alternativas para la respuesta final, en orden.
 *
 * Se excluye el proveedor del modelo pedido —la clave caída es la del
 * proveedor— y se prefieren modelos del mismo nivel antes de bajar a los
 * baratos: si el usuario eligió un modelo bueno, una respuesta peor es
 * preferible a ninguna, pero sólo como último recurso.
 */
export function answerChain(model: string, env: (name: string) => string | undefined): string[] {
  const dead = providerForModel(model)?.id ?? null;

  const candidates = PROVIDERS.filter(
    (provider) => provider.id !== dead && keyState(env(provider.envVar)) === "ok",
  ).flatMap((provider) =>
    provider.models.map((candidate) => ({ model: candidate, tier: tierOf(candidate) })),
  );

  const wanted = tierOf(model);
  const sameTier = candidates.filter((entry) => entry.tier === wanted).map((entry) => entry.model);
  const otherTier = candidates.filter((entry) => entry.tier !== wanted).map((entry) => entry.model);

  return [...new Set([...sameTier, ...otherTier])].filter((candidate) => candidate !== model);
}

/** Resultado de un intento contra una clave. */
export interface Attempt<Ok> {
  ok: boolean;
  /** Código HTTP; `0` significa que ni hubo respuesta (clave ausente, red). */
  status: number;
  errorText?: string;
  value?: Ok;
}

export interface ResolvedAttempt<Ok> {
  /** Quién respondió, o quién falló el último si nadie respondió. */
  model: string;
  attempt: Attempt<Ok>;
  /** Claves probadas, en orden: sirve para el log y para las pruebas. */
  tried: string[];
}

/**
 * Recorre la cadena hasta que una clave conteste.
 *
 * Se cambia de clave si la anterior murió por cuota o si ni hubo respuesta
 * (clave ausente, proveedor inalcanzable). Un error de otra clase —cuerpo
 * inválido, modelo retirado— se devuelve tal cual: cambiar de proveedor no lo
 * arregla y gastaría la cuota de la alternativa para nada.
 */
export async function resolveWithFallback<Ok>(
  candidates: readonly string[],
  attempt: (model: string) => Promise<Attempt<Ok>>,
): Promise<ResolvedAttempt<Ok>> {
  const tried: string[] = [];
  let last: ResolvedAttempt<Ok> = {
    model: candidates[0] ?? "",
    attempt: { ok: false, status: 0, errorText: "sin candidatos" },
    tried,
  };

  for (const [index, candidate] of candidates.entries()) {
    tried.push(candidate);
    const result = await attempt(candidate);
    last = { model: candidate, attempt: result, tried };
    if (result.ok) return last;

    const retryable = result.status === 0 || isQuotaDeath(result.status, result.errorText ?? "");
    if (!retryable || index === candidates.length - 1) return last;
  }

  return last;
}

/** Modelo barato que de verdad puede responder ahora mismo, si hay alguno. */
export function prepModel(env: (name: string) => string | undefined): string | null {
  const spec = providerForModel(CHEAP_MODEL);
  const preferred = spec && keyState(env(spec.envVar)) === "ok" ? CHEAP_MODEL : null;
  if (preferred) return preferred;

  const alternative = CHEAP_MODELS.map((model) => ({ model, provider: providerForModel(model) }))
    .find((entry) => entry.provider && keyState(env(entry.provider.envVar)) === "ok");
  return alternative?.model ?? null;
}
