/**
 * Una actualización de Telegram, una sola vez.
 *
 * Telegram reintenta la entrega cuando el webhook tarda más de lo que tarda en
 * contestar o cuando la respuesta parece un fallo. Sin memoria entre
 * invocaciones, cada reintento se procesaba otra vez: el usuario recibía la
 * misma respuesta dos veces, se gastaba dos veces la cuota del modelo y, ahora
 * que el hilo tiene memoria, el turno se guardaba duplicado.
 *
 * El `update_id` es el identificador que pone Telegram y no se repite, así que
 * sirve de clave natural. Se reserva con `SET … NX` ANTES de procesar: si dos
 * reintentos llegan a la vez, sólo uno gana la reserva. La reserva caduca sola
 * para no llenar Redis con el histórico de Telegram.
 *
 * Sin Redis, la reserva se pide a Postgres (`telegram_update_reservations`,
 * ver `update-dedupe-supabase.ts`): producción lleva tiempo sin Upstash y los
 * reintentos seguían duplicando respuesta, modelo y turno. Con Redis presente
 * el camino no cambia: es el que tiene la clave ya caliente.
 *
 * Si no hay ni Redis ni forma de reservar, o el almacén falla, se procesa
 * igual. Es preferible contestar dos veces a dejar a alguien sin respuesta: la
 * deduplicación es una mejora, no un requisito para que el bot hable.
 */

import { isRedisConfigured, redisCommand, scopedKey } from "./redis.js";
import { claimUpdateInSupabase } from "./update-dedupe-supabase.js";

/**
 * Ventana de la reserva: 10 minutos.
 *
 * Corta a propósito. El reintento que importa llega en segundos o en un par de
 * minutos, mientras la primera entrega sigue en vuelo; para entonces la clave
 * está viva y el reintento se descarta. Veinticuatro horas no evitaban ningún
 * duplicado más y dejaban una clave por mensaje durante un día entero en un
 * Redis que también guarda caché y avisos.
 */
export const UPDATE_TTL_SECONDS = 600;

const UPDATE_KEY_PREFIX = "aitor:tg:update:";

/** Clave del update, ya con el prefijo del entorno si es una preview. */
export function updateKey(updateId: number): string {
  return scopedKey(`${UPDATE_KEY_PREFIX}${updateId}`);
}

/**
 * `true` = adelante, procesa la actualización. `false` = ya se procesó.
 *
 * Nunca lanza: un fallo de Redis no puede tumbar el webhook.
 */
export async function claimUpdate(
  updateId: number,
  ttlSeconds: number = UPDATE_TTL_SECONDS,
): Promise<boolean> {
  if (!Number.isInteger(updateId) || updateId <= 0) return true;

  if (!isRedisConfigured()) {
    // Respaldo: la misma clave natural y la misma ventana, en Postgres. `null`
    // significa que tampoco hay Supabase con el que decidir.
    const claimedInSupabase = await claimUpdateInSupabase(updateId, ttlSeconds);
    if (claimedInSupabase !== null) return claimedInSupabase;
    console.warn("[telegram] sin Redis ni reserva en Supabase: se procesa igual");
    return true;
  }

  try {
    const reply = await redisCommand<string | null>([
      "SET",
      updateKey(updateId),
      "1",
      "NX",
      "EX",
      String(ttlSeconds),
    ]);
    return reply === "OK";
  } catch (error) {
    console.warn(
      "[telegram] no se pudo deduplicar el update:",
      error instanceof Error ? error.message : error,
    );
    return true;
  }
}
