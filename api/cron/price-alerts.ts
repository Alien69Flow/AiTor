/**
 * `GET /api/cron/price-alerts` — el primer loop de la fase 5.
 *
 * Los loops del roadmap (`backend/workflows/marketLoops.ts`) viven en un Express
 * que no está desplegado. Este corre de verdad: Vercel lo llama por horario (ver
 * `crons` en `vercel.json`) o cualquiera con el secreto, a mano.
 *
 * Qué hace: lee todas las alertas, pide precios, y avisa por Telegram de las que
 * se cruzaron. Las disparadas se borran: una alerta de precio es de un solo uso.
 *
 * Reglas:
 *  - Sin secreto no contesta (401). Sin Redis o sin precios devuelve 200 con el
 *    motivo: un cron que falla en silencio es peor que uno que no hace nada.
 *  - Los precios vienen de CoinGecko, que no pide clave. Si la fuente falla, no
 *    se inventan cifras ni se disparan alertas a ciegas.
 *  - El aviso es el mismo `sendMessage` del bot, así que el usuario lo recibe
 *    donde ya habla con él.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { timingSafeEqual } from "crypto";
import { allAlerts, dueAlerts, formatAlert, saveAlerts, SYMBOL_IDS, type Alert } from "../_shared/alerts.js";
import { isRedisConfigured } from "../_shared/redis.js";

export const maxDuration = 30;

const PRICE_URL = "https://api.coingecko.com/api/v3/simple/price";
const PRICE_TIMEOUT_MS = 12_000;

function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function authorized(req: VercelRequest): boolean {
  const expected = process.env.CRON_SECRET || process.env.OPERATOR_KEY || "";
  if (!expected) return false;
  const header = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const provided = header || String(req.headers["x-api-key"] || "");
  return Boolean(provided) && sameSecret(provided, expected);
}

/** Precio en USD por símbolo. `null` cuando la fuente no lo dio. */
async function fetchPrices(symbols: string[]): Promise<Record<string, number | null> | null> {
  const ids = [...new Set(symbols.map((symbol) => SYMBOL_IDS[symbol]).filter(Boolean))];
  if (ids.length === 0) return {};
  try {
    const url = `${PRICE_URL}?ids=${ids.join(",")}&vs_currencies=usd`;
    const response = await fetch(url, {
      headers: { "User-Agent": "aitor-api/1.0 (price-alerts)" },
      signal: AbortSignal.timeout(PRICE_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error("[alerts] CoinGecko respondió", response.status);
      return null;
    }
    const data = (await response.json()) as Record<string, { usd?: number }>;
    const prices: Record<string, number | null> = {};
    for (const symbol of symbols) {
      const id = SYMBOL_IDS[symbol];
      const value = id ? data?.[id]?.usd : undefined;
      prices[symbol] = typeof value === "number" && Number.isFinite(value) ? value : null;
    }
    return prices;
  } catch (error) {
    console.error("[alerts] la fuente de precios no respondió", error);
    return null;
  }
}

async function notify(chatId: number, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  if (!token) return false;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(PRICE_TIMEOUT_MS),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[alerts] Telegram rechazó el aviso", response.status, detail.slice(0, 200));
    }
    return response.ok;
  } catch (error) {
    console.error("[alerts] aviso sin respuesta", error);
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  if (!authorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!isRedisConfigured()) {
    return res.status(200).json({ ok: true, checked: 0, reason: "sin-redis" });
  }

  const chats = await allAlerts();
  const pending = chats.reduce((total, entry) => total + entry.alerts.length, 0);
  if (pending === 0) {
    return res.status(200).json({ ok: true, checked: 0, fired: 0 });
  }

  const symbols = [...new Set(chats.flatMap((entry) => entry.alerts.map((alert) => alert.symbol)))];
  const prices = await fetchPrices(symbols);
  if (!prices) {
    // Un cron que no puede leer precios no debe borrar ni disparar nada.
    return res.status(200).json({ ok: true, checked: pending, fired: 0, reason: "sin-precios" });
  }

  let fired = 0;
  let delivered = 0;
  for (const entry of chats) {
    const due = dueAlerts(entry.alerts, prices);
    if (due.length === 0) continue;

    const sent: Alert[] = [];
    for (const alert of due) {
      const current = prices[alert.symbol];
      if (current === null || current === undefined) continue;
      if (await notify(alert.chatId, formatAlert(alert, current))) {
        sent.push(alert);
        delivered += 1;
      }
    }
    fired += sent.length;
    if (sent.length > 0) {
      const remaining = entry.alerts.filter((alert) => !sent.includes(alert));
      await saveAlerts(entry.token, remaining);
    }
  }

  return res.status(200).json({ ok: true, checked: pending, fired, delivered, symbols });
}
