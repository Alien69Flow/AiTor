/**
 * Lectura de las fuentes que alimentan las alertas, sin red ni estado.
 *
 * Cada función recibe el cuerpo tal cual llegó y devuelve datos ya normalizados,
 * o una lista vacía. Nunca lanza y nunca rellena: un cuerpo con la página de
 * error de GDELT, un sismo sin magnitud o un precio que no es número se caen
 * aquí, antes de que nadie decida disparar un aviso.
 *
 * Las formas están comprobadas contra los servidores de verdad:
 *
 *  - CoinGecko `simple/price` → `{ bitcoin: { usd, usd_24h_change } }`.
 *  - USGS `summary/all_day.geojson` → `features[].properties.{mag,place,time}`,
 *    con `time` en milisegundos.
 *  - GDELT GKG GeoJSON → `features[].properties.{url,name,urlpubtimedate,domain}`.
 *    Cuando el tema no le encaja (o limita la IP), GDELT **no** devuelve error
 *    HTTP: devuelve una FeatureCollection con `name: "ERROR: …"` y sin `url`.
 *    Eso no es un evento y aquí se descarta.
 */
import { SYMBOL_IDS, type Alert } from "./alerts.js";

export interface QuakeEvent {
  id: string;
  magnitude: number;
  place: string;
  atIso: string;
}

export interface GdeltEvent {
  url: string;
  name: string;
  domain: string;
  /** `null` cuando la fuente no da una fecha que se pueda leer. */
  atIso: string | null;
}

export interface AlertSnapshot {
  prices: Record<string, number | null>;
  /** Variación de las últimas 24 h en porcentaje (`usd_24h_change`). */
  changes: Record<string, number | null>;
  quakes: QuakeEvent[];
  /** Eventos por tema de GDELT, ya normalizados. */
  gdelt: Record<string, GdeltEvent[]>;
}

export function emptySnapshot(): AlertSnapshot {
  return { prices: {}, changes: {}, quakes: [], gdelt: {} };
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const finiteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/**
 * Precio y variación de 24 h por símbolo.
 *
 * El id de CoinGecko y el símbolo del bot no coinciden (`bitcoin` / `BTC`), así
 * que se traduce en los dos sentidos con la tabla que ya usa el resto del
 * proyecto. Un símbolo sin dato queda en `null`, nunca en cero.
 */
export function readPrices(payload: unknown): {
  prices: Record<string, number | null>;
  changes: Record<string, number | null>;
} {
  const root = asRecord(payload);
  const prices: Record<string, number | null> = {};
  const changes: Record<string, number | null> = {};
  for (const [symbol, id] of Object.entries(SYMBOL_IDS)) {
    const row = root ? asRecord(root[id]) : null;
    prices[symbol] = row ? finiteNumber(row.usd) : null;
    changes[symbol] = row ? finiteNumber(row.usd_24h_change) : null;
  }
  return { prices, changes };
}

/** Sismos del feed de USGS; se descartan los que no traen magnitud o fecha. */
export function readQuakes(payload: unknown): QuakeEvent[] {
  const root = asRecord(payload);
  const features = Array.isArray(root?.features) ? root.features : [];
  const quakes: QuakeEvent[] = [];
  for (const feature of features) {
    const row = asRecord(feature);
    const properties = asRecord(row?.properties);
    const magnitude = finiteNumber(properties?.mag);
    const time = finiteNumber(properties?.time);
    if (magnitude === null || time === null) continue;
    const id = typeof row?.id === "string" && row.id ? row.id : `${time}-${magnitude}`;
    const place = typeof properties?.place === "string" && properties.place ? properties.place : "lugar sin nombre";
    quakes.push({
      id,
      magnitude,
      place,
      atIso: new Date(time).toISOString(),
    });
  }
  return quakes;
}

/**
 * Fecha de publicación de GDELT.
 *
 * GKG la sirve como `AAAAMMDDHHMMSS`; según el campo pedido también puede
 * llegar en ISO. Se aceptan las dos y cualquier otra cosa es `null`: una alerta
 * no se dispara con una fecha que no se entiende.
 */
export function parseGdeltTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  const compact = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(text);
  if (compact) {
    const [, year, month, day, hour, minute, second] = compact;
    const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  const normalised = /T\d{2}:\d{2}:\d{2}$/.test(text) ? `${text}Z` : text.replace(" ", "T");
  const parsed = new Date(normalised);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Eventos de un GeoJSON de GDELT GKG.
 *
 * Sin `url` no hay evento: la FeatureCollection de error que devuelve GDELT
 * sólo trae `name`, así que se queda fuera y la lista sale vacía.
 */
export function readGdeltEvents(payload: unknown): GdeltEvent[] {
  const root = asRecord(payload);
  const features = Array.isArray(root?.features) ? root.features : [];
  const events: GdeltEvent[] = [];
  for (const feature of features) {
    const properties = asRecord(asRecord(feature)?.properties);
    const url = typeof properties?.url === "string" ? properties.url.trim() : "";
    if (!/^https?:\/\//i.test(url)) continue;
    const name = typeof properties?.name === "string" ? properties.name.trim() : "";
    if (/^error:/i.test(name)) continue;
    events.push({
      url,
      name: name || "lugar sin nombre",
      domain: typeof properties?.domain === "string" ? properties.domain.trim() : "",
      atIso: parseGdeltTime(properties?.urlpubtimedate),
    });
  }
  return events;
}

/**
 * Qué fuentes hay que pedir para un conjunto de alertas.
 *
 * El cron lo usa para no salir a la red por capas que nadie ha pedido: con sólo
 * alertas de precio no se consulta USGS ni GDELT.
 */
export function neededSources(alerts: Alert[]): {
  market: boolean;
  quakes: boolean;
  gdeltThemes: string[];
} {
  let market = false;
  let quakes = false;
  const themes = new Set<string>();
  for (const alert of alerts) {
    if (alert.kind === "price" || alert.kind === "move") market = true;
    else if (alert.kind === "quake") quakes = true;
    else if (alert.kind === "gdelt") themes.add(alert.theme);
  }
  return { market, quakes, gdeltThemes: [...themes] };
}
