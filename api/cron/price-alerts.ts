/**
 * `GET /api/cron/price-alerts` — el loop de alertas del bot.
 *
 * Los loops del roadmap (`backend/workflows/marketLoops.ts`) viven en un Express
 * que no está desplegado. Este corre de verdad: Vercel lo llama por horario (ver
 * `crons` en `vercel.json`) o cualquiera con el secreto, a mano.
 *
 * Qué hace: lee todas las alertas, pide **sólo** las fuentes que alguien ha
 * pedido, y avisa por Telegram de las que se cruzaron. Las disparadas se
 * borran: una alerta es de un solo uso.
 *
 * Cuatro clases, el mismo almacén:
 *  - **precio** y **movimiento** → CoinGecko (una petición para todos).
 *  - **sismos** → feed `all_day` de USGS.
 *  - **gdelt** → GKG, una consulta por tema distinto.
 *
 * Reglas:
 *  - Sin secreto no contesta (401). Sin Redis devuelve 200 con el motivo: un
 *    cron que falla en silencio es peor que uno que no hace nada.
 *  - Si una fuente falla, **sus** alertas no disparan ni se borran, y las demás
 *    siguen: que CoinGecko esté caído no debe dejar sin aviso de sismos.
 *  - Ni se inventan cifras ni se disparan alertas a ciegas: cada fuente que no
 *    contesta se dice en la respuesta (`reason` / `failures`).
 *  - El aviso es el mismo `sendMessage` del bot, así que el usuario lo recibe
 *    donde ya habla con él.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { timingSafeEqual } from "crypto";
import { allAlerts, dueAlerts, formatAlert, saveAlerts, SYMBOL_IDS, type Alert } from "../_shared/alerts.js";
import {
  emptySnapshot,
  neededSources,
  readGdeltEvents,
  readPrices,
  readQuakes,
  type AlertSnapshot,
} from "../_shared/alert-sources.js";
import { gdeltUpstreamUrl, parseGdeltParams } from "../gdelt.js";
import { isRedisConfigured, recordSeed } from "../_shared/redis.js";

export const maxDuration = 30;

const PRICE_URL = "https://api.coingecko.com/api/v3/simple/price";
const QUAKE_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";
const HTTP_TIMEOUT_MS = 12_000;
/** Ventana de GDELT para buscar eventos nuevos: el cron corre como mucho una vez al día. */
const GDELT_HOURS = 24;

/**
 * Marcas de frescura que lee `/api/health`.
 *
 * Se escriben al terminar de traer cada fuente, sin guardar los datos ni
 * consultarlos luego: el cron sigue disparando con lo que acaba de pedir. La
 * marca no cambia ninguna decisión de alerta, así que un Redis lento o caído
 * no retrasa ni impide un aviso (`recordSeed` no lanza).
 */
const MARKET_SEED_KEY = "market:crypto:v1";
const QUAKE_SEED_KEY = "seismic:events:v1";
const GDELT_SEED_KEY = "osint:gdelt:v1";
/**
 * 48 h de vida para la marca: la salud da por viejo a los 10 min (cripto), 60
 * min (sismos) y 30 min (GDELT), así que la marca tiene que durar más que eso
 * para poder decir STALE; si caducara, diría EMPTY y parecería que no hay
 * publicador.
 */
const SEED_META_TTL_SECONDS = 48 * 3_600;

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

async function getJson(url: string, label: string): Promise<unknown | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "aitor-api/1.0 (price-alerts)", accept: "application/json" },
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`[alerts] ${label} respondió`, response.status);
      return null;
    }
    return (await response.json()) as unknown;
  } catch (error) {
    console.error(`[alerts] ${label} no respondió`, error);
    return null;
  }
}

/** Precio y variación de 24 h. `null` cuando la fuente no contestó. */
async function fetchMarket(symbols: string[]) {
  const ids = [...new Set(symbols.map((symbol) => SYMBOL_IDS[symbol]).filter(Boolean))];
  if (ids.length === 0) return { prices: {}, changes: {} };
  const url = `${PRICE_URL}?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`;
  const payload = await getJson(url, "CoinGecko");
  if (payload === null) return null;
  return readPrices(payload);
}

async function notify(chatId: number, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  if (!token) return false;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
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

/**
 * Rellena el snapshot con lo que se haya pedido. Lo que falle se queda vacío y
 * se anota: así esas alertas no disparan, pero las de las demás fuentes sí.
 */
async function collectSnapshot(alerts: Alert[]): Promise<{ snapshot: AlertSnapshot; failures: string[] }> {
  const snapshot = emptySnapshot();
  const failures: string[] = [];
  const needed = neededSources(alerts);

  if (needed.market) {
    const symbols = [...new Set(alerts.flatMap((alert) => (alert.kind === "price" || alert.kind === "move" ? [alert.symbol] : [])))];
    const market = await fetchMarket(symbols);
    if (market) {
      snapshot.prices = market.prices;
      snapshot.changes = market.changes;
      const quoted = Object.values(market.prices).filter((price) => price !== null).length;
      await recordSeed(MARKET_SEED_KEY, quoted, SEED_META_TTL_SECONDS);
    } else {
      failures.push("sin-precios");
    }
  }

  if (needed.quakes) {
    const payload = await getJson(QUAKE_URL, "USGS");
    if (payload === null) {
      failures.push("sin-sismos");
    } else {
      snapshot.quakes = readQuakes(payload);
      await recordSeed(QUAKE_SEED_KEY, snapshot.quakes.length, SEED_META_TTL_SECONDS);
    }
  }

  for (const theme of needed.gdeltThemes) {
    const parsed = parseGdeltParams({ theme, hours: String(GDELT_HOURS), maxrows: "250" });
    if (!parsed.ok) {
      failures.push(`sin-gdelt:${theme}`);
      continue;
    }
    const payload = await getJson(gdeltUpstreamUrl(parsed.value), `GDELT ${theme}`);
    if (payload === null) {
      failures.push(`sin-gdelt:${theme}`);
    } else {
      snapshot.gdelt[theme] = readGdeltEvents(payload);
      await recordSeed(GDELT_SEED_KEY, snapshot.gdelt[theme].length, SEED_META_TTL_SECONDS);
    }
  }

  return { snapshot, failures };
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

  const { snapshot, failures } = await collectSnapshot(chats.flatMap((entry) => entry.alerts));

  let fired = 0;
  let delivered = 0;
  for (const entry of chats) {
    const due = dueAlerts(entry.alerts, snapshot);
    if (due.length === 0) continue;

    const sent: Alert[] = [];
    for (const alert of due) {
      if (await notify(alert.chatId, formatAlert(alert, snapshot))) {
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

  // `reason` se conserva para el caso de una sola fuente, que es el que ve
  // quien mira el cron a mano; `failures` dice todas las que fallaron.
  const body: Record<string, unknown> = { ok: true, checked: pending, fired, delivered };
  if (failures.length > 0) body.failures = failures;
  if (fired === 0 && failures.length > 0) body.reason = failures[0];

  return res.status(200).json(body);
}
