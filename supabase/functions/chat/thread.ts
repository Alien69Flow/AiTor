/**
 * Cableado de la memoria entre sesiones dentro de la función `chat`.
 *
 * `memory.ts` sabe leer, escribir y resumir; esto decide cuándo, y con qué
 * identificador. Tres decisiones que conviene entender antes de tocarlo:
 *
 *  1. **El identificador del hilo es opaco y lo aporta el llamante.**
 *     `tg_<32 hex>` lo calcula el webhook con HMAC del token del bot y el
 *     chat_id: 128 bits que no se pueden adivinar, estables entre reinicios y
 *     que no guardan el chat_id en la base. `web_<32 hex>` es el mismo tipo de
 *     token, generado en el navegador y guardado en localStorage.
 *     Ventaja: quien tenga el token lee el hilo — igual que una cookie de
 *     sesión — y nadie más puede, sin necesidad de una variable nueva en dos
 *     servicios ni de una llamada extra a `auth/v1/user` por mensaje.
 *  2. **Todo es opcional.** Sin hilo válido el chat funciona exactamente como
 *     antes: no se lee, no se escribe.
 *  3. **Nada de esto puede romper la respuesta.** El guardado corre en segundo
 *     plano; si Postgres o la red fallan, se pierde memoria, no el mensaje.
 */

import {
  appendTurn,
  historyMessages,
  loadThread,
  memoryConfig,
  summarizeIfNeeded,
  type ThreadRef,
  type ThreadTurn,
} from "./memory.ts";

/** 32 hex = 128 bits. Más corto se podría enumerar; más largo no aporta. */
export const THREAD_TOKEN = /^(tg|web)_[0-9a-f]{32}$/;

const PREFIX: Record<ThreadRef["surface"], string> = { telegram: "tg_", web: "web_" };

/**
 * Acepta sólo un hilo bien formado y con el prefijo de su superficie. Un
 * `web_…` no puede escribir en el hilo de Telegram de otro, y al revés.
 */
export function normalizeThreadRef(raw: unknown): ThreadRef | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { surface, externalId } = raw as { surface?: unknown; externalId?: unknown };
  if (surface !== "telegram" && surface !== "web") return null;
  if (typeof externalId !== "string" || !THREAD_TOKEN.test(externalId)) return null;
  if (!externalId.startsWith(PREFIX[surface])) return null;
  return { surface, externalId };
}

/** Lo que se antepone al prompt: el resumen y los turnos que toquen. */
export async function memoryMessagesFor(raw: unknown): Promise<{
  ref: ThreadRef | null;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}> {
  const ref = normalizeThreadRef(raw);
  if (!ref) return { ref: null, messages: [] };
  try {
    const loaded = await loadThread(ref, memoryConfig());
    return { ref, messages: historyMessages(loaded) };
  } catch {
    return { ref, messages: [] };
  }
}

/**
 * Texto completo de un stream SSE con formato OpenAI. Se usa para guardar el
 * turno y para el resumen; los trozos no-JSON (comentarios del gateway, líneas
 * partidas) se ignoran sin cortar la lectura.
 */
export async function collectText(
  stream: ReadableStream<Uint8Array> | null,
): Promise<string> {
  if (!stream) return "";
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let out = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index: number;
      while ((index = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: unknown } }>;
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (typeof delta === "string") out += delta;
        } catch {
          // Línea partida o comentario del gateway: no es un dato.
        }
      }
    }
  } catch {
    // Stream cortado a mitad: se guarda lo que haya llegado.
  }
  return out.trim();
}

/**
 * Guarda el turno cuando el stream termina.
 *
 * Se llama con la copia de un `tee()`: el cliente recibe la otra, así que el
 * guardado nunca retrasa la respuesta. Aun así se drena la copia cuando no hay
 * hilo, para que el `tee` no bloquee al cliente.
 */
export async function rememberTurn(
  ref: ThreadRef | null,
  userText: string,
  stream: ReadableStream<Uint8Array> | null,
  summarize: (previous: string | null, turns: ThreadTurn[]) => Promise<string | null>,
): Promise<void> {
  if (!ref) {
    await collectText(stream);
    return;
  }
  try {
    const assistant = await collectText(stream);
    const config = memoryConfig();
    const threadId = await appendTurn(ref, userText, assistant, config);
    if (threadId) await summarizeIfNeeded(threadId, summarize, config);
  } catch {
    // La memoria es un extra: se pierde el turno, no la conversación.
  }
}

/** Lo que se le pide al modelo para resumir: datos, no prosa. */
export function summarizePrompt(previous: string | null, turns: ThreadTurn[]): string {
  const transcript = turns
    .map((turn) => `${turn.role === "user" ? "USUARIO" : "AI TOR"}: ${turn.content}`)
    .join("\n");
  return [
    "Resume la conversación en 600 caracteres como máximo, en español, en tercera persona.",
    "Guarda sólo lo que haga falta para seguir hablando: cómo se llama el usuario y cómo quiere que le hable, en qué está trabajando (proyecto, token, duda abierta), decisiones ya tomadas y correcciones.",
    "No guardes saludos, ni el texto largo de las respuestas, ni claves, emails o datos personales.",
    previous ? `Resumen anterior (actualízalo, no lo repitas):\n${previous}` : "",
    `Conversación:\n${transcript}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Supabase mata el trabajo en segundo plano al cerrar la respuesta salvo que se
 * registre con `EdgeRuntime.waitUntil`. Fuera de ese runtime (tests, Node) se
 * deja correr sin esperar: nunca se propaga el error.
 */
export function runInBackground(task: Promise<unknown>): void {
  const runtime = (globalThis as {
    EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void };
  }).EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(task);
    return;
  }
  void task.catch(() => undefined);
}
