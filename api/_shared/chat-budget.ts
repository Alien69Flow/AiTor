/**
 * Tope de gasto por chat y por día.
 *
 * Lo caro del bot es el turno del modelo (la función `chat` de Supabase llama a
 * Gemini). Un chat insistente podía gastar la cuota sin techo: cada mensaje era
 * una llamada más. Esto cuenta los turnos por chat y día UTC, y a partir del
 * tope contesta sin llamar al modelo.
 *
 * El contador vive en Redis (`INCR` + `EXPIRE`) para ser exacto entre invocaciones.
 * Si no hay Redis, se cuenta en memoria del proceso: el tope sigue existiendo,
 * pero por instancia, así que se dice en `/estado` y aquí (`storage: "memory"`)
 * en vez de fingir que es exacto.
 *
 * La clave no lleva el chat_id: se guarda el hash, como en las alertas.
 */

import { createHash } from "node:crypto";
import { isRedisConfigured, redisCommand, scopedKey } from "./redis.js";

/** Tope por defecto: 40 turnos al día y chat. Configurable sin desplegar. */
export const DEFAULT_DAILY_LIMIT = 40;
/** Dos días de margen: la clave del día caduca sola aunque el INCR no acierte. */
export const BUDGET_TTL_SECONDS = 60 * 60 * 48;

export type BudgetStorage = "redis" | "memory";

export interface BudgetDecision {
  allowed: boolean;
  used: number;
  limit: number;
  /** Cuándo vuelve a cero el contador (medianoche UTC siguiente). */
  resetAt: string;
  /** Dónde se contó: Redis (exacto), memoria (por instancia) o nada. */
  storage: BudgetStorage;
}

/** Contador por instancia: sólo si no hay Redis. Se pierde al reciclarse. */
const memory = new Map<string, number>();

/** Para los tests: deja el contador de memoria como recién arrancado. */
export function __resetBudgetForTest(): void {
  memory.clear();
}

/** `CHAT_DAILY_TURN_LIMIT`, si es un entero positivo; si no, el de por defecto. */
export function dailyLimit(raw: string | undefined = process.env.CHAT_DAILY_TURN_LIMIT): number {
  const parsed = Number.parseInt((raw ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_LIMIT;
}

/** Día del tope: UTC, para que el reinicio no dependa del proceso. */
export function budgetDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function budgetResetAt(now: Date = new Date()): string {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return next.toISOString();
}

/** Clave del contador: día + hash del chat, nunca el id en claro. */
export function budgetKey(chatId: number | string, day: string): string {
  const hash = createHash("sha256").update(String(chatId)).digest("hex").slice(0, 16);
  return scopedKey(`aitor:budget:${day}:${hash}`);
}

function decide(used: number, limit: number, storage: BudgetStorage, now: Date): BudgetDecision {
  return { allowed: used <= limit, used, limit, resetAt: budgetResetAt(now), storage };
}

function countInMemory(chatId: number | string, day: string): number {
  // El día va dentro de la clave: no hace falta volver a comprobarlo aquí.
  const key = budgetKey(chatId, day);
  const used = (memory.get(key) ?? 0) + 1;
  memory.set(key, used);
  return used;
}

/**
 * Suma un turno y dice si se puede llamar al modelo.
 *
 * Se cuenta el intento, no el éxito: una llamada que falla a mitad también pudo
 * costar. Sin Redis el contador es de la instancia, y `storage: "memory"` lo
 * dice en `/estado` en vez de fingir exactitud.
 */
export async function takeTurn(
  chatId: number | string,
  { now = new Date(), limit = dailyLimit() }: { now?: Date; limit?: number } = {},
): Promise<BudgetDecision> {
  const day = budgetDay(now);

  if (isRedisConfigured()) {
    const key = budgetKey(chatId, day);
    try {
      const used = Number(await redisCommand<number>(["INCR", key]));
      if (used === 1) await redisCommand(["EXPIRE", key, String(BUDGET_TTL_SECONDS)]);
      return decide(used, limit, "redis", now);
    } catch (error) {
      console.warn(
        "[budget] Redis no respondió, se cuenta por instancia:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  // Sin Redis (o con Redis caído) el contador es del proceso, no del chat: útil
  // para frenar una ráfaga, insuficiente como garantía. Se dice con
  // `storage: "memory"` en vez de dejar pasar todo o fingir exactitud.
  return decide(countInMemory(chatId, day), limit, "memory", now);
}

/** Lo usado hoy, sin sumar (para `/estado`). */
export async function peekBudget(
  chatId: number | string,
  { now = new Date(), limit = dailyLimit() }: { now?: Date; limit?: number } = {},
): Promise<{ used: number; limit: number; storage: BudgetStorage }> {
  const day = budgetDay(now);
  if (isRedisConfigured()) {
    try {
      const raw = await redisCommand<number | null>(["GET", budgetKey(chatId, day)]);
      return { used: Number(raw ?? 0) || 0, limit, storage: "redis" };
    } catch {
      /* cae a memoria */
    }
  }
  return { used: memory.get(budgetKey(chatId, day)) ?? 0, limit, storage: "memory" };
}

/** El aviso cuando el chat ya gastó lo suyo. No llama al modelo. */
export function formatBudgetExceeded(decision: BudgetDecision): string {
  const reset = decision.resetAt.slice(11, 16);
  // El contador sigue subiendo si se insiste; al usuario se le enseña el tope,
  // no un «2 de 1» que parece un error.
  const shown = Math.min(decision.used, decision.limit);
  return [
    `⏳ <b>Tope diario alcanzado</b>`,
    "",
    `Has usado ${shown} de ${decision.limit} respuestas hoy en este chat.`,
    `El contador vuelve a cero a las <b>${reset} UTC</b>.`,
    "",
    "Sigo aquí para lo que no gasta modelo: <code>/senal</code>, <code>/estado</code>, <code>/alerta</code>.",
  ].join("\n");
}
