/**
 * Tablero de señales: une el motor puro (`market-signals`) con lo que la
 * aplicación sabe de verdad hoy.
 *
 * El motor pide funding, interés abierto, liquidez y precios CEX/DEX. La
 * función `crypto-signals` sólo devuelve eventos de Polymarket, que sí traen
 * profundidad (`liquidity`) y volumen de 24 h (`volume24hr`). Así que los
 * retratos se construyen con esos dos campos y nada más: sin funding no hay
 * señal de apalancamiento y sin precio CEX no hay base, pero el motor ya sabe
 * callarse esas ramas en vez de rellenarlas.
 *
 * El orden lo pone este módulo, no el componente, para que se pueda probar sin
 * montar React: puntuación de riesgo, luego la gravedad de la primera señal y
 * luego el nombre. Es un orden total, así que dos renders del mismo retrato
 * pintan la misma lista.
 */
import {
  analyzeMarket,
  riskScore,
  type MarketSignal,
  type MarketSnapshot,
  type SignalSeverity,
} from "./market-signals";

/** Evento de mercado tal y como lo devuelve `crypto-signals` (acción `polymarket`). */
export interface MarketEventLike {
  id?: string | number | null;
  title?: string | null;
  slug?: string | null;
  /** Profundidad del libro o del pool, en dólares. La API a veces la manda como texto. */
  liquidity?: number | string | null;
  volume24hr?: number | string | null;
}

export interface SignalBoardEntry {
  /** Identificador estable, para la clave de la lista. */
  id: string;
  /** Nombre del mercado. */
  label: string;
  /** Señales del motor, ya de más a menos urgente. */
  signals: MarketSignal[];
  /** Puntuación de riesgo 0–100 del motor. */
  score: number;
}

const SEVERITY_RANK: Record<SignalSeverity, number> = { alert: 0, watch: 1, info: 2 };

/** Número utilizable a partir de lo que publica la API, o `null` si no lo es. */
function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Retrato del motor a partir de un evento de mercado. */
export function snapshotFromEvent(event: MarketEventLike): MarketSnapshot {
  const name = (event.title ?? event.slug ?? "").trim();
  return {
    symbol: name === "" ? undefined : name,
    liquidityUsd: toNumber(event.liquidity),
    volume24hUsd: toNumber(event.volume24hr),
  };
}

/**
 * Tablero ordenado por urgencia. Sólo entran los mercados con algo que decir:
 * un evento sin liquidez ni volumen no genera señal y no ocupa sitio.
 */
export function buildSignalBoard(events: readonly MarketEventLike[]): SignalBoardEntry[] {
  const entries: SignalBoardEntry[] = [];
  const seen = new Set<string>();

  events.forEach((event, index) => {
    const snapshot = snapshotFromEvent(event);
    const signals = analyzeMarket(snapshot);
    if (signals.length === 0) return;

    const id = String(event.id ?? event.slug ?? `evento-${index}`);
    if (seen.has(id)) return;
    seen.add(id);

    entries.push({
      id,
      label: snapshot.symbol ?? `Mercado ${index + 1}`,
      signals,
      score: riskScore(signals),
    });
  });

  return entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const worstA = SEVERITY_RANK[a.signals[0]?.severity ?? "info"];
    const worstB = SEVERITY_RANK[b.signals[0]?.severity ?? "info"];
    if (worstA !== worstB) return worstA - worstB;
    return a.label.localeCompare(b.label, "es");
  });
}
