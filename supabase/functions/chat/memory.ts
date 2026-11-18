/**
 * Memoria entre sesiones del chat.
 *
 * El camino de Telegram no recordaba nada: cada mensaje viajaba como un
 * `messages` de un solo elemento. Esto da hilo por superficie con una ventana
 * corta y un resumen rodante, que es lo minimo que cambia la conversacion sin
 * disparar el coste en tokens.
 *
 * Reglas:
 *  - Ventana: los ultimos `WINDOW_TURNS` turnos (8 mensajes como mucho).
 *  - TTL de contexto: si el hilo lleva mas de `STALE_HOURS` parado, no se
 *    inyectan turnos crudos, solo el resumen. Un mensaje de hace una semana no
 *    debe arrastrar la conversacion de entonces.
 *  - Al pasar de `SUMMARIZE_AFTER` turnos se resumen los antiguos y se borran,
 *    para que el TTL de 30 dias sea de verdad.
 *
 * Nada de esto puede tumbar el chat: todas las funciones devuelven `null` (o
 * no hacen nada) cuando Postgres o la red fallan.
 */

export type Surface = "telegram" | "web";

export interface ThreadRef {
  surface: Surface;
  /** `chat_id` de Telegram o `user_id` de la web. */
  externalId: string;
}

export interface ThreadTurn {
  id: number;
  role: "user" | "assistant";
  content: string;
}

export interface LoadedThread {
  threadId: string | null;
  summary: string | null;
  lastActiveAt: string | null;
  /** En orden cronologico, preparados para el prompt. */
  turns: ThreadTurn[];
}

export interface MemoryConfig {
  url: string;
  serviceKey: string;
  fetchImpl: typeof fetch;
}

/** Turnos que se inyectan siempre. Ocho mensajes: ~1.500 tokens con resumen. */
export const WINDOW_TURNS = 4;
/** Por encima de esto se resume y se borra lo resumido. */
export const SUMMARIZE_AFTER = 12;
/** Turnos que sobreviven al resumen: la conversacion de ahora mismo. */
export const SUMMARIZE_KEEP = 4;
/** El resumen es un dato, no un ensayo. */
export const SUMMARY_MAX_CHARS = 600;
/** Un hilo mas viejo que esto se contesta con el resumen, sin turnos crudos. */
export const STALE_HOURS = 6;

/**
 * Lee la configuracion de las variables que Supabase inyecta en cada Edge
 * Function. Devolver `null` (en vez de lanzar) deja el chat funcionando sin
 * memoria en cualquier despliegue donde falte la clave.
 */
export function memoryConfig(overrides: Partial<MemoryConfig> = {}): MemoryConfig | null {
  const env = (name: string): string => {
    const deno = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno;
    return (deno?.env?.get?.(name) ?? "").trim();
  };
  const url = (overrides.url ?? env("SUPABASE_URL")).replace(/\/+$/, "");
  const serviceKey = overrides.serviceKey ?? env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return null;
  return { url, serviceKey, fetchImpl: overrides.fetchImpl ?? fetch };
}

function rest(config: MemoryConfig, path: string, init: RequestInit = {}): Promise<Response> {
  return config.fetchImpl(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
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
 * tenga que distinguir "hilo vacio" de "sin memoria".
 */
export function historyMessages(
  thread: LoadedThread | null,
  now = Date.now(),
): Array<{ role: "user" | "assistant"; content: string }> {
  if (!thread) return [];
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

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
  for (const turn of turns) {
    messages.push({ role: turn.role, content: turn.content });
  }
  return messages;
}

/** Carga del hilo: la cabecera y, si esta vivo, los ultimos turnos. */
export async function loadThread(
  ref: ThreadRef,
  config: MemoryConfig | null = memoryConfig(),
): Promise<LoadedThread | null> {
  if (!config) return null;
  try {
    const head = await rest(
      config,
      `chat_threads?surface=eq.${encodeURIComponent(ref.surface)}&external_id=eq.${encodeURIComponent(ref.externalId)}&select=id,summary,summary_upto,last_active_at`,
    );
    if (!head.ok) return null;
    const rows = (await head.json()) as Array<{
      id: string;
      summary: string | null;
      last_active_at: string | null;
    }>;
    const found = rows[0];
    if (!found) return { threadId: null, summary: null, lastActiveAt: null, turns: [] };

    const tails = await rest(
      config,
      `chat_turns?thread_id=eq.${found.id}&select=id,role,content&order=id.desc&limit=${WINDOW_TURNS}`,
    );
    if (!tails.ok) {
      return { threadId: found.id, summary: found.summary, lastActiveAt: found.last_active_at, turns: [] };
    }
    const recent = (await tails.json()) as ThreadTurn[];
    return {
      threadId: found.id,
      summary: found.summary,
      lastActiveAt: found.last_active_at,
      turns: recent.slice().reverse(),
    };
  } catch {
    return null;
  }
}

/** Alta del hilo si es la primera vez. Devuelve su id o `null`. */
export async function ensureThread(
  ref: ThreadRef,
  config: MemoryConfig | null = memoryConfig(),
): Promise<string | null> {
  if (!config) return null;
  try {
    const response = await rest(config, "chat_threads?on_conflict=surface,external_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([
        { surface: ref.surface, external_id: ref.externalId, last_active_at: new Date().toISOString() },
      ]),
    });
    if (!response.ok) return null;
    const rows = (await response.json()) as Array<{ id?: string }>;
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Guarda un turno completo (lo que dijo el usuario y lo que contesto el bot) y
 * mueve `last_active_at`. Si algo falla se pierde la memoria, no la respuesta.
 */
export async function appendTurn(
  ref: ThreadRef,
  userText: string,
  assistantText: string,
  config: MemoryConfig | null = memoryConfig(),
): Promise<string | null> {
  if (!config) return null;
  const threadId = await ensureThread(ref, config);
  if (!threadId) return null;
  const clean = (text: string) => text.trim().slice(0, 8000);
  const user = clean(userText);
  const assistant = clean(assistantText);
  if (!user && !assistant) return threadId;

  try {
    const rows = [
      ...(user ? [{ thread_id: threadId, role: "user", content: user }] : []),
      ...(assistant ? [{ thread_id: threadId, role: "assistant", content: assistant }] : []),
    ];
    const inserted = await rest(config, "chat_turns", {
      method: "POST",
      body: JSON.stringify(rows),
    });
    if (!inserted.ok) return threadId;
    await rest(config, `chat_threads?id=eq.${threadId}`, {
      method: "PATCH",
      body: JSON.stringify({ last_active_at: new Date().toISOString() }),
    });
  } catch {
    // La memoria es un extra: se pierde el turno, no la conversacion.
    return threadId;
  }
  return threadId;
}

/**
 * Si el hilo crecio demasiado, resume lo antiguo y lo borra.
 *
 * El resumen lo genera el llamante (la funcion `chat` ya tiene los modelos):
 * aqui solo se decide cuando, se guarda y se tira lo resumido. Devolver el
 * resumen nuevo y `null` cuando no tocaba.
 */
export async function summarizeIfNeeded(
  threadId: string,
  summarize: (previous: string | null, turns: ThreadTurn[]) => Promise<string | null>,
  config: MemoryConfig | null = memoryConfig(),
): Promise<string | null> {
  if (!config) return null;
  try {
    const all = await rest(
      config,
      `chat_turns?thread_id=eq.${threadId}&select=id,role,content&order=id.asc`,
    );
    if (!all.ok) return null;
    const turns = (await all.json()) as ThreadTurn[];
    if (turns.length <= SUMMARIZE_AFTER) return null;

    const head = await rest(config, `chat_threads?id=eq.${threadId}&select=summary`);
    const previous = head.ok ? ((await head.json()) as Array<{ summary: string | null }>)[0]?.summary ?? null : null;

    const cut = turns.length - SUMMARIZE_KEEP;
    const toSummarize = turns.slice(0, cut);
    const summary = (await summarize(previous, toSummarize))?.trim().slice(0, SUMMARY_MAX_CHARS) ?? null;
    if (!summary) return null;

    const lastId = toSummarize[toSummarize.length - 1].id;
    await rest(config, `chat_threads?id=eq.${threadId}`, {
      method: "PATCH",
      body: JSON.stringify({ summary, summary_upto: lastId }),
    });
    // Se borran los resumidos: si se quedaran, el TTL de 30 dias no seria real.
    await rest(config, `chat_turns?id=in.(${toSummarize.map((turn) => turn.id).join(",")})`, {
      method: "DELETE",
    });
    return summary;
  } catch {
    return null;
  }
}

/** Borra el hilo entero (comando /reset). */
export async function clearThread(
  ref: ThreadRef,
  config: MemoryConfig | null = memoryConfig(),
): Promise<boolean> {
  if (!config) return false;
  try {
    const response = await rest(
      config,
      `chat_threads?surface=eq.${encodeURIComponent(ref.surface)}&external_id=eq.${encodeURIComponent(ref.externalId)}`,
      { method: "DELETE" },
    );
    return response.ok;
  } catch {
    return false;
  }
}
