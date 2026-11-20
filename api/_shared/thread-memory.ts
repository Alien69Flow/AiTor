/**
 * Memoria del hilo en Postgres, leída por PostgREST desde Vercel.
 *
 * Por qué no Redis: el despliegue no tiene Upstash (`GET /api/health` responde
 * `UNCONFIGURED`), así que una memoria en Redis sería código que nunca se
 * ejecuta. Las tablas `chat_threads` / `chat_turns` ya existen para las dos
 * superficies (migración `20261118190000_chat_memory.sql`).
 *
 * Por qué no la función `chat-thread`: servirla exige `supabase functions
 * deploy` y nunca llegó a desplegarse (404). Hablando con PostgREST no hay que
 * desplegar nada: sólo aplicar la migración y dar la service key al webhook.
 *
 * Requisitos de despliegue (una vez):
 *  - migración aplicada (SQL Editor del panel; no hace falta la CLI),
 *  - `SUPABASE_SERVICE_ROLE_KEY` en Vercel. Sin ella esto devuelve hilo vacío:
 *    el chat sigue funcionando, pero sin memoria.
 *
 * Identidad: el hilo es un token opaco (`tg_…` / `web_…`, 128 bits) que aporta
 * el llamante; el `chat_id` no se guarda. Nada de esto puede tumbar el chat:
 * cualquier fallo devuelve vacío o `false`, nunca lanza.
 */

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
  summary: string | null;
  lastActiveAt: string | null;
  /** En orden cronológico, listos para el prompt. */
  turns: HistoryMessage[];
}

/** 32 hex = 128 bits: no se puede enumerar y no guarda el chat_id. */
const THREAD_TOKEN = /^(tg|web)_[0-9a-f]{32}$/;
const PREFIX: Record<ThreadSurface, string> = { telegram: "tg_", web: "web_" };

/** Cuatro intercambios: ocho mensajes, ~1.500 tokens con el turno nuevo. */
export const WINDOW_MESSAGES = 8;
/** Un hilo parado más de esto no arrastra turnos crudos, sólo el resumen. */
export const STALE_HOURS = 6;
/** El mismo tope que la tabla, para no provocar un check constraint. */
const MAX_TEXT = 8000;
const TIMEOUT_MS = 3_000;
/** Proyecto de AiTor: el webhook ya lo usa como último recurso. */
const DEFAULT_URL = "https://wkdtvrxavkhbifjtvvdw.supabase.co";

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

/**
 * Configuración del almacén. `SUPABASE_SERVICE_ROLE_KEY` es lo único que el
 * despliegue tiene que añadir además de aplicar la migración: sin ella no se
 * hace ninguna petición y el bot contesta como antes.
 */
function memoryConfig(): { url: string; serviceKey: string } | null {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_URL)
    .trim()
    .replace(/\/+$/, "");
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !serviceKey) return null;
  return { url, serviceKey };
}

export function memoryConfigured(): boolean {
  return memoryConfig() !== null;
}

function rest(
  config: { url: string; serviceKey: string },
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/** Un hilo sin hablar en `STALE_HOURS` no arrastra turnos crudos. */
export function isStale(lastActiveAt: string | null, now = Date.now()): boolean {
  if (!lastActiveAt) return false;
  const at = Date.parse(lastActiveAt);
  if (!Number.isFinite(at)) return false;
  return now - at > STALE_HOURS * 3_600_000;
}

/**
 * Lo que se le pasa al modelo sobre el hilo: el resumen (si lo hay) y los
 * turnos que toquen. Devuelve `[]` si no hay nada, para que el llamante no
 * tenga que distinguir "hilo vacío" de "sin memoria".
 */
export function historyMessages(
  thread: LoadedThread | null,
  now = Date.now(),
): HistoryMessage[] {
  if (!thread) return [];
  const messages: HistoryMessage[] = [];

  if (thread.summary) {
    messages.push({
      role: "user",
      content: `[MEMORIA DEL HILO — resumen de lo hablado antes, no es un mensaje nuevo]\n${thread.summary}`,
    });
    messages.push({
      role: "assistant",
      content: "Entendido: tengo en cuenta ese contexto previo.",
    });
  }

  const turns = isStale(thread.lastActiveAt, now) ? [] : thread.turns;
  for (const turn of turns) messages.push(turn);
  return messages;
}

function usableTurn(raw: unknown): raw is HistoryMessage {
  const turn = raw as { role?: unknown; content?: unknown };
  return (
    (turn?.role === "user" || turn?.role === "assistant") &&
    typeof turn.content === "string" &&
    turn.content.length > 0
  );
}

/**
 * Carga la cabecera del hilo y sus últimos mensajes. PostgREST devuelve los
 * últimos `WINDOW_MESSAGES` en orden descendente; aquí se invierten para que
 * el prompt los vea como una conversación.
 */
export async function loadThread(ref: ThreadRef): Promise<LoadedThread | null> {
  const config = memoryConfig();
  if (!config) return null;
  try {
    const head = await rest(
      config,
      `chat_threads?surface=eq.${encodeURIComponent(ref.surface)}&external_id=eq.${encodeURIComponent(ref.externalId)}&select=id,summary,last_active_at`,
    );
    if (!head.ok) {
      console.warn(`[memory] chat_threads respondió HTTP ${head.status}`);
      return null;
    }
    const rows = (await head.json()) as Array<{
      id: string;
      summary: string | null;
      last_active_at: string | null;
    }>;
    const found = rows[0];
    if (!found) return { summary: null, lastActiveAt: null, turns: [] };

    const tails = await rest(
      config,
      `chat_turns?thread_id=eq.${encodeURIComponent(found.id)}&select=role,content&order=id.desc&limit=${WINDOW_MESSAGES}`,
    );
    if (!tails.ok) {
      console.warn(`[memory] chat_turns respondió HTTP ${tails.status}`);
      return { summary: found.summary, lastActiveAt: found.last_active_at, turns: [] };
    }
    const recent = (await tails.json()) as unknown[];
    return {
      summary: found.summary,
      lastActiveAt: found.last_active_at,
      turns: recent.filter(usableTurn).slice().reverse(),
    };
  } catch {
    return null;
  }
}

/**
 * Guarda un turno completo (lo que dijo el usuario y lo que contestó el bot).
 * El upsert mueve `last_active_at`, que es lo que marca el TTL de contexto.
 * Devuelve `false` si no se pudo guardar; nunca lanza.
 */
export async function saveTurn(
  ref: ThreadRef,
  userText: string,
  assistantText: string,
): Promise<boolean> {
  const config = memoryConfig();
  if (!config) return false;
  const clean = (text: string) => text.trim().slice(0, MAX_TEXT);
  const user = clean(userText);
  const assistant = clean(assistantText);
  if (!user && !assistant) return false;

  try {
    const upsert = await rest(config, "chat_threads?on_conflict=surface,external_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([
        {
          surface: ref.surface,
          external_id: ref.externalId,
          last_active_at: new Date().toISOString(),
        },
      ]),
    });
    if (!upsert.ok) {
      console.warn(`[memory] no se pudo dar de alta el hilo: HTTP ${upsert.status}`);
      return false;
    }
    const rows = (await upsert.json()) as Array<{ id?: string }>;
    const threadId = rows[0]?.id;
    if (!threadId) return false;

    const inserted = await rest(config, "chat_turns", {
      method: "POST",
      body: JSON.stringify([
        ...(user ? [{ thread_id: threadId, role: "user", content: user }] : []),
        ...(assistant ? [{ thread_id: threadId, role: "assistant", content: assistant }] : []),
      ]),
    });
    if (!inserted.ok) {
      console.warn(`[memory] no se pudo guardar el turno: HTTP ${inserted.status}`);
      return false;
    }
    return true;
  } catch {
    // La memoria es un extra: se pierde el turno, no la respuesta.
    return false;
  }
}
