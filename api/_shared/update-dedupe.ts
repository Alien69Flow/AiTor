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
 * Si Redis no está configurado o falla, se procesa igual. Es preferible
 * contestar dos veces a dejar a alguien sin respuesta: la deduplicación es una
 * mejora, no un requisito para que el bot hable.
 */

import { isRedisConfigured, redisCommand, scopedKey } from "./redis.js";

/** Telegram reintenta durante horas; 24 h cubre cualquier reintento real. */
export const UPDATE_TTL_SECONDS = 86_400;

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
    console.warn("[telegram] sin Redis no se deduplican los updates: se procesa igual");
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
