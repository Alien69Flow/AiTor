/**
 * La reserva de `update_id` cuando Redis no está: Postgres como respaldo.
 *
 * Sin Redis, `claimUpdate` dejaba pasar todos los reintentos de Telegram: la
 * misma respuesta dos veces, dos cobros al modelo y el turno del hilo
 * duplicado. Supabase ya está en el camino del bot (la función `chat`), así que
 * sirve de almacén sin añadir un servicio nuevo.
 *
 * La reserva vive en `public.telegram_update_reservations` y se pide con
 * `reserve_telegram_update(...)`, una función `security definer` que hace el
 * INSERT y la toma de una reserva caducada en un solo viaje: dos reintentos
 * simultáneos no pueden ganar los dos.
 *
 * Por qué service role y no la anon: escribir aquí decide qué mensajes se
 * contestan. Con la anon pública del bundle, cualquiera podría reservar
 * updates ajenos y dejar al bot mudo para esos mensajes.
 *
 * Tres respuestas posibles, y la diferencia importa:
 *  · `true`  → adelante, la entrega es nueva.
 *  · `false` → ya la tiene otra entrega: se descarta el reintento.
 *  · `null`  → no hay con qué decidir (sin configurar o Supabase caído). El que
 *              llama debe procesar: es preferible contestar dos veces a dejar a
 *              alguien sin respuesta.
 */

const RPC_PATH = "/rest/v1/rpc/reserve_telegram_update";

/**
 * Techo para no convertir el dedupe en una espera. Si Supabase tarda más, se
 * procesa igual: la reserva es una mejora, no un requisito para hablar.
 */
export const RESERVATION_TIMEOUT_MS = 2_500;

/** URL del proyecto de Supabase, sin barra final. Misma elección que el webhook. */
export function reservationUrl(env: Record<string, string | undefined>): string {
  return (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
}

/** La clave con la que se puede escribir. Sin ella no hay respaldo. */
export function reservationKey(env: Record<string, string | undefined>): string {
  return (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

/** `true` sólo con las dos cosas: URL y service role. Ni la URL ni la clave salen de aquí. */
export function isSupabaseDedupeConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(reservationUrl(env) && reservationKey(env));
}

async function reserve(
  updateId: number,
  ttlSeconds: number,
  env: Record<string, string | undefined>,
): Promise<boolean | null> {
  const url = reservationUrl(env);
  const key = reservationKey(env);
  if (!url || !key) return null;

  try {
    const response = await fetch(`${url}${RPC_PATH}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_update_id: updateId, p_ttl_seconds: ttlSeconds }),
      signal: AbortSignal.timeout(RESERVATION_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(`[telegram] la reserva en Supabase respondió ${response.status}: se procesa igual`);
      return null;
    }
    const claimed: unknown = await response.json();
    // La RPC devuelve `boolean`; cualquier otra cosa no es una respuesta válida.
    return typeof claimed === "boolean" ? claimed : null;
  } catch (error) {
    console.warn(
      "[telegram] no se pudo reservar el update en Supabase:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Reserva la entrega en Postgres. Nunca lanza.
 *
 * `null` no es un fallo del update: es la señal de que este respaldo no puede
 * decidir y el llamante tiene que seguir su camino.
 */
export async function claimUpdateInSupabase(
  updateId: number,
  ttlSeconds: number,
  env: Record<string, string | undefined> = process.env,
): Promise<boolean | null> {
  if (!Number.isInteger(updateId) || updateId <= 0) return null;
  return reserve(updateId, ttlSeconds, env);
}
