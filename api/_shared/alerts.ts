/**
 * Alertas del bot: lógica y almacén.
 *
 * Cuatro clases de aviso, un solo almacén y un solo cron:
 *
 *  - **precio** — `/alerta BTC > 95000`, como desde la Fase 5.
 *  - **movimiento** — `/alerta BTC +5%`: cuánto se ha movido en 24 h.
 *  - **sismos** — `/alerta sismos 5.5`: magnitud mínima (USGS).
 *  - **gdelt** — `/alerta gdelt ARMEDCONFLICT`: evento nuevo de un tema.
 *
 * Por qué Redis y no Postgres: una alerta es un aviso temporal, no memoria del
 * usuario. Caduca sola y no necesita RLS ni migración; además el cron corre en
 * Vercel, donde ya está el cliente de Redis.
 *
 * Almacén: **un solo hash**, `aitor:alerts`, con el token del hilo como campo
 * y el JSON de sus alertas como valor. Las alertas guardadas antes de existir
 * `kind` se leen como alertas de precio: no se pierden al desplegar esto.
 *
 * El campo es el token opaco del hilo, así que la clave no lleva el chat_id.
 * El valor sí lo lleva: sin él no hay a quién avisar. Es la única pieza del
 * proyecto que guarda el id del chat, y se dice aquí para que no sorprenda.
 */

import { isRedisConfigured, redisCommand } from "./redis.js";
import type { AlertSnapshot } from "./alert-sources.js";

export type AlertDirection = "above" | "below";

interface AlertBase {
  chatId: number;
  createdAt: string;
}

export interface PriceAlert extends AlertBase {
  kind: "price";
  symbol: string;
  direction: AlertDirection;
  price: number;
}

export interface MoveAlert extends AlertBase {
  kind: "move";
  symbol: string;
  direction: AlertDirection;
  /** Porcentaje absoluto: 5 es «un 5 %», y la dirección dice hacia dónde. */
  percent: number;
}

export interface QuakeAlert extends AlertBase {
  kind: "quake";
  minMagnitude: number;
}

export interface GdeltAlert extends AlertBase {
  kind: "gdelt";
  theme: string;
}

export type Alert = PriceAlert | MoveAlert | QuakeAlert | GdeltAlert;

export type ParsedAlert =
  | { kind: "price"; symbol: string; direction: AlertDirection; price: number }
  | { kind: "move"; symbol: string; direction: AlertDirection; percent: number }
  | { kind: "quake"; minMagnitude: number }
  | { kind: "gdelt"; theme: string };

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

/** Tema de GDELT: mayúsculas, números y guion bajo (`ARMEDCONFLICT`). */
const GDELT_THEME = /^[A-Z][A-Z0-9_]{2,40}$/;
const MIN_QUAKE_MAGNITUDE = 1;
const MAX_QUAKE_MAGNITUDE = 9.9;
const MAX_MOVE_PERCENT = 100;

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
 * `/alerta …` → la alerta pedida, o `null`.
 *
 * Cualquier forma que no encaje devuelve `null`: mejor no crear nada que crear
 * un aviso que no se entiende ni se puede comprobar.
 */
export function parseAlertCommand(text: string): ParsedAlert | null {
  const body = text.replace(/^\/alerta(@\w+)?/i, "").trim();
  if (!body) return null;

  // Sismos: `/alerta sismos 5.5`
  const quake = /^sismos?\s+(\d(?:[.,]\d)?)$/i.exec(body);
  if (quake) {
    const magnitude = Number(quake[1].replace(",", "."));
    if (!Number.isFinite(magnitude) || magnitude < MIN_QUAKE_MAGNITUDE || magnitude > MAX_QUAKE_MAGNITUDE) {
      return null;
    }
    return { kind: "quake", minMagnitude: magnitude };
  }

  // GDELT: `/alerta gdelt ARMEDCONFLICT`
  const gdelt = /^gdelt\s+([A-Za-z][A-Za-z0-9_]{2,40})$/i.exec(body);
  if (gdelt) {
    const theme = gdelt[1].toUpperCase();
    return GDELT_THEME.test(theme) ? { kind: "gdelt", theme } : null;
  }

  // Movimiento: `/alerta BTC +5%` (sube) o `/alerta BTC -5%` (baja)
  const move = /^([a-z]{2,10})\s*([+-])\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*%$/i.exec(body);
  if (move) {
    const symbol = move[1].toUpperCase();
    if (!SYMBOL_IDS[symbol]) return null;
    const percent = Number(move[3].replace(",", "."));
    if (!Number.isFinite(percent) || percent <= 0 || percent > MAX_MOVE_PERCENT) return null;
    return { kind: "move", symbol, direction: move[2] === "+" ? "above" : "below", percent };
  }

  // Precio: `/alerta BTC > 95000`. Se admite `>` y `>=`, `<` y `<=`: para un
  // aviso, llegar al número ya cuenta.
  const price = /^([a-z]{2,10})\s*(>=|<=|>|<)\s*([0-9.,]+k?)$/i.exec(body);
  if (!price) return null;
  const symbol = price[1].toUpperCase();
  if (!SYMBOL_IDS[symbol]) return null;
  const value = parsePrice(price[3]);
  if (value === null) return null;
  return {
    kind: "price",
    symbol,
    direction: price[2].startsWith(">") ? "above" : "below",
    price: value,
  };
}

/** Lo que se guarda: la alerta pedida, con su chat y su hora. */
export function buildAlert(
  parsed: ParsedAlert,
  chatId: number,
  createdAt = new Date().toISOString(),
): Alert {
  switch (parsed.kind) {
    case "price":
      return { kind: "price", chatId, createdAt, symbol: parsed.symbol, direction: parsed.direction, price: parsed.price };
    case "move":
      return { kind: "move", chatId, createdAt, symbol: parsed.symbol, direction: parsed.direction, percent: parsed.percent };
    case "quake":
      return { kind: "quake", chatId, createdAt, minMagnitude: parsed.minMagnitude };
    case "gdelt":
      return { kind: "gdelt", chatId, createdAt, theme: parsed.theme };
  }
}

/** `true` cuando el precio de ahora cruza lo pedido. */
export function isDue(alert: Pick<PriceAlert, "direction" | "price">, current: number | null): boolean {
  if (current === null || !Number.isFinite(current)) return false;
  return alert.direction === "above" ? current >= alert.price : current <= alert.price;
}

function money(value: number): string {
  return `$${value.toLocaleString("es-ES")}`;
}

function percent(value: number): string {
  return `${value.toLocaleString("es-ES", { maximumFractionDigits: 2 })} %`;
}

/** Confirmación al crear el aviso. El de precio conserva su texto de siempre. */
export function formatCreated(alert: Alert): string {
  switch (alert.kind) {
    case "price": {
      const arrow = alert.direction === "above" ? "≥" : "≤";
      return `✅ Aviso creado: ${alert.symbol} ${arrow} ${money(alert.price)}. Te escribo cuando lo cruce.`;
    }
    case "move": {
      const sign = alert.direction === "above" ? "+" : "-";
      return `✅ Aviso creado: ${alert.symbol} se mueva ${sign}${percent(alert.percent)} en 24 h. Te escribo si pasa.`;
    }
    case "quake":
      return `✅ Aviso creado: sismo de magnitud ≥ ${alert.minMagnitude.toLocaleString("es-ES")}. Te escribo si hay uno nuevo.`;
    case "gdelt":
      return `✅ Aviso creado: evento nuevo del tema ${alert.theme}. Te escribo si aparece.`;
  }
}

/** Nombre corto de lo que mide cada clase, para la ayuda y los registros. */
export function alertKindLabel(alert: Alert): string {
  switch (alert.kind) {
    case "price":
      return `${alert.symbol} ${alert.direction === "above" ? "≥" : "≤"} ${money(alert.price)}`;
    case "move":
      return `${alert.symbol} ${alert.direction === "above" ? "+" : "-"}${percent(alert.percent)} 24 h`;
    case "quake":
      return `sismo ≥ ${alert.minMagnitude.toLocaleString("es-ES")}`;
    case "gdelt":
      return `GDELT ${alert.theme}`;
  }
}

/**
 * `/alerta lista` y `/alerta borra <n>`: los dos comandos que no crean nada.
 *
 * Se interpretan aparte de `parseAlertCommand` para que una alerta nunca pueda
 * llamarse «lista» o «borra» y para poder distinguir «no entiendo el número»
 * de «ese número no existe»: el usuario necesita saber cuál de las dos cosas
 * pasó para corregirlo.
 */
export type AlertManageCommand =
  | { action: "list" }
  /** `position: null` = se pidió borrar sin un número utilizable. */
  | { action: "delete"; position: number | null };

export function parseAlertManage(text: string): AlertManageCommand | null {
  const body = text.replace(/^\/alerta(@\w+)?/i, "").trim();
  if (/^lista$/i.test(body)) return { action: "list" };

  const remove = /^borra(?:\s+(.*))?$/i.exec(body);
  if (!remove) return null;
  const raw = (remove[1] ?? "").trim();
  if (!/^\d{1,3}$/.test(raw)) return { action: "delete", position: null };
  const position = Number(raw);
  return { action: "delete", position: position >= 1 ? position : null };
}

/**
 * Lista numerada, en el mismo orden en que se guardaron.
 *
 * Los números son la única forma de referirse a un aviso (no tienen id), así
 * que se numeran desde 1 y se repiten al borrar: lo que el usuario ve es
 * siempre el índice que puede usar.
 */
export function formatAlertList(alerts: Alert[]): string {
  if (alerts.length === 0) {
    return "📋 No tienes avisos. Crea uno con /alerta BTC > 95000.";
  }
  const lines = alerts.map((alert, index) => `${index + 1}. ${alertKindLabel(alert)}`);
  const example = alerts.length === 1 ? 1 : 2;
  return [
    `📋 Tus avisos (${alerts.length} de ${MAX_ALERTS_PER_CHAT}):`,
    ...lines,
    "",
    `Para cancelar uno: /alerta borra ${example}`,
  ].join("\n");
}

/** Quita el aviso en la posición indicada (1…n) sin tocar el original. */
export function removeAlertAt(
  alerts: Alert[],
  position: number,
): { removed: Alert; alerts: Alert[] } | null {
  if (!Number.isInteger(position) || position < 1 || position > alerts.length) return null;
  const remaining = alerts.slice();
  const [removed] = remaining.splice(position - 1, 1);
  return removed ? { removed, alerts: remaining } : null;
}

/** Confirmación de `/alerta borra <n>`. */
export function formatCancelled(alert: Alert): string {
  return `✅ Aviso cancelado: ${alertKindLabel(alert)}.`;
}

/** El sismo más fuerte que cruza el umbral y es posterior a la alerta. */
function strongest(alert: QuakeAlert, snapshot: AlertSnapshot) {
  const createdAt = Date.parse(alert.createdAt);
  const matches = snapshot.quakes.filter(
    (event) =>
      event.magnitude >= alert.minMagnitude &&
      (Number.isNaN(createdAt) ? true : Date.parse(event.atIso) > createdAt),
  );
  if (matches.length === 0) return null;
  return matches.reduce((best, event) => (event.magnitude > best.magnitude ? event : best));
}

/** El evento más reciente del tema posterior a la alerta; sin fecha no cuenta. */
function newestGdelt(alert: GdeltAlert, snapshot: AlertSnapshot) {
  const createdAt = Date.parse(alert.createdAt);
  const events = snapshot.gdelt[alert.theme] ?? [];
  const dated = events.filter((event) =>
    event.atIso !== null &&
    Date.parse(event.atIso) > (Number.isNaN(createdAt) ? 0 : createdAt),
  );
  if (dated.length === 0) return null;
  return dated.reduce((best, event) =>
    Date.parse(String(event.atIso)) >= Date.parse(String(best.atIso)) ? event : best,
  );
}

/**
 * Las que tocan avisar ahora, en el orden en que se crearon.
 *
 * Cada clase se comprueba contra su parte del snapshot y sólo dispara cuando
 * tiene un dato que lo justifica: un sismo viejo, un evento de GDELT sin fecha
 * o un símbolo sin precio no cuentan.
 */
export function dueAlerts(alerts: Alert[], snapshot: AlertSnapshot): Alert[] {
  return alerts.filter((alert) => {
    switch (alert.kind) {
      case "price":
        return isDue(alert, snapshot.prices[alert.symbol] ?? null);
      case "move": {
        const change = snapshot.changes[alert.symbol] ?? null;
        if (change === null || !Number.isFinite(change)) return false;
        return alert.direction === "above" ? change >= alert.percent : change <= -alert.percent;
      }
      case "quake":
        return strongest(alert, snapshot) !== null;
      case "gdelt":
        return newestGdelt(alert, snapshot) !== null;
    }
  });
}

/**
 * Texto del aviso, con el dato que lo disparó.
 *
 * El de precio mantiene su formato de siempre; el resto dice qué pasó y con
 * qué cifra, sin adornos y sin inventar cuando falta el dato.
 */
export function formatAlert(alert: Alert, snapshot: AlertSnapshot): string {
  switch (alert.kind) {
    case "price": {
      const current = snapshot.prices[alert.symbol] ?? null;
      const arrow = alert.direction === "above" ? "≥" : "≤";
      if (current === null) return `🔔 ${alert.symbol}: sin precio de la fuente (aviso: ${arrow} ${money(alert.price)}).`;
      return `🔔 ${alert.symbol} está en ${money(current)} (aviso: ${arrow} ${money(alert.price)}).`;
    }
    case "move": {
      const change = snapshot.changes[alert.symbol] ?? null;
      const sign = alert.direction === "above" ? "+" : "-";
      if (change === null) return `🔔 ${alert.symbol}: sin variación de 24 h (aviso: ${sign}${percent(alert.percent)}).`;
      const signed = change > 0 ? `+${percent(change)}` : percent(change);
      return `🔔 ${alert.symbol} se ha movido ${signed} en 24 h (aviso: ${sign}${percent(alert.percent)}).`;
    }
    case "quake": {
      const event = strongest(alert, snapshot);
      if (!event) return `🔔 Sismo de magnitud ≥ ${alert.minMagnitude.toLocaleString("es-ES")}: sin dato.`;
      return `🔔 Sismo M${event.magnitude.toLocaleString("es-ES")} — ${event.place} (aviso: ≥ M${alert.minMagnitude.toLocaleString("es-ES")}).`;
    }
    case "gdelt": {
      const event = newestGdelt(alert, snapshot);
      if (!event) return `🔔 GDELT ${alert.theme}: sin evento nuevo.`;
      const where = event.domain ? ` (${event.domain})` : "";
      return `🔔 GDELT ${alert.theme}: ${event.name}${where}\n${event.url}`;
    }
  }
}

/** Descarta lo que no tenga forma de alerta: Redis no es de fiar. */
export function sanitizeAlerts(stored: unknown): Alert[] {
  if (!Array.isArray(stored)) return [];
  const alerts: Alert[] = [];
  for (const item of stored) {
    const raw = item as Record<string, unknown>;
    if (!raw || typeof raw !== "object") continue;
    if (typeof raw.chatId !== "number") continue;
    const createdAt = typeof raw.createdAt === "string" ? raw.createdAt : "";

    const kind = typeof raw.kind === "string" ? raw.kind : "price";
    if (kind === "price") {
      const symbol = typeof raw.symbol === "string" ? raw.symbol : "";
      const direction = raw.direction;
      const price = raw.price;
      if (!SYMBOL_IDS[symbol]) continue;
      if (direction !== "above" && direction !== "below") continue;
      if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) continue;
      alerts.push({ kind: "price", chatId: raw.chatId, createdAt, symbol, direction, price });
      continue;
    }
    if (kind === "move") {
      const symbol = typeof raw.symbol === "string" ? raw.symbol : "";
      const direction = raw.direction;
      const change = raw.percent;
      if (!SYMBOL_IDS[symbol]) continue;
      if (direction !== "above" && direction !== "below") continue;
      if (typeof change !== "number" || !Number.isFinite(change) || change <= 0 || change > MAX_MOVE_PERCENT) continue;
      alerts.push({ kind: "move", chatId: raw.chatId, createdAt, symbol, direction, percent: change });
      continue;
    }
    if (kind === "quake") {
      const magnitude = raw.minMagnitude;
      if (
        typeof magnitude !== "number" ||
        !Number.isFinite(magnitude) ||
        magnitude < MIN_QUAKE_MAGNITUDE ||
        magnitude > MAX_QUAKE_MAGNITUDE
      ) {
        continue;
      }
      alerts.push({ kind: "quake", chatId: raw.chatId, createdAt, minMagnitude: magnitude });
      continue;
    }
    if (kind === "gdelt") {
      const theme = typeof raw.theme === "string" ? raw.theme : "";
      if (!GDELT_THEME.test(theme)) continue;
      alerts.push({ kind: "gdelt", chatId: raw.chatId, createdAt, theme });
    }
  }
  return alerts;
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
