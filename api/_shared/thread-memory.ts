/**
 * Memoria del hilo en Redis, por capas.
 *
 * Antes vivía en Postgres y leerla exigía aplicar una migración
 * (`20261118190000_chat_memory.sql`) y darle al webhook la service key. Si la
 * migración no estaba aplicada, la memoria devolvía vacío en silencio: código
 * que parecía funcionar y no hacía nada. Aquí todo cabe en un hash de Redis,
 * que no necesita migraciones ni permisos de base de datos.
 *
 * ## Las tres capas
 *
 * Un hilo es un solo hash (`aitor:thread:<tg_…>`) con tres campos, de lo más
 * barato a lo más caro de leer:
 *
 *   - `title`   — de qué va el hilo, en una línea. Se saca del primer mensaje,
 *                 sin gastar modelo. Sirve para reconocerlo y para el prompt.
 *   - `summary` — lo que ya no cabe en la ventana, condensado. Cuando la
 *                 evidencia se desborda, lo que sale se resume aquí.
 *   - `evidence`— los últimos intercambios literales: la prueba de lo que dice
 *                 el resumen. Es lo que de verdad se le pasa al modelo.
 *
 * `historyMessages()` las compone en ese orden: título, resumen y evidencia.
 * Si el hilo lleva parado más de `STALE_HOURS`, la evidencia no se inyecta
 * (un mensaje de anteayer no debe arrastrar la conversación) pero el resumen
 * sí: es contexto, no conversación.
 *
 * ## Identidad
 *
 * El hilo es el token opaco que ya existe: `tg_<32 hex>` lo calcula el webhook
 * con HMAC del token del bot y el `chat_id`; `web_<32 hex>` es su equivalente
 * en el navegador. El `chat_id` no se guarda en Redis y un `web_…` no puede
 * leer el hilo de Telegram de otro.
 *
 * ## Nada de esto puede tumbar el chat
 *
 * Sin Upstash configurado no se hace ni una petición y el bot contesta como
 * antes. Cualquier error deja `null` o `false`: se pierde memoria, no mensaje.
 */

import { isRedisConfigured, redisPipeline, redisCommand, scopedKey } from "./redis.js";

export type ThreadSurface = "telegram" | "web";

export interface ThreadRef {
  surface: ThreadSurface;
  /** Token opaco del hilo, no el chat_id. */
  externalId: string;
}

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LoadedThread {
  /** Capa 0: de qué va el hilo. */
  title: string | null;
  /** Capa 1: lo resumido de lo que ya no cabe. */
  summary: string | null;
  /** Capa 2: los últimos intercambios literales. */
  turns: HistoryMessage[];
  lastActiveAt: string | null;
}

/** 32 hex = 128 bits: no se puede enumerar y no guarda el chat_id. */
const THREAD_TOKEN = /^(tg|web)_[0-9a-f]{32}$/;
const PREFIX: Record<ThreadSurface, string> = { telegram: "tg_", web: "web_" };

/** Cuatro intercambios: ocho mensajes, ~1.500 tokens con la memoria delante. */
export const WINDOW_MESSAGES = 8;
/** Un hilo parado más de esto no arrastra evidencia cruda, sólo la memoria. */
export const STALE_HOURS = 6;
/** El mismo tope que tenía la tabla, para no guardar respuestas enteras. */
const MAX_TEXT = 8_000;
/** Un título es una etiqueta, no un párrafo. */
export const TITLE_MAX_CHARS = 80;
/** El resumen es un dato, no un ensayo. */
export const SUMMARY_MAX_CHARS = 600;
/** 30 días sin hablar y el hilo deja de existir. */
export const THREAD_TTL_SECONDS = 30 * 24 * 3_600;

const FIELDS = { title: "title", summary: "summary", evidence: "evidence", activeAt: "activeAt" } as const;

/**
 * Acepta sólo un hilo bien formado y con el prefijo de su superficie: un
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

/** Clave del hash. El prefijo de entorno lo pone `scopedKey`. */
export function threadMemoryKey(ref: ThreadRef): string {
  return scopedKey(`aitor:thread:${ref.externalId}`);
}

/** Sin Upstash no hay memoria; el chat funciona igual. */
export function memoryConfigured(): boolean {
  return isRedisConfigured();
}

/** Un hilo sin hablar en `STALE_HOURS` no arrastra evidencia cruda. */
export function isStale(lastActiveAt: string | null, now = Date.now()): boolean {
  if (!lastActiveAt) return false;
  const at = Date.parse(lastActiveAt);
  if (!Number.isFinite(at)) return false;
  return now - at > STALE_HOURS * 3_600_000;
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Título de la capa 0 a partir del primer mensaje del usuario. Sin modelo: es
 * una etiqueta, y una llamada de IA para ponerle nombre a un hilo costaría más
 * que el hilo.
 */
export function deriveTitle(text: string): string | null {
  const clean = oneLine(text)
    // Un comando (/start, /alerta) etiqueta el hilo con el comando, sin la barra.
    .replace(/^\/([a-z0-9_]+)/i, "$1");
  if (!clean) return null;
  if (clean.length <= TITLE_MAX_CHARS) return clean;
  const cut = clean.slice(0, TITLE_MAX_CHARS);
  const space = cut.lastIndexOf(" ");
  return `${(space > TITLE_MAX_CHARS * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * Capa 1: lo que se sale de la ventana, condensado. `previous` se conserva
 * delante porque es contexto más viejo; si el resultado no cabe, se tira por
 * la cabecera (lo más antiguo) y se marca con puntos suspensivos.
 */
export function rollUpSummary(
  previous: string | null,
  overflow: readonly HistoryMessage[],
): string | null {
  if (overflow.length === 0) return previous;
  const condesado = overflow
    .map((turn) => `${turn.role === "user" ? "USUARIO" : "AI TOR"}: ${oneLine(turn.content).slice(0, 240)}`)
    .join(" · ");
  const joined = [previous?.trim(), condesado].filter(Boolean).join(" · ");
  if (!joined) return null;
  if (joined.length <= SUMMARY_MAX_CHARS) return joined;
  return `…${joined.slice(joined.length - (SUMMARY_MAX_CHARS - 1))}`;
}

function usableTurn(raw: unknown): raw is HistoryMessage {
  const turn = raw as { role?: unknown; content?: unknown };
  return (
    (turn?.role === "user" || turn?.role === "assistant") &&
    typeof turn.content === "string" &&
    turn.content.length > 0
  );
}

function parseEvidence(raw: unknown): HistoryMessage[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(usableTurn).slice(-WINDOW_MESSAGES) : [];
  } catch {
    return [];
  }
}

/** Campos del hash, sin fiarse de lo que haya guardado. */
function parseHash(raw: unknown): LoadedThread {
  const hash = (raw ?? {}) as Record<string, unknown>;
  const text = (value: unknown): string | null =>
    typeof value === "string" && value.trim() ? value.trim() : null;
  return {
    title: text(hash[FIELDS.title]),
    summary: text(hash[FIELDS.summary]),
    turns: parseEvidence(hash[FIELDS.evidence]),
    lastActiveAt: text(hash[FIELDS.activeAt]),
  };
}

/**
 * Lo que se le pasa al modelo sobre el hilo: título y resumen como memoria y,
 * debajo, la evidencia literal. Devuelve `[]` si no hay nada, para que el
 * llamante no tenga que distinguir «hilo vacío» de «sin memoria».
 */
export function historyMessages(thread: LoadedThread | null, now = Date.now()): HistoryMessage[] {
  if (!thread) return [];
  const messages: HistoryMessage[] = [];

  const lines = [
    thread.title ? `Título del hilo: ${thread.title}` : null,
    thread.summary ? `Resumen de lo hablado antes: ${thread.summary}` : null,
  ].filter(Boolean);

  if (lines.length > 0) {
    messages.push({
      role: "user",
      content: `[MEMORIA DEL HILO — resumen de lo hablado antes, no es un mensaje nuevo]\n${lines.join("\n")}`,
    });
    messages.push({
      role: "assistant",
      content: "Entendido: tengo en cuenta ese contexto previo.",
    });
  }

  if (!isStale(thread.lastActiveAt, now)) messages.push(...thread.turns);
  return messages;
}

/** Lee las tres capas del hilo en una sola llamada. */
export async function loadThread(ref: ThreadRef): Promise<LoadedThread | null> {
  if (!memoryConfigured()) return null;
  try {
    const hash = await redisCommand<Record<string, unknown> | null>([
      "HGETALL",
      threadMemoryKey(ref),
    ]);
    if (!hash || typeof hash !== "object") {
      return { title: null, summary: null, turns: [], lastActiveAt: null };
    }
    return parseHash(hash);
  } catch (error) {
    console.warn("[memory] no se pudo leer el hilo:", error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Guarda un turno: mueve la evidencia, saca de la ventana lo que sobra hacia el
 * resumen y renueva el TTL. Devuelve `false` si no se pudo escribir; nunca lanza.
 *
 * Lee antes de escribir porque la capa 1 se calcula sobre lo que ya había. Dos
 * mensajes simultáneos del mismo chat (Telegram no los manda) podrían perder
 * uno; el precio de hacerlo atómico sería un script Lua por turno.
 */
export async function saveTurn(
  ref: ThreadRef,
  userText: string,
  assistantText: string,
): Promise<boolean> {
  if (!memoryConfigured()) return false;
  const clean = (text: string) => text.trim().slice(0, MAX_TEXT);
  const user = clean(userText);
  const assistant = clean(assistantText);
  if (!user && !assistant) return false;

  try {
    const key = threadMemoryKey(ref);
    const previous = parseHash(
      await redisCommand<Record<string, unknown> | null>(["HGETALL", key]).catch(() => null),
    );

    const incoming: HistoryMessage[] = [
      ...(user ? [{ role: "user" as const, content: user }] : []),
      ...(assistant ? [{ role: "assistant" as const, content: assistant }] : []),
    ];
    const all = [...previous.turns, ...incoming];
    const overflow = all.length > WINDOW_MESSAGES ? all.slice(0, all.length - WINDOW_MESSAGES) : [];
    const evidence = overflow.length > 0 ? all.slice(-WINDOW_MESSAGES) : all;
    const summary = rollUpSummary(previous.summary, overflow);
    const title = previous.title ?? deriveTitle(user);

    const fields: (string | number)[] = [
      FIELDS.evidence,
      JSON.stringify(evidence),
      FIELDS.activeAt,
      new Date().toISOString(),
    ];
    if (summary) fields.push(FIELDS.summary, summary);
    if (title) fields.push(FIELDS.title, title);

    const results = await redisPipeline([
      ["HSET", key, ...fields],
      ["EXPIRE", key, String(THREAD_TTL_SECONDS)],
    ]);
    return results[0] !== null;
  } catch (error) {
    console.warn("[memory] no se pudo guardar el turno:", error instanceof Error ? error.message : error);
    return false;
  }
}

