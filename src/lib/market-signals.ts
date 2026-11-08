/**
 * Señales de mercado calculadas a partir de un retrato (funding, interés
 * abierto, volumen, liquidez y precios CEX/DEX).
 *
 * Es un módulo puro a propósito: entra un objeto, salen señales, sin fetch, sin
 * `Date.now()` y sin estado. Así las reglas se pueden discutir y probar sin
 * levantar la pestaña de Markets ni depender de que un exchange responda.
 *
 * La idea directriz es no inventar. Cada señal dice **sólo** lo que los datos
 * permiten: si falta la variación de interés abierto no se afirma que haya
 * apalancamiento nuevo, y si no hay liquidez no se opina sobre rotación. Varias
 * señales dicen explícitamente «no se puede saber» en vez de rellenar el hueco,
 * porque un panel de señales que adivina es peor que uno vacío.
 *
 * Nada de esto es consejo de inversión: describe condiciones de mercado.
 */

export type SignalSeverity = "info" | "watch" | "alert";

export interface MarketSignal {
  /** Identificador estable: sirve para descartar duplicados en la UI. */
  id: string;
  severity: SignalSeverity;
  title: string;
  detail: string;
  /** Cifra que sostiene la señal, para enseñarla tal cual. */
  metric?: number;
}

/**
 * Lo que se sabe de un mercado en un momento dado. Todo es opcional: cada
 * fuente (exchange, agregador, pool) publica lo que publica, y las señales se
 * calculan con lo que haya.
 */
export interface MarketSnapshot {
  symbol?: string;
  /** Funding del periodo, en tanto por uno (0.0001 = 0.01 %). */
  fundingRate?: number | null;
  /** Horas del periodo de funding; casi todos usan 8, algunos 1 o 4. */
  fundingIntervalHours?: number | null;
  openInterestUsd?: number | null;
  /** Variación del interés abierto en 24 h, en porcentaje (12 = +12 %). */
  openInterestChange24hPct?: number | null;
  volume24hUsd?: number | null;
  /** Profundidad real del libro o del pool en dólares, no capitalización. */
  liquidityUsd?: number | null;
  cexVolume24hUsd?: number | null;
  dexVolume24hUsd?: number | null;
  cexPrice?: number | null;
  dexPrice?: number | null;
  priceChange24hPct?: number | null;
}

/** Umbrales, en un solo sitio para poder discutirlos sin leer la lógica. */
/** Funding anualizado a partir del cual el coste de mantener es el doble de lo normal. */
export const FUNDING_WATCH_ANNUAL = 0.25;
export const FUNDING_EXTREME_ANNUAL = 0.6;
/** Variación de interés abierto, en %, que se considera movimiento de verdad. */
export const OI_RISE_PCT = 5;
export const OI_FALL_PCT = 5;
/** Veces que el volumen diario gira sobre la liquidez disponible. */
export const TURNOVER_WATCH = 8;
export const TURNOVER_ALERT = 20;
/** Por debajo de esto, una orden normal mueve el precio. */
export const THIN_LIQUIDITY_USD = 250_000;
/** Diferencia de precio CEX/DEX, en puntos básicos. */
export const BASIS_WATCH_BPS = 50;
export const BASIS_ALERT_BPS = 150;
/** Cuota de volumen en DEX por debajo de la cual el precio «DEX» apenas informa. */
export const DEX_SHARE_SMALL = 0.05;

const finite = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

const positive = (value: number | null | undefined): value is number =>
  finite(value) && value > 0;

const pct = (value: number, digits = 1) => `${(value * 100).toFixed(digits)} %`;
const usd = (value: number) =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(2)} M$`
    : value >= 1_000
      ? `${(value / 1_000).toFixed(0)} k$`
      : `${value.toFixed(0)} $`;

/**
 * Funding anualizado.
 *
 * El funding se publica **por periodo**, no por año: 0,01 % cada 8 h no es
 * 0,01 % al año, es 10,95 %, porque se cobra tres veces al día. Comparar tasas
 * de exchanges con periodos distintos (1 h, 4 h, 8 h) sin normalizar es la
 * forma más fácil de leer un mercado al revés.
 *
 * Un periodo inválido devuelve 0 en vez de `Infinity`: preferimos no señalar
 * nada a señalar un 300 % que viene de dividir por cero.
 */
export function annualizeFunding(ratePerPeriod?: number | null, intervalHours = 8): number {
  if (!finite(ratePerPeriod) || !positive(intervalHours)) return 0;
  const periodsPerDay = 24 / intervalHours;
  if (!Number.isFinite(periodsPerDay)) return 0;
  const annual = ratePerPeriod * periodsPerDay * 365;
  return Number.isFinite(annual) ? annual : 0;
}

/**
 * Tamaño de orden que mueve el precio un `impactPct` por ciento en un pool de
 * producto constante con `liquidityUsd` de profundidad por lado.
 *
 * El impacto de una compra de x sobre un lado con L de reserva es x/(L+x), así
 * que despejando: x = L · impacto / (1 − impacto). A 1 % de impacto en un pool
 * de 1 M$ eso son 10,1 k$, no 10 k$: el 1 % se mide contra el precio final.
 */
export function maxTradeForImpact(liquidityUsd?: number | null, impactPct = 1): number {
  if (!positive(liquidityUsd) || !finite(impactPct)) return 0;
  if (impactPct <= 0 || impactPct >= 100) return 0;
  const impact = impactPct / 100;
  return (liquidityUsd * impact) / (1 - impact);
}

/** Veces que el volumen de 24 h gira sobre la liquidez disponible. */
export function turnoverRatio(
  volume24hUsd?: number | null,
  liquidityUsd?: number | null,
): number {
  if (!positive(volume24hUsd) || !positive(liquidityUsd)) return 0;
  return volume24hUsd / liquidityUsd;
}

/** Diferencia porcentual entre el precio DEX y el CEX, en puntos básicos. */
export function cexDexBasisBps(
  cexPrice?: number | null,
  dexPrice?: number | null,
): number {
  if (!positive(cexPrice) || !positive(dexPrice)) return 0;
  return ((dexPrice - cexPrice) / cexPrice) * 10_000;
}

/**
 * Funding contra interés abierto: la única pareja que distingue apalancamiento
 * nuevo de posiciones que se están cerrando.
 *
 * Funding alto sólo significa que un lado paga. Si además el interés abierto
 * sube, hay contratos nuevos de ese lado y el riesgo de liquidación en cascada
 * es real. Si el interés abierto baja, el funding es un eco: las posiciones se
 * están cerrando y la tasa se queda alta porque tarda en normalizarse.
 */
function fundingSignals(snapshot: MarketSnapshot): MarketSignal[] {
  const annual = annualizeFunding(snapshot.fundingRate, snapshot.fundingIntervalHours ?? 8);
  if (annual === 0) return [];

  const extreme = Math.abs(annual) >= FUNDING_EXTREME_ANNUAL;
  const elevated = Math.abs(annual) >= FUNDING_WATCH_ANNUAL;
  if (!elevated) return [];

  const longsPay = annual > 0;
  const oiChange = snapshot.openInterestChange24hPct;
  const signals: MarketSignal[] = [];

  if (!finite(oiChange)) {
    signals.push({
      id: "funding-elevated-no-oi",
      severity: "watch",
      title: longsPay ? "Funding alto, sin dato de interés abierto" : "Funding negativo, sin dato de interés abierto",
      detail:
        `Funding anualizado del ${pct(annual)}. Sin la variación de interés abierto no se ` +
        "puede saber si es apalancamiento nuevo o posiciones cerrándose: no se afirma ninguna de las dos.",
      metric: annual,
    });
    return signals;
  }

  if (oiChange >= OI_RISE_PCT) {
    signals.push({
      id: longsPay ? "funding-longs-crowded" : "funding-shorts-crowded",
      severity: extreme ? "alert" : "watch",
      title: longsPay ? "Longs pagando por apalancarse" : "Shorts pagando por apalancarse",
      detail:
        `Funding anualizado del ${pct(annual)} con interés abierto ${pct(oiChange / 100)} arriba ` +
        `en 24 h: ${longsPay ? "entran largos" : "entran cortos"} nuevos y el lado contrario cobra por ` +
        "mantener. Es la configuración que precede a una cascada de liquidaciones si el precio gira.",
      metric: annual,
    });
    return signals;
  }

  if (oiChange <= -OI_FALL_PCT) {
    signals.push({
      id: longsPay ? "funding-unwind" : "funding-unwind-shorts",
      severity: "info",
      title: "El funding es un eco: el interés abierto baja",
      detail:
        `Funding anualizado del ${pct(annual)}, pero el interés abierto cae ${pct(-oiChange / 100)} ` +
        "en 24 h. Son posiciones cerrándose: la tasa se queda alta porque tarda en normalizarse, " +
        "no porque entre dinero nuevo.",
      metric: annual,
    });
    return signals;
  }

  signals.push({
    id: "funding-elevated-flat-oi",
    severity: "watch",
    title: longsPay ? "Funding alto con interés abierto plano" : "Funding negativo con interés abierto plano",
    detail:
      `Funding anualizado del ${pct(annual)} sin movimiento apreciable del interés abierto ` +
      `(${pct(oiChange / 100)}): el coste de mantener sube por sí solo, sin flujo nuevo que lo explique.`,
    metric: annual,
  });
  return signals;
}

/**
 * Rotación y liquidez.
 *
 * El volumen sin liquidez no dice nada bueno: un mercado que mueve veinte veces
 * su profundidad al día no es un mercado profundo, es uno en el que cada orden
 * arrastra el precio. Y por debajo de la liquidez fina, el volumen suele ser
 * lo que es: volumen de ida y vuelta o de un bot.
 */
function liquiditySignals(snapshot: MarketSnapshot): MarketSignal[] {
  const signals: MarketSignal[] = [];
  const liquidity = snapshot.liquidityUsd;
  const turnover = turnoverRatio(snapshot.volume24hUsd, liquidity);

  if (positive(liquidity) && liquidity < THIN_LIQUIDITY_USD) {
    signals.push({
      id: "liquidity-thin",
      severity: "alert",
      title: "Liquidez fina",
      detail:
        `Profundidad de ${usd(liquidity)}: una orden de ${usd(maxTradeForImpact(liquidity, 1))} ` +
        "ya mueve el precio un 1 %. El precio que se ve no aguanta un tamaño normal.",
      metric: liquidity,
    });
  }

  if (turnover >= TURNOVER_ALERT) {
    signals.push({
      id: "turnover-high",
      severity: "alert",
      title: "Rotación extrema sobre la liquidez",
      detail:
        `El volumen de 24 h es ${turnover.toFixed(1)}× la liquidez disponible. Con ese ritmo, ` +
        "el precio lo marcan las órdenes que pasan, no las que esperan.",
      metric: turnover,
    });
  } else if (turnover >= TURNOVER_WATCH) {
    signals.push({
      id: "turnover-elevated",
      severity: "watch",
      title: "Rotación alta sobre la liquidez",
      detail:
        `El volumen de 24 h gira ${turnover.toFixed(1)}× sobre la liquidez. Un día normal en este ` +
        "mercado liquida varias veces su profundidad, pero conviene saber que el libro es fino.",
      metric: turnover,
    });
  }

  return signals;
}

/**
 * CEX contra DEX.
 *
 * Una diferencia de precio entre venues es normal y la arbitran bots; cuánto de
 * normal es depende de la liquidez del lado DEX, porque en un pool fino el
 * precio se puede mover a propósito. Por eso la misma base es `alert` con poca
 * liquidez y `watch` con mucha: no es el número, es cuánto cuesta moverlo.
 */
function venueSignals(snapshot: MarketSnapshot): MarketSignal[] {
  const signals: MarketSignal[] = [];
  const basis = cexDexBasisBps(snapshot.cexPrice, snapshot.dexPrice);
  const liquidity = snapshot.liquidityUsd;
  const thin = positive(liquidity) && liquidity < THIN_LIQUIDITY_USD * 4;

  if (basis !== 0) {
    const magnitude = Math.abs(basis);
    if (magnitude >= BASIS_ALERT_BPS) {
      signals.push({
        id: "basis-wide",
        severity: "alert",
        title: "Base CEX/DEX fuera de lo normal",
        detail:
          `El precio en DEX está ${basis > 0 ? "por encima" : "por debajo"} del CEX en ` +
          `${magnitude.toFixed(0)} pb. ` +
          (thin
            ? "Con la liquidez DEX de este mercado, esa diferencia se puede provocar con poco dinero: trátala como ruido hasta confirmarla."
            : "Hay espacio de arbitraje; si persiste, no es ineficiencia, es que algo impide ejecutarlo."),
        metric: basis,
      });
    } else if (magnitude >= BASIS_WATCH_BPS) {
      signals.push({
        id: "basis-wide-watch",
        severity: "watch",
        title: "Base CEX/DEX a vigilar",
        detail: `Diferencia de ${magnitude.toFixed(0)} pb entre CEX y DEX: dentro de lo arbitrable, por encima de lo habitual.`,
        metric: basis,
      });
    }
  }

  const cex = snapshot.cexVolume24hUsd;
  const dex = snapshot.dexVolume24hUsd;
  if (positive(cex) && finite(dex) && dex >= 0) {
    const total = cex + dex;
    const share = total > 0 ? dex / total : 0;
    if (share < DEX_SHARE_SMALL) {
      signals.push({
        id: "cex-dominated",
        severity: "info",
        title: "El volumen casi no pasa por DEX",
        detail:
          `Sólo el ${pct(share, 2)} del volumen está en DEX sobre ${usd(total)}. El precio DEX de este ` +
          "par informa poco: se mueve con poco dinero y no refleja al mercado.",
        metric: share,
      });
    }
  }

  return signals;
}

const SEVERITY_ORDER: Record<SignalSeverity, number> = { alert: 0, watch: 1, info: 2 };

/**
 * Todas las señales del retrato, ordenadas de más a menos urgente.
 *
 * El orden es estable (mismo retrato, mismo resultado) para que la UI no baile
 * entre renders, y nunca lanza: un retrato vacío devuelve lista vacía, que es
 * una respuesta válida —no hay nada que decir con estos datos—.
 */
export function analyzeMarket(snapshot: MarketSnapshot): MarketSignal[] {
  const signals = [
    ...fundingSignals(snapshot),
    ...liquiditySignals(snapshot),
    ...venueSignals(snapshot),
  ];
  return signals.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/**
 * Puntuación de riesgo 0–100 para ordenar mercados en una lista.
 *
 * Es una suma ponderada, no una probabilidad: `alert` 25, `watch` 10, `info` 3,
 * con tope en 100. Sirve para poner arriba lo que hay que mirar, y nada más.
 */
export function riskScore(signals: MarketSignal[]): number {
  const weights: Record<SignalSeverity, number> = { alert: 25, watch: 10, info: 3 };
  const total = signals.reduce((sum, signal) => sum + weights[signal.severity], 0);
  return Math.min(100, total);
}
