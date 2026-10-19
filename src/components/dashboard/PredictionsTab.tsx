import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Activity,
  AlarmClock,
  ChartLine as LineChart,
  ChevronDown,
  Droplets,
  ExternalLink,
  Info,
  MessageSquare,
  RefreshCw,
  Search,
  Star,
  TrendingUp,
} from "lucide-react";
import { usePolledConnector } from "@/lib/connectors";
import { Trend } from "./Trend";
import { track } from "@/lib/analytics";
import {
  PREDICTION_SOURCES,
  PREDICTION_UNAVAILABLE_SOURCES,
  fetchKalshiMarkets,
  fetchLimitlessMarkets,
  fetchManifoldMarkets,
  fetchPolymarketEventLegs,
  fetchPolymarketHistory,
  fetchPolymarketMarkets,
  formatCents,
  formatCompact,
  formatCountdown,
  formatPoints,
  formatUsd,
  type PredictionEvent,
  type PredictionOutcome,
  type PredictionSourceId,
} from "@/lib/market-data";

const REFRESH_MS = 45_000;
/** Cards rendered at once; history charts are only fetched for what is on screen. */
const PAGE_SIZE = 12;
const WATCHLIST_KEY = "aitor_prediction_watchlist";

function readWatchlist(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

type SortKey = "volume" | "liquidity" | "ending" | "move";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "volume", label: "Volumen 24h" },
  { id: "liquidity", label: "Liquidez" },
  { id: "ending", label: "Cierran pronto" },
  { id: "move", label: "Mayor movimiento" },
];

function leadMove(event: PredictionEvent): number {
  return event.outcomes.reduce((max, o) => Math.max(max, Math.abs(o.changePts ?? 0)), 0);
}

/** Lazily loads one outcome's traded price history (cached in the data layer). */
function usePriceHistory(tokenId: string | null, enabled: boolean, interval: "1d" | "1w" = "1d") {
  const [points, setPoints] = useState<number[] | null>(null);

  useEffect(() => {
    if (!tokenId || !enabled) return;
    const ctrl = new AbortController();
    fetchPolymarketHistory(tokenId, interval, ctrl.signal)
      .then((p) => {
        if (!ctrl.signal.aborted) setPoints(p);
      })
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [tokenId, enabled, interval]);

  return points;
}

function OutcomeRow({ outcome }: { outcome: PredictionOutcome }) {
  const [showChart, setShowChart] = useState(false);
  const points = usePriceHistory(outcome.tokenId, showChart, "1w");
  const pct = outcome.price * 100;
  const move = outcome.changePts;

  return (
    <div className="border-t border-border/20 first:border-t-0">
      <div className="hidden md:grid grid-cols-[minmax(0,1.5fr)_62px_62px_84px_84px_92px] items-center gap-2 px-3 py-2 hover:bg-accent/[0.04]">
        <span className="truncate text-[11px] text-foreground/85" title={outcome.label}>
          {outcome.label}
        </span>
        <div className="text-right">
          <div className="text-[11px] font-mono font-semibold text-foreground">{formatCents(outcome.price)}</div>
          <div className="text-[8px] font-mono text-muted-foreground/50">{pct.toFixed(1)}%</div>
        </div>
        <div
          className={`text-right text-[10px] font-mono ${
            move === null ? "text-muted-foreground/40" : move >= 0 ? "text-primary" : "text-destructive"
          }`}
        >
          {formatPoints(move)}
        </div>
        <div className="text-right text-[10px] font-mono text-muted-foreground/70">{formatUsd(outcome.volume24h)}</div>
        <div className="text-right text-[10px] font-mono text-cyan-300/70">{formatUsd(outcome.liquidity)}</div>
        <div className="flex items-center justify-end gap-2">
          {outcome.bestBid !== null && outcome.bestAsk !== null ? (
            <span className="text-[9px] font-mono text-muted-foreground/60" title="Best bid / ask">
              {(outcome.bestBid * 100).toFixed(1)}/{(outcome.bestAsk * 100).toFixed(1)}
            </span>
          ) : (
            <span className="text-[9px] font-mono text-muted-foreground/30">—</span>
          )}
          {outcome.tokenId && (
            <button
              type="button"
              onClick={() => setShowChart((v) => !v)}
              className={`p-1 rounded transition-colors ${showChart ? "text-primary" : "text-muted-foreground/40 hover:text-foreground/70"}`}
              title="Show traded price history"
            >
              <LineChart className="w-3 h-3" />
            </button>
          )}
          {outcome.url && (
            <a
              href={outcome.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 text-muted-foreground/40 hover:text-primary transition-colors"
              title="Abrir en la plataforma"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Mobile row: price first, venue numbers on the second line. */}
      <div className="md:hidden px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-[11px] text-foreground/85">{outcome.label}</span>
          <span className="shrink-0 text-[11px] font-mono font-semibold">{formatCents(outcome.price)}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-[9px] font-mono text-muted-foreground/60">
          <span className={move === null ? "" : move >= 0 ? "text-primary" : "text-destructive"}>
            {formatPoints(move)} pp
          </span>
          <span>Vol {formatUsd(outcome.volume24h)}</span>
          <span className="text-cyan-300/70">Liq {formatUsd(outcome.liquidity)}</span>
          {outcome.bestBid !== null && outcome.bestAsk !== null && (
            <span>
              {(outcome.bestBid * 100).toFixed(1)}/{(outcome.bestAsk * 100).toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {showChart && (
        <div className="px-3 pb-2">
          {points && points.length > 1 ? (
            <div className="flex items-center gap-2">
              <Trend points={points} className="h-8 w-full" height={28} />
              <span className="shrink-0 text-[8px] font-mono text-muted-foreground/50">
                {formatCents(points[0])} → {formatCents(points[points.length - 1])} · 1W
              </span>
            </div>
          ) : (
            <p className="text-[9px] font-mono text-muted-foreground/40">sin histórico negociado para esta opción</p>
          )}
        </div>
      )}
    </div>
  );
}

function EventCard({
  event,
  chartsEnabled,
  rank,
  watched,
  onToggleWatch,
}: {
  event: PredictionEvent;
  chartsEnabled: boolean;
  rank: number;
  watched: boolean;
  onToggleWatch: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [allLegs, setAllLegs] = useState<PredictionOutcome[] | null>(null);
  const [loadingLegs, setLoadingLegs] = useState(false);
  const [legsError, setLegsError] = useState<string | null>(null);
  const lead = event.outcomes[0];
  const points = usePriceHistory(lead?.tokenId ?? null, chartsEnabled, "1d");
  const countdown = formatCountdown(event.endDate);
  const shown = expanded && allLegs ? allLegs : event.outcomes;
  const hiddenCount = allLegs ? 0 : Math.max(0, event.outcomes.length - 12);

  const expand = async () => {
    setExpanded((v) => !v);
    if (allLegs || !event.truncated || event.source !== "polymarket") return;
    setLoadingLegs(true);
    setLegsError(null);
    try {
      const legs = await fetchPolymarketEventLegs(event.slug);
      setAllLegs(legs);
      if (!legs.length) setLegsError("the venue returned no live options for this event");
    } catch (e) {
      setLegsError(e instanceof Error ? e.message : "could not load the full option list");
    } finally {
      setLoadingLegs(false);
    }
  };

  return (
    <div className="flex flex-col rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm transition-colors hover:border-primary/25">
      <div className="flex items-start gap-3 p-3.5 pb-2.5">
        <div className="relative shrink-0">
          {event.image ? (
            <img
              src={event.image}
              alt=""
              loading="lazy"
              className="h-11 w-11 rounded-lg border border-border/30 object-cover"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border/30 bg-muted/20">
              <Activity className="h-4 w-4 text-muted-foreground/40" />
            </div>
          )}
          {chartsEnabled && points && points.length > 1 && (
            <Trend points={points} className="absolute -bottom-1 left-0 h-3 w-11" height={14} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <span className="mt-[1px] shrink-0 font-mono text-[9px] text-muted-foreground/40">#{rank + 1}</span>
            <p className="line-clamp-2 text-xs font-medium leading-relaxed text-foreground/90">{event.title}</p>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="h-4 border-border/30 px-1 text-[7px] font-mono text-muted-foreground/60">
              {event.category}
            </Badge>
            <Badge
              variant="outline"
              className="h-4 border-secondary/30 bg-secondary/5 px-1 text-[7px] font-mono text-secondary"
            >
              {PREDICTION_SOURCES.find((s) => s.id === event.source)?.label ?? event.source}
            </Badge>
            {countdown && (
              <span className="flex items-center gap-1 text-[8px] font-mono text-muted-foreground/50">
                <AlarmClock className="h-2.5 w-2.5" /> {countdown}
              </span>
            )}
            {event.comments !== null && (
              <span className="flex items-center gap-1 text-[8px] font-mono text-muted-foreground/50">
                <MessageSquare className="h-2.5 w-2.5" /> {formatCompact(event.comments)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="hidden md:grid grid-cols-[minmax(0,1.5fr)_62px_62px_84px_84px_92px] items-center gap-2 border-y border-border/25 bg-muted/10 px-3 py-1.5 text-[8px] uppercase tracking-wider text-muted-foreground/50">
        <span>Opción</span>
        <span className="text-right">Precio</span>
        <span className="text-right">24h pp</span>
        <span className="text-right">Vol 24h</span>
        <span className="text-right">Liquidez</span>
        <span className="text-right">Bid/Ask</span>
      </div>

      <div className="flex-1">
        {shown.map((outcome) => (
          <OutcomeRow key={outcome.id} outcome={outcome} />
        ))}
      </div>

      {legsError && (
        <p className="px-3 py-1.5 text-[9px] font-mono text-destructive/80">sin lista completa de opciones: {legsError}</p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/25 px-3 py-2">
        <span className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground/60">
          <TrendingUp className="h-3 w-3" /> {formatUsd(event.volume24h)} / 24h
        </span>
        <span className="flex items-center gap-1 text-[9px] font-mono text-cyan-300/70">
          <Droplets className="h-3 w-3" /> {formatUsd(event.liquidity)}
        </span>
        {event.openInterest !== null && event.openInterest > 0 && (
          <span className="text-[9px] font-mono text-muted-foreground/50">OI {formatUsd(event.openInterest)}</span>
        )}
        {event.bettors !== null && (
          <span className="text-[9px] font-mono text-muted-foreground/50">
            {formatCompact(event.bettors)} participantes
          </span>
        )}
        {(event.truncated || hiddenCount > 0) && (
          <button
            type="button"
            onClick={expand}
            className="flex items-center gap-1 text-[9px] font-mono text-secondary/80 transition-colors hover:text-secondary"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
            {expanded ? "Ver principales" : loadingLegs ? "Cargando opciones…" : "Todas las opciones"}
          </button>
        )}
        <button
          type="button"
          onClick={onToggleWatch}
          aria-pressed={watched}
          title={watched ? "Quitar de la watchlist" : "Añadir a la watchlist"}
          className={`ml-auto flex items-center gap-1 text-[9px] font-mono transition-colors ${
            watched ? "text-secondary" : "text-muted-foreground/50 hover:text-secondary"
          }`}
        >
          <Star className={`h-2.5 w-2.5 ${watched ? "fill-current" : ""}`} />
          {watched ? "En seguimiento" : "Seguir"}
        </button>
        <a
          href={event.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => event.source === "polymarket" && track("affiliate_click", { partner: "polymarket" })}
          className="flex items-center gap-1 text-[9px] font-mono text-primary/70 transition-colors hover:text-primary"
        >
          Operar <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>
    </div>
  );
}

export function PredictionsTab() {
  const [source, setSource] = useState<PredictionSourceId>("polymarket");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState<SortKey>("volume");
  const [live, setLive] = useState(true);
  const [page, setPage] = useState(1);
  const [showSources, setShowSources] = useState(false);
  const [watchlist, setWatchlist] = useState<string[]>(readWatchlist);
  const [watchOnly, setWatchOnly] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
    } catch {
      // Private mode: the watchlist simply does not survive a reload.
    }
  }, [watchlist]);

  const toggleWatch = useCallback((id: string) => {
    setWatchlist((previous) =>
      previous.includes(id) ? previous.filter((entry) => entry !== id) : [...previous, id],
    );
  }, []);

  const polymarket = usePolledConnector(
    (signal) => fetchPolymarketMarkets(90, signal),
    [] as PredictionEvent[],
    live ? REFRESH_MS : 3_600_000,
    source === "polymarket",
  );
  const kalshi = usePolledConnector(
    (signal) => fetchKalshiMarkets(40, signal),
    [] as PredictionEvent[],
    live ? REFRESH_MS : 3_600_000,
    source === "kalshi",
  );
  const manifold = usePolledConnector(
    (signal) => fetchManifoldMarkets(100, signal),
    [] as PredictionEvent[],
    live ? REFRESH_MS * 2 : 3_600_000,
    source === "manifold",
  );
  const limitless = usePolledConnector(
    (signal) => fetchLimitlessMarkets(25, signal),
    [] as PredictionEvent[],
    live ? REFRESH_MS : 3_600_000,
    source === "limitless",
  );

  const CONNECTORS = useMemo(
    () => ({ polymarket, kalshi, manifold, limitless }),
    [polymarket, kalshi, manifold, limitless],
  );
  const active = CONNECTORS[source];

  useEffect(() => {
    setPage(1);
    setCategory("All");
  }, [source, search, sort, watchOnly]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of active.data) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    return ["All", ...[...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([c]) => c)];
  }, [active.data]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows = active.data.filter((e) => {
      if (watchOnly && !watchlist.includes(e.id)) return false;
      if (category !== "All" && e.category !== category) return false;
      if (!needle) return true;
      return (
        e.title.toLowerCase().includes(needle) ||
        e.outcomes.some((o) => o.label.toLowerCase().includes(needle))
      );
    });
    return rows.sort((a, b) => {
      if (sort === "liquidity") return b.liquidity - a.liquidity;
      if (sort === "move") return leadMove(b) - leadMove(a);
      if (sort === "ending") {
        const at = a.endDate ? new Date(a.endDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bt = b.endDate ? new Date(b.endDate).getTime() : Number.MAX_SAFE_INTEGER;
        return at - bt;
      }
      return b.volume24h - a.volume24h;
    });
  }, [active.data, category, search, sort, watchOnly, watchlist]);

  const visible = filtered.slice(0, page * PAGE_SIZE);

  const stats = useMemo(() => {
    const volume24h = active.data.reduce((s, e) => s + e.volume24h, 0);
    const volumeAllTime = active.data.reduce((s, e) => s + e.volumeTotal, 0);
    // Algunos venues (Limitless) no publican volumen de 24h; se etiqueta lo que
    // sí hay en vez de enseñar un $0 engañoso.
    const useAllTime = volume24h === 0 && volumeAllTime > 0;
    const volume = useAllTime ? volumeAllTime : volume24h;
    const volumeLabel = useAllTime ? "Volumen acumulado" : "Volumen 24h";
    const liquidity = active.data.reduce((s, e) => s + e.liquidity, 0);
    const options = active.data.reduce((s, e) => s + e.outcomes.length, 0);
    const mover = active.data.reduce<PredictionEvent | null>(
      (best, e) => (best === null || leadMove(e) > leadMove(best) ? e : best),
      null,
    );
    return { volume, volumeLabel, liquidity, options, mover, markets: active.data.length };
  }, [active.data]);

  const refreshAll = useCallback(() => {
    Object.values(CONNECTORS).forEach((connector) => connector.refresh());
  }, [CONNECTORS]);

  const stale = active.lastUpdate ? Math.round((Date.now() - active.lastUpdate.getTime()) / 1000) : null;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col p-3 md:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h2 className="font-heading text-sm uppercase tracking-wider text-primary">Mercados de predicción</h2>
        <Badge variant="outline" className="h-4 border-secondary/30 bg-secondary/5 px-1 text-[7px] font-mono text-secondary">
          {live ? "EN VIVO" : "EN PAUSA"}
        </Badge>
        <span className="text-[9px] font-mono text-muted-foreground/50">
          {active.lastUpdate
            ? `actualizado hace ${stale}s · cada ${live ? REFRESH_MS / 1000 : "—"}s`
            : active.loading
              ? "cargando…"
              : "sin datos"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLive((v) => !v)}
            className={`rounded border px-2 py-1 text-[9px] font-mono uppercase tracking-wider transition-colors ${
              live
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/40 text-muted-foreground/60 hover:text-foreground"
            }`}
          >
            {live ? "Auto" : "Manual"}
          </button>
          <Button variant="outline" size="sm" onClick={refreshAll} disabled={active.loading} className="h-7 text-[10px]">
            <RefreshCw className={`mr-1 h-3 w-3 ${active.loading ? "animate-spin" : ""}`} /> Actualizar
          </Button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1">
        {PREDICTION_SOURCES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSource(s.id)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-heading uppercase tracking-wider transition-all ${
              source === s.id
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-transparent text-muted-foreground/50 hover:border-border/40 hover:text-foreground/70"
            }`}
          >
            {s.label}
            <span className="text-[8px] font-mono normal-case tracking-normal text-muted-foreground/40">{s.kind}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowSources((v) => !v)}
          className="ml-auto flex items-center gap-1 text-[9px] font-mono text-muted-foreground/40 hover:text-foreground/70"
        >
          <Info className="h-3 w-3" /> fuentes
        </button>
      </div>

      {showSources && (
        <div className="mb-3 rounded-lg border border-border/30 bg-muted/10 p-3 text-[9px] font-mono text-muted-foreground/60">
          <p className="mb-1 text-foreground/70">
            Venues en vivo (consultados desde tu navegador): {PREDICTION_SOURCES.map((s) => s.label).join(" · ")}
          </p>
          <p className="mb-1 text-foreground/70">Citadas pero no accesibles desde el navegador:</p>
          <ul className="space-y-0.5">
            {PREDICTION_UNAVAILABLE_SOURCES.map((s) => (
              <li key={s.label}>
                <span className="text-foreground/70">{s.label}</span> — {s.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          { label: stats.volumeLabel, value: formatUsd(stats.volume), tone: "text-foreground" },
          { label: "Liquidez abierta", value: formatUsd(stats.liquidity), tone: "text-cyan-300/80" },
          { label: "Mercados activos", value: `${stats.markets} · ${stats.options} opciones`, tone: "text-foreground" },
          {
            label: "Mayor movimiento",
            value: stats.mover ? `±${leadMove(stats.mover).toFixed(1)} pp` : "—",
            tone: "text-secondary",
          },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-border/35 bg-card/30 px-3 py-2">
            <p className="text-[8px] uppercase tracking-wider text-muted-foreground/50">{kpi.label}</p>
            <p className={`font-mono text-sm ${kpi.tone}`}>{kpi.value}</p>
            {kpi.label === "Mayor movimiento" && stats.mover && (
              <p className="truncate text-[8px] text-muted-foreground/50" title={stats.mover.title}>
                {stats.mover.title}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
          <Input
            placeholder="Buscar mercados y opciones…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 border-border/30 bg-muted/20 pl-8 text-xs"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setWatchOnly((value) => !value)}
            aria-pressed={watchOnly}
            title="Mercados que has marcado con la estrella"
            className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-wider transition-all ${
              watchOnly
                ? "border-secondary/50 bg-secondary/15 text-secondary"
                : "border-border/40 text-muted-foreground/50 hover:border-secondary/40 hover:text-secondary/80"
            }`}
          >
            <Star className={`h-2.5 w-2.5 ${watchOnly ? "fill-current" : ""}`} />
            Watchlist {watchlist.length > 0 && <span className="font-mono">{watchlist.length}</span>}
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              title={cat === "All" ? "Todas las categorías" : "Categoría inferida del título del mercado"}
              className={`rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-wider transition-all ${
                category === cat
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-transparent text-muted-foreground/50 hover:border-border/40 hover:text-foreground/70"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-8 rounded-md border border-border/30 bg-muted/20 px-2 text-[10px] text-foreground/80 outline-none"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id} className="bg-background">
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {active.error && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
          <p className="min-w-[220px] flex-1 text-[10px] leading-4 text-destructive/90">
            <span className="font-semibold">
              {PREDICTION_SOURCES.find((s) => s.id === source)?.label} no respondió:
            </span>{" "}
            {active.error}
            {active.data.length > 0 && " — se mantiene la última instantánea recibida."}
          </p>
          <Button variant="outline" size="sm" onClick={refreshAll} disabled={active.loading} className="h-7 text-[9px]">
            <RefreshCw className={`mr-1 h-3 w-3 ${active.loading ? "animate-spin" : ""}`} /> Reintentar
          </Button>
          {source === "polymarket" && (
            <Button variant="outline" size="sm" onClick={() => setSource("manifold")} className="h-7 text-[9px]">
              Usar Manifold
            </Button>
          )}
          <a
            href={PREDICTION_SOURCES.find((s) => s.id === source)?.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground/60 hover:text-primary"
          >
            Abrir venue <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {active.loading && active.data.length === 0 && (
          <div className="flex items-center justify-center py-14">
            <RefreshCw className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {visible.map((event, i) => (
            <EventCard
              key={event.id}
              event={event}
              chartsEnabled={i < PAGE_SIZE}
              rank={i}
              watched={watchlist.includes(event.id)}
              onToggleWatch={() => toggleWatch(event.id)}
            />
          ))}
        </div>

        {!active.loading && filtered.length === 0 && !active.error && (
          <p className="py-10 text-center text-xs text-muted-foreground/50">
            {watchOnly && watchlist.length === 0
              ? "Todavía no has marcado ningún mercado. Pulsa la estrella de una tarjeta para seguirlo."
              : "Ningún mercado coincide con este filtro."}
          </p>
        )}

        {visible.length < filtered.length && (
          <div className="my-4 flex justify-center">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} className="h-7 text-[10px]">
              Cargar {Math.min(PAGE_SIZE, filtered.length - visible.length)} más de {filtered.length}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
