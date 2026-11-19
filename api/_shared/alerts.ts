/**
 * Alertas de precio: lógica y almacén.
 *
 * Por qué Redis y no Postgres: una alerta es un aviso temporal, no memoria del
 * usuario. Caduca sola y no necesita RLS ni migración; además el cron corre en
 * Vercel, donde ya está el cliente de Redis.
 *
 * Almacén: **un solo hash**, `aitor:alerts`, con el token del hilo como campo
 * y el JSON de sus alertas como valor. Un SCAN por prefijo habría necesitado
 * el prefijo de preview; un hash se lee entero con `HGETALL` y no hay claves
 * sueltas que se queden huérfanas.
 *
 * El campo es el token opaco del hilo, así que la clave no lleva el chat_id.
 * El valor sí lo lleva: sin él no hay a quién avisar. Es la única pieza del
 * proyecto que guarda el id del chat, y se dice aquí para que no sorprenda.
 */

import { isRedisConfigured, redisCommand } from "./redis.js";

export type AlertDirection = "above" | "below";

export interface Alert {
  chatId: number;
  symbol: string;
  direction: AlertDirection;
  price: number;
  createdAt: string;
}

/** Un chat no debería poder llenar Redis de avisos. */
export const MAX_ALERTS_PER_CHAT = 10;
/** Un mes: el aviso no es eterno. */
export const ALERTS_TTL_SECONDS = 30 * 24 * 3_600;
const ALERTS_KEY = "aitor:alerts";

/** Símbolos con id en CoinGecko. Sin id no hay precio, y sin precio no hay aviso. */
export const SYMBOL_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  LINK: "chainlink",
  ADA: "cardano",
  DOT: "polkadot",
};

/**
 * El precio admite `95000`, `95,000` y `95k`. Devuelve `null` si no es un
 * número positivo: una alerta con precio 0 dispararía siempre.
 */
export function parsePrice(raw: string): number | null {
  const cleaned = raw.trim().toLowerCase().replace(/,/g, "");
  const match = /^(\d+(?:\.\d+)?)(k)?$/.exec(cleaned);
  if (!match) return null;
  const value = Number(match[1]) * (match[2] ? 1_000 : 1);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

/**
 * `/alerta BTC > 95000` → `{ symbol, direction, price }`.
 * Cualquier otra forma devuelve `null`: mejor no crear nada que crear una
 * alerta que no se entiende.
 */
export function parseAlertCommand(text: string): { symbol: string; direction: AlertDirection; price: number } | null {
  const body = text.replace(/^\/alerta(@\w+)?/i, "").trim();
  // Se admite `>` y `>=`, `<` y `<=`: para un aviso, llegar al número ya cuenta.
  const match = /^([a-z]{2,10})\s*(>=|<=|>|<)\s*([0-9.,]+k?)$/i.exec(body);
  if (!match) return null;
  const symbol = match[1].toUpperCase();
  if (!SYMBOL_IDS[symbol]) return null;
  const price = parsePrice(match[3]);
  if (price === null) return null;
  const direction: AlertDirection = match[2].startsWith(">") ? "above" : "below";
  return { symbol, direction, price };
}

/** `true` cuando el precio de ahora cruza lo pedido. */
export function isDue(alert: Pick<Alert, "direction" | "price">, current: number | null): boolean {
  if (current === null || !Number.isFinite(current)) return false;
  return alert.direction === "above" ? current >= alert.price : current <= alert.price;
}

/** Las que toca avisar ahora, en el orden en que se crearon. */
export function dueAlerts(alerts: Alert[], prices: Record<string, number | null>): Alert[] {
  return alerts.filter((alert) => isDue(alert, prices[alert.symbol] ?? null));
}

/** Texto del aviso. Sin adornos: símbolo, dirección y precio. */
export function formatAlert(alert: Alert, current: number): string {
  const arrow = alert.direction === "above" ? "≥" : "≤";
  return `🔔 ${alert.symbol} está en $${current.toLocaleString("es-ES")} (aviso: ${arrow} $${alert.price.toLocaleString("es-ES")}).`;
}

/** Descarta lo que no tenga forma de alerta: Redis no es de fiar. */
export function sanitizeAlerts(stored: unknown): Alert[] {
  if (!Array.isArray(stored)) return [];
  return stored.filter((item): item is Alert => {
    const alert = item as Partial<Alert>;
    return (
      typeof alert.chatId === "number" &&
      typeof alert.symbol === "string" &&
      Boolean(SYMBOL_IDS[alert.symbol]) &&
      (alert.direction === "above" || alert.direction === "below") &&
      typeof alert.price === "number" &&
      alert.price > 0
    );
  });
}

export async function loadAlerts(threadToken: string): Promise<Alert[]> {
  if (!isRedisConfigured()) return [];
  try {
    const raw = await redisCommand<string | null>(["HGET", ALERTS_KEY, threadToken]);
    return raw ? sanitizeAlerts(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

/** Guarda (o vacía) las alertas de un chat. Devuelve `false` si Redis falló. */
export async function saveAlerts(threadToken: string, alerts: Alert[]): Promise<boolean> {
  if (!isRedisConfigured()) return false;
  try {
    if (alerts.length === 0) {
      await redisCommand(["HDEL", ALERTS_KEY, threadToken]);
    } else {
      await redisCommand(["HSET", ALERTS_KEY, threadToken, JSON.stringify(alerts)]);
      await redisCommand(["EXPIRE", ALERTS_KEY, String(ALERTS_TTL_SECONDS)]);
    }
    return true;
  } catch {
    return false;
  }
}

/** Todas las alertas de todos los chats, para el cron. */
export async function allAlerts(): Promise<Array<{ token: string; alerts: Alert[] }>> {
  if (!isRedisConfigured()) return [];
  try {
    const flat = await redisCommand<string[] | null>(["HGETALL", ALERTS_KEY]);
    if (!Array.isArray(flat)) return [];
    const entries: Array<{ token: string; alerts: Alert[] }> = [];
    for (let index = 0; index + 1 < flat.length; index += 2) {
      const token = flat[index];
      const alerts = sanitizeAlerts(JSON.parse(flat[index + 1]));
      if (token && alerts.length > 0) entries.push({ token, alerts });
    }
    return entries;
  } catch {
    return [];
  }
}

/** Añade una alerta respetando el tope. */
export async function addAlert(
  threadToken: string,
  alert: Alert,
): Promise<{ ok: true; total: number } | { ok: false; reason: "sin-redis" | "demasiadas" }> {
  if (!isRedisConfigured()) return { ok: false, reason: "sin-redis" };
  const alerts = await loadAlerts(threadToken);
  if (alerts.length >= MAX_ALERTS_PER_CHAT) return { ok: false, reason: "demasiadas" };
  const saved = await saveAlerts(threadToken, [...alerts, alert]);
  return saved ? { ok: true, total: alerts.length + 1 } : { ok: false, reason: "sin-redis" };
}
