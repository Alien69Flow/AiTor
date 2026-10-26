/**
 * Alertas del panel: qué son, cómo se guardan y cuándo disparan.
 *
 * Vive fuera del componente para poder probarlo sin DOM y para que el formato
 * guardado en `localStorage` tenga una única definición. Hay dos motores reales:
 * precio (CoinGecko) y avistamientos UAP (tabla `uap_sightings`). No se anuncian
 * tipos que no comprueben nada.
 */

export const ALERTS_STORAGE_KEY = "alienflow-alerts";

export interface CoinOption {
  id: string;
  symbol: string;
  name: string;
}

/** Ids de CoinGecko, los mismos que usa `useCryptoPrices`. */
export const ALERT_COINS: CoinOption[] = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "solana", symbol: "SOL", name: "Solana" },
  { id: "binancecoin", symbol: "BNB", name: "BNB" },
  { id: "ripple", symbol: "XRP", name: "XRP" },
  { id: "cardano", symbol: "ADA", name: "Cardano" },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin" },
  { id: "chainlink", symbol: "LINK", name: "Chainlink" },
  { id: "avalanche-2", symbol: "AVAX", name: "Avalanche" },
  { id: "polkadot", symbol: "DOT", name: "Polkadot" },
  { id: "near", symbol: "NEAR", name: "NEAR" },
  { id: "arbitrum", symbol: "ARB", name: "Arbitrum" },
];

export type Direction = "above" | "below";
export type AlertKind = "price" | "uap";

interface AlertBase {
  id: string;
  active: boolean;
  /** La condición se cumple ahora mismo. Se rearma sola al dejar de cumplirse. */
  triggered: boolean;
  createdAt: string;
}

export interface PriceAlert extends AlertBase {
  kind: "price";
  coinId: string;
  direction: Direction;
  threshold: number;
}

export interface UapAlert extends AlertBase {
  kind: "uap";
  keyword: string;
  /** Ids ya notificados, para no repetir el mismo avistamiento cada minuto. */
  seen: string[];
}

export type Alert = PriceAlert | UapAlert;

export interface AlertDraft {
  kind: AlertKind;
  coinId: string;
  direction: Direction;
  /** Texto tal cual del input: la validación decide si es un número usable. */
  threshold: string;
  keyword: string;
}

export const EMPTY_DRAFT: AlertDraft = {
  kind: "price",
  coinId: "bitcoin",
  direction: "above",
  threshold: "",
  keyword: "",
};

export function coinSymbol(coinId: string): string {
  return ALERT_COINS.find((coin) => coin.id === coinId)?.symbol ?? coinId.toUpperCase();
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function describeAlert(alert: Alert): string {
  if (alert.kind === "price") {
    const comparator = alert.direction === "above" ? "sube por encima de" : "cae por debajo de";
    return `${coinSymbol(alert.coinId)} ${comparator} ${formatThreshold(alert.threshold)}`;
  }
  return `Avistamiento con «${alert.keyword}»`;
}

function formatThreshold(value: number): string {
  const digits = value < 1 ? 4 : value < 100 ? 2 : 0;
  return `$${value.toLocaleString("es-ES", { maximumFractionDigits: digits })}`;
}

/** Texto de error en español, o `null` si el borrador se puede guardar. */
export function validateDraft(draft: AlertDraft): string | null {
  if (draft.kind === "price") {
    const threshold = Number(draft.threshold.replace(",", "."));
    if (!draft.threshold.trim()) return "Escribe un umbral de precio.";
    if (!Number.isFinite(threshold) || threshold <= 0) return "El umbral tiene que ser un número mayor que cero.";
    if (!ALERT_COINS.some((coin) => coin.id === draft.coinId)) return "Elige una moneda de la lista.";
    return null;
  }
  const keyword = draft.keyword.trim();
  if (keyword.length < 3) return "La palabra clave necesita al menos 3 caracteres.";
  if (keyword.length > 60) return "La palabra clave no puede pasar de 60 caracteres.";
  return null;
}

export function draftFromAlert(alert: Alert): AlertDraft {
  if (alert.kind === "price") {
    return {
      kind: "price",
      coinId: alert.coinId,
      direction: alert.direction,
      threshold: String(alert.threshold),
      keyword: "",
    };
  }
  return { ...EMPTY_DRAFT, kind: "uap", keyword: alert.keyword };
}

/**
 * Construye la alerta desde el borrador. Con `existing` conserva id, fecha de
 * creación, estado activo y (`uap`) los ids ya notificados: editar una alerta no
 * debe volver a avisar de lo mismo.
 */
export function alertFromDraft(draft: AlertDraft, existing?: Alert): Alert {
  const base: AlertBase = {
    id: existing?.id ?? newId(),
    active: existing?.active ?? true,
    triggered: false,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };

  if (draft.kind === "price") {
    return {
      ...base,
      kind: "price",
      coinId: draft.coinId,
      direction: draft.direction,
      threshold: Number(draft.threshold.replace(",", ".")),
    };
  }

  return {
    ...base,
    kind: "uap",
    keyword: draft.keyword.trim(),
    seen: existing?.kind === "uap" ? existing.seen : [],
  };
}

export function upsertAlert(list: Alert[], alert: Alert): Alert[] {
  const index = list.findIndex((entry) => entry.id === alert.id);
  if (index === -1) return [...list, alert];
  const next = [...list];
  next[index] = alert;
  return next;
}

export function priceConditionMet(alert: PriceAlert, price: number): boolean {
  return alert.direction === "above" ? price > alert.threshold : price < alert.threshold;
}

export function uapMatches(alert: UapAlert, record: { location?: string | null; description?: string | null; type?: string | null }): boolean {
  const haystack = [record.location, record.description, record.type].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(alert.keyword.toLowerCase());
}

/**
 * Formato antiguo: `type: "price" | "volume" | "uap" | "geopolitical"` con
 * `label`/`condition`. Solo las de precio tenían motor; el resto se descarta en
 * vez de mostrarse como si funcionasen.
 */
function migrateLegacy(raw: Record<string, unknown>): Alert | null {
  const currency = raw.type === "price" || raw.type === undefined ? raw : null;
  if (!currency) return null;
  const threshold = Number(currency.threshold);
  const direction = currency.direction === "below" ? "below" : "above";
  if (!Number.isFinite(threshold) || threshold <= 0) return null;

  return {
    id: typeof currency.id === "string" && currency.id ? currency.id : newId(),
    kind: "price",
    coinId: typeof currency.coinId === "string" ? currency.coinId : "bitcoin",
    direction,
    threshold,
    active: currency.active !== false,
    triggered: currency.triggered === true,
    createdAt: typeof currency.createdAt === "string" ? currency.createdAt : new Date().toISOString(),
  };
}

function isAlert(value: unknown): value is Alert {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<Alert> & Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.active !== "boolean") return false;
  if (row.kind === "price") {
    return typeof row.coinId === "string" && Number.isFinite(row.threshold) && (row.direction === "above" || row.direction === "below");
  }
  if (row.kind === "uap") {
    return typeof row.keyword === "string" && row.keyword.trim().length > 0;
  }
  return false;
}

/** Lee lo guardado; cualquier entrada inválida se descarta sin romper el panel. */
export function parseStoredAlerts(raw: string | null): Alert[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap<Alert>((entry) => {
    if (isAlert(entry)) {
      if (entry.kind === "uap" && !Array.isArray(entry.seen)) return [{ ...entry, seen: [] }];
      return [entry];
    }
    if (entry && typeof entry === "object") {
      const migrated = migrateLegacy(entry as Record<string, unknown>);
      return migrated ? [migrated] : [];
    }
    return [];
  });
}
