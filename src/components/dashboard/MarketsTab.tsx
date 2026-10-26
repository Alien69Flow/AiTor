import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowDownUp,
  Banknote,
  Boxes,
  Building2,
  CandlestickChart,
  Coins,
  Droplets,
  ExternalLink,
  Globe,
  Landmark,
  RefreshCw,
  Rocket,
  Search,
  Waves,
} from "lucide-react";
import { useCryptoPrices } from "@/hooks/useCryptoPrices";
import { usePolledConnector } from "@/lib/connectors";
import { Trend } from "./Trend";
import {
  ADEX_URL,
  fetchAggregatorVenues,
  fetchAlienDexTokens,
  fetchCexVenues,
  fetchDexPools,
  fetchDexVenues,
  fetchFxRates,
  fetchGlobalCrypto,
  fetchHyperliquidPerps,
  fetchMetals,
  fetchOptionsVenues,
  fetchTreasuryCurve,
  formatCompact,
  formatPct,
  formatPoints,
  formatPrice,
  formatUsd,
  type VenueVolume,
} from "@/lib/market-data";

const QUICK_QUERIES = ["ETH", "SOL", "WBTC", "USDC", "AERO", "PEPE"];

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  tone = "text-primary",
  right,
}: {
  icon: typeof Coins;
  title: string;
  subtitle?: string;
  tone?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <Icon className={`h-3.5 w-3.5 ${tone}`} />
      <h3 className="font-heading text-[11px] uppercase tracking-wider text-foreground/85">{title}</h3>
      {subtitle && <span className="text-[9px] font-mono text-muted-foreground/45">{subtitle}</span>}
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border/35 bg-card/30 p-3 backdrop-blur-sm ${className}`}>{children}</div>
  );
}

function StatusLine({ loading, error, lastUpdate }: { loading: boolean; error: string | null; lastUpdate: Date | null }) {
  if (error) return <span className="text-[8px] font-mono text-destructive/70">{error}</span>;
  if (loading) return <span className="text-[8px] font-mono text-muted-foreground/45">cargando…</span>;
  if (!lastUpdate) return null;
  const secs = Math.round((Date.now() - lastUpdate.getTime()) / 1000);
  return <span className="text-[8px] font-mono text-muted-foreground/45">actualizado hace {secs}s</span>;
}

/** Volume leaderboard row with a share bar. */
function VenueRow({ venue, max, extra }: { venue: VenueVolume; max: number; extra?: string }) {
  const width = max > 0 ? Math.max(2, (venue.volume24h / max) * 100) : 0;
  return (
    <a
      href={venue.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block px-1 py-1.5 transition-colors hover:bg-accent/[0.05]"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[10px] text-foreground/85 group-hover:text-primary">{venue.name}</span>
        <span className="shrink-0 font-mono text-[10px] text-foreground/70">{formatUsd(venue.volume24h)}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted/25">
          <div className="h-full rounded-full bg-primary/50" style={{ width: `${width}%` }} />
        </div>
        <span
          className={`w-14 shrink-0 text-right font-mono text-[8px] ${
            venue.change1d === null ? "text-muted-foreground/40" : venue.change1d >= 0 ? "text-primary" : "text-destructive"
          }`}
        >
          {venue.change1d === null ? "—" : `${formatPct(venue.change1d)} 24h`}
        </span>
      </div>
      {(extra || venue.chains.length > 0) && (
        <p className="mt-0.5 truncate text-[8px] font-mono text-muted-foreground/40">
          {extra || venue.chains.slice(0, 4).join(" · ")}
        </p>
      )}
    </a>
  );
}

function Leaderboard({
  icon,
  title,
  subtitle,
  rows,
  loading,
  error,
  lastUpdate,
  total,
}: {
  icon: typeof Coins;
  title: string;
  subtitle: string;
  rows: VenueVolume[];
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  total: number;
}) {
  const max = rows.length ? rows[0].volume24h : 0;
  return (
    <Panel>
      <SectionHeader
        icon={icon}
        title={title}
        subtitle={subtitle}
        right={<StatusLine loading={loading} error={error} lastUpdate={lastUpdate} />}
      />
      <p className="mb-1 font-mono text-lg text-foreground/90">{formatUsd(total)}</p>
      <p className="mb-2 text-[8px] uppercase tracking-wider text-muted-foreground/45">notional 24h</p>
      <div className="divide-y divide-border/15">
        {rows.slice(0, 8).map((venue) => (
          <VenueRow key={venue.name} venue={venue} max={max} />
        ))}
        {!loading && rows.length === 0 && !error && (
          <p className="py-3 text-[9px] font-mono text-muted-foreground/45">ningún venue reportó datos</p>
        )}
      </div>
    </Panel>
  );
}

export function MarketsTab() {
  const [query, setQuery] = useState("ETH");
  const [live, setLive] = useState(true);
  const [poolSort, setPoolSort] = useState<"liquidity" | "volume">("liquidity");
  const { prices } = useCryptoPrices(live ? 60_000 : 3_600_000);

  const dexPools = usePolledConnector((signal) => fetchDexPools(query, signal), [], live ? 30_000 : 3_600_000, true);
  const dexVenues = usePolledConnector((signal) => fetchDexVenues(signal), [], live ? 300_000 : 3_600_000, true);
  const aggregators = usePolledConnector((signal) => fetchAggregatorVenues(signal), [], live ? 300_000 : 3_600_000, true);
  const optionsVenues = usePolledConnector((signal) => fetchOptionsVenues(signal), [], live ? 600_000 : 3_600_000, true);
  const global = usePolledConnector((signal) => fetchGlobalCrypto(signal), null, live ? 120_000 : 3_600_000, true);
  const cex = usePolledConnector((signal) => fetchCexVenues(signal), [], live ? 300_000 : 3_600_000, true);
  const fx = usePolledConnector((signal) => fetchFxRates(signal), null, live ? 900_000 : 3_600_000, true);
  const treasury = usePolledConnector((signal) => fetchTreasuryCurve(signal), null, live ? 900_000 : 3_600_000, true);
  const metals = usePolledConnector((signal) => fetchMetals(signal), [], live ? 90_000 : 3_600_000, true);
  const perps = usePolledConnector((signal) => fetchHyperliquidPerps(signal), [], live ? 60_000 : 3_600_000, true);
  const adex = usePolledConnector((signal) => fetchAlienDexTokens(signal), [], live ? 120_000 : 3_600_000, true);

  // Re-run the pool search when the query changes (debounced).
  useEffect(() => {
    const id = window.setTimeout(() => dexPools.refresh(), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const btcPrice = prices.find((p) => p.symbol === "BTC")?.price ?? 0;

  const poolTotals = useMemo(() => {
    const liquidity = dexPools.data.reduce((s, p) => s + p.liquidityUsd, 0);
    const volume = dexPools.data.reduce((s, p) => s + p.volume24h, 0);
    const chains = new Set(dexPools.data.map((p) => p.chain));
    const dexes = new Set(dexPools.data.map((p) => p.dex));
    return { liquidity, volume, chains: chains.size, dexes: dexes.size };
  }, [dexPools.data]);

  const sortedPools = useMemo(
    () =>
      [...dexPools.data].sort((a, b) =>
        poolSort === "volume" ? b.volume24h - a.volume24h : b.liquidityUsd - a.liquidityUsd,
      ),
    [dexPools.data, poolSort],
  );

  const refreshAll = () => {
    dexPools.refresh();
    dexVenues.refresh();
    aggregators.refresh();
    optionsVenues.refresh();
    global.refresh();
    cex.refresh();
    fx.refresh();
    treasury.refresh();
    metals.refresh();
    perps.refresh();
    adex.refresh();
  };

  const g = global.data;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col p-3 md:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Coins className="h-4 w-4 text-primary" />
        <h2 className="font-heading text-sm uppercase tracking-wider text-primary">Multi-Market Terminal</h2>
        <Badge variant="outline" className="h-4 border-secondary/30 bg-secondary/5 px-1 text-[7px] font-mono text-secondary">
          {live ? "LIVE" : "PAUSED"}
        </Badge>
        <span className="text-[9px] font-mono text-muted-foreground/50">
          DEX · AMM · aggregators · CEX · FX · rates · metals
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
          <Button variant="outline" size="sm" onClick={refreshAll} className="h-7 text-[10px]">
            <RefreshCw className="mr-1 h-3 w-3" /> Refresh
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {/* Global crypto context */}
        <Panel>
          <SectionHeader
            icon={Globe}
            title="Cripto global"
            subtitle="CoinGecko"
            right={<StatusLine loading={global.loading} error={global.error} lastUpdate={global.lastUpdate} />}
          />
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {[
              { label: "Capitalización", value: formatUsd(g?.marketCap, 2), tone: "text-foreground" },
              { label: "Volumen 24h", value: formatUsd(g?.volume24h, 2), tone: "text-foreground" },
              {
                label: "Cambio 24h",
                value: formatPct(g?.change24h),
                tone: (g?.change24h ?? 0) >= 0 ? "text-primary" : "text-destructive",
              },
              { label: "Dominancia BTC", value: `${(g?.btcDominance ?? 0).toFixed(1)}%`, tone: "text-secondary" },
              { label: "Activos activos", value: formatCompact(g?.activeCoins), tone: "text-foreground" },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-lg border border-border/25 bg-muted/10 px-2.5 py-1.5">
                <p className="text-[8px] uppercase tracking-wider text-muted-foreground/45">{kpi.label}</p>
                <p className={`font-mono text-xs ${kpi.tone}`}>{kpi.value}</p>
              </div>
            ))}
          </div>
        </Panel>

        {/* DEX / AMM pools across every venue */}
        <Panel>
          <SectionHeader
            icon={Waves}
            title="DEX · AMM · liquidez"
            subtitle={`${poolTotals.dexes} venues · ${poolTotals.chains} cadenas · ${dexPools.data.length} pools`}
            right={<StatusLine loading={dexPools.loading} error={dexPools.error} lastUpdate={dexPools.lastUpdate} />}
          />
          <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
              <Input
                placeholder="Cualquier token o par, con precio en todos los DEX indexados…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 border-border/30 bg-muted/20 pl-8 text-xs"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {QUICK_QUERIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuery(q)}
                  className={`rounded-full border px-2.5 py-1 font-mono text-[9px] transition-colors ${
                    query === q
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border/30 text-muted-foreground/55 hover:text-foreground/80"
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] font-mono text-muted-foreground/55">
            <span className="flex items-center gap-1">
              <Droplets className="h-3 w-3 text-cyan-400/60" /> liquidez agrupada {formatUsd(poolTotals.liquidity)}
            </span>
            <span className="flex items-center gap-1">
              <ArrowDownUp className="h-3 w-3 text-primary/60" /> volumen 24h {formatUsd(poolTotals.volume)}
            </span>
            <span className="text-muted-foreground/40">DexScreener · todos los pools para esa búsqueda</span>
            <div className="flex items-center gap-1 md:ml-auto">
              {(
                [
                  { id: "liquidity", label: "Por profundidad" },
                  { id: "volume", label: "Por volumen 24h" },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPoolSort(option.id)}
                  className={`rounded-full border px-2 py-0.5 font-mono text-[9px] transition-colors ${
                    poolSort === option.id
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border/30 text-muted-foreground/50 hover:text-foreground/80"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden md:grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_70px_100px_100px_80px_28px] items-center gap-2 border-y border-border/25 bg-muted/10 px-2 py-1.5 text-[8px] uppercase tracking-wider text-muted-foreground/50">
            <span>Par</span>
            <span>Venue</span>
            <span className="text-right">Tipo</span>
            <span className="text-right">Liquidez</span>
            <span className="text-right">Vol 24h</span>
            <span className="text-right">24h</span>
            <span />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {sortedPools.slice(0, 40).map((pool) => (
              <div
                key={pool.id}
                className="grid grid-cols-[minmax(0,1fr)_90px_64px_28px] items-center gap-2 border-b border-border/15 px-2 py-1.5 hover:bg-accent/[0.04] md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_70px_100px_100px_80px_28px]"
              >
                <div className="min-w-0">
                  <p className="truncate text-[11px] text-foreground/85">{pool.pair}</p>
                  <p className="truncate text-[8px] font-mono text-muted-foreground/45">
                    {pool.chain} · {formatPrice(pool.priceUsd, 4)}
                  </p>
                </div>
                <span className="hidden truncate font-mono text-[9px] capitalize text-secondary/70 md:block">
                  {pool.dex}
                </span>
                <span className="hidden text-right font-mono text-[9px] text-muted-foreground/50 md:block">
                  {pool.kind}
                </span>
                <span className="hidden text-right font-mono text-[10px] text-cyan-300/70 md:block">
                  {formatUsd(pool.liquidityUsd)}
                </span>
                <span className="text-right font-mono text-[10px] text-foreground/70">{formatUsd(pool.volume24h)}</span>
                <span
                  className={`text-right font-mono text-[10px] ${
                    (pool.change24h ?? 0) >= 0 ? "text-primary" : "text-destructive"
                  }`}
                >
                  {formatPct(pool.change24h)}
                </span>
                <a
                  href={pool.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="justify-self-end p-1 text-muted-foreground/40 transition-colors hover:text-primary"
                  title="Abrir pool"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
            {!dexPools.loading && dexPools.data.length === 0 && (
              <p className="py-6 text-center text-[10px] font-mono text-muted-foreground/45">
                {dexPools.error ? `consulta fallida: ${dexPools.error}` : "sin pools para esa búsqueda"}
              </p>
            )}
          </div>
        </Panel>

        {/* Volume leaderboards */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Leaderboard
            icon={Boxes}
            title="Volumen DEX spot"
            subtitle="DefiLlama · todas las cadenas"
            rows={dexVenues.data}
            loading={dexVenues.loading}
            error={dexVenues.error}
            lastUpdate={dexVenues.lastUpdate}
            total={dexVenues.data.reduce((s, v) => s + v.volume24h, 0)}
          />
          <Leaderboard
            icon={ArrowDownUp}
            title="Agregadores de liquidez"
            subtitle="routers y meta-agregadores"
            rows={aggregators.data}
            loading={aggregators.loading}
            error={aggregators.error}
            lastUpdate={aggregators.lastUpdate}
            total={aggregators.data.reduce((s, v) => s + v.volume24h, 0)}
          />
          <Leaderboard
            icon={Banknote}
            title="Venues de opciones"
            subtitle="notional de opciones on-chain"
            rows={optionsVenues.data}
            loading={optionsVenues.loading}
            error={optionsVenues.error}
            lastUpdate={optionsVenues.lastUpdate}
            total={optionsVenues.data.reduce((s, v) => s + v.volume24h, 0)}
          />
        </div>

        {/* CEX spot */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Panel>
            <SectionHeader
              icon={Coins}
              title="Precios spot"
              subtitle="CoinGecko · 24h"
              right={<span className="text-[8px] font-mono text-muted-foreground/45">{prices.length} activos</span>}
            />
            <div className="grid grid-cols-1 gap-x-4 gap-y-0 sm:grid-cols-2">
              {prices.map((coin) => (
                <div
                  key={coin.id}
                  className="flex items-center justify-between gap-2 border-b border-border/15 py-1.5 last:border-b-0"
                >
                  <span className="font-mono text-[10px] font-semibold text-foreground/85">{coin.symbol}</span>
                  <span className="font-mono text-[10px] text-muted-foreground/70">
                    {formatPrice(coin.price, coin.price < 1 ? 4 : 2)}
                  </span>
                  <span
                    className={`w-14 text-right font-mono text-[10px] ${
                      coin.change24h >= 0 ? "text-primary" : "text-destructive"
                    }`}
                  >
                    {formatPct(coin.change24h)}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionHeader
              icon={Building2}
              title="Venues centralizados"
              subtitle="volumen spot 24h"
              right={<StatusLine loading={cex.loading} error={cex.error} lastUpdate={cex.lastUpdate} />}
            />
            <div className="divide-y divide-border/15">
              {cex.data.slice(0, 10).map((venue) => (
                <a
                  key={venue.id}
                  href={venue.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 py-1.5 transition-colors hover:bg-accent/[0.05]"
                >
                  <span className="min-w-0 flex-1 truncate text-[10px] text-foreground/85">{venue.name}</span>
                  <span className="shrink-0 font-mono text-[9px] text-muted-foreground/45">
                    {formatCompact(venue.volume24hBtc)} BTC
                  </span>
                  <span className="w-20 shrink-0 text-right font-mono text-[10px] text-foreground/70">
                    {btcPrice ? formatUsd(venue.volume24hBtc * btcPrice) : "—"}
                  </span>
                  {venue.trustScore !== null && (
                    <span
                      className={`w-9 shrink-0 text-right font-mono text-[9px] ${
                        venue.trustScore >= 8 ? "text-primary/80" : "text-muted-foreground/45"
                      }`}
                      title="CoinGecko trust score"
                    >
                      T{venue.trustScore}
                    </span>
                  )}
                </a>
              ))}
              {!cex.loading && cex.data.length === 0 && (
                <p className="py-3 text-[9px] font-mono text-muted-foreground/45">no exchange data</p>
              )}
            </div>
          </Panel>
        </div>

        {/* Traditional markets */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Panel>
            <SectionHeader
              icon={Globe}
              title="FX majors"
              subtitle={fx.data ? `ECB · ${fx.data.date}` : "ECB reference rates"}
              right={<StatusLine loading={fx.loading} error={fx.error} lastUpdate={fx.lastUpdate} />}
            />
            <div className="divide-y divide-border/15">
              {(fx.data?.rates ?? []).map((rate) => (
                <div key={rate.pair} className="flex items-center gap-2 py-1.5">
                  <span className="w-16 shrink-0 font-mono text-[10px] text-foreground/85">{rate.pair}</span>
                  <Trend points={rate.series} className="h-4 w-12 shrink-0" height={16} />
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">
                    {rate.rate.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </span>
                  <span
                    className={`w-14 shrink-0 text-right font-mono text-[10px] ${
                      (rate.changePct ?? 0) >= 0 ? "text-primary" : "text-destructive"
                    }`}
                  >
                    {formatPct(rate.changePct)}
                  </span>
                </div>
              ))}
              {!fx.loading && !fx.data && (
                <p className="py-3 text-[9px] font-mono text-muted-foreground/45">
                  {fx.error ? `BCE no disponible: ${fx.error}` : "cargando tipos de referencia…"}
                </p>
              )}
            </div>
          </Panel>

          <Panel>
            <SectionHeader
              icon={Landmark}
              title="US Treasury curve"
              subtitle={treasury.data ? `official · ${treasury.data.date}` : "official daily par yields"}
              right={<StatusLine loading={treasury.loading} error={treasury.error} lastUpdate={treasury.lastUpdate} />}
            />
            <div className="divide-y divide-border/15">
              {(treasury.data?.points ?? []).map((point) => (
                <div key={point.label} className="flex items-center gap-2 py-1.5">
                  <span className="w-12 shrink-0 font-mono text-[10px] text-foreground/85">{point.label}</span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted/25">
                    <div
                      className="h-full rounded-full bg-secondary/50"
                      style={{ width: `${Math.min(100, (point.yieldPct / 6) * 100)}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right font-mono text-[10px] text-muted-foreground/75">
                    {point.yieldPct.toFixed(2)}%
                  </span>
                  <span
                    className={`w-14 shrink-0 text-right font-mono text-[9px] ${
                      (point.changeBp ?? 0) >= 0 ? "text-primary/80" : "text-destructive/80"
                    }`}
                  >
                    {point.changeBp === null ? "—" : `${formatPoints(point.changeBp, 1)}bp`}
                  </span>
                </div>
              ))}
              {!treasury.loading && !treasury.data && (
                <p className="py-3 text-[9px] font-mono text-muted-foreground/45">
                  {treasury.error ? `curva del Tesoro no disponible: ${treasury.error}` : "cargando curva…"}
                </p>
              )}
            </div>
          </Panel>

          <Panel>
            <SectionHeader
              icon={Banknote}
              title="Metales spot"
              subtitle="USD por onza troy"
              right={<StatusLine loading={metals.loading} error={metals.error} lastUpdate={metals.lastUpdate} />}
            />
            <div className="divide-y divide-border/15">
              {metals.data.map((metal) => (
                <div key={metal.symbol} className="flex items-center gap-2 py-1.5">
                  <span className="w-10 shrink-0 font-mono text-[10px] text-secondary/80">{metal.symbol}</span>
                  <span className="truncate text-[10px] text-foreground/70">{metal.name}</span>
                  <span className="ml-auto font-mono text-[10px] text-foreground/85">{formatPrice(metal.price)}</span>
                </div>
              ))}
              {!metals.loading && metals.data.length === 0 && (
                <p className="py-3 text-[9px] font-mono text-muted-foreground/45">
                  {metals.error ? `feed de metales no disponible: ${metals.error}` : "cargando metales…"}
                </p>
              )}
            </div>
          </Panel>
        </div>

        {/* Perps + venue propio */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Panel className="lg:col-span-2">
            <SectionHeader
              icon={CandlestickChart}
              title="Perps Hyperliquid"
              subtitle="mark · funding 8h · OI · notional 24h"
              tone="text-cyan-300/80"
              right={<StatusLine loading={perps.loading} error={perps.error} lastUpdate={perps.lastUpdate} />}
            />
            <div className="hidden md:grid grid-cols-[70px_minmax(0,1fr)_80px_100px_100px_60px] items-center gap-2 border-y border-border/25 bg-muted/10 px-2 py-1.5 text-[8px] uppercase tracking-wider text-muted-foreground/50">
              <span>Activo</span>
              <span className="text-right">Mark</span>
              <span className="text-right">Funding</span>
              <span className="text-right">OI</span>
              <span className="text-right">Vol 24h</span>
              <span className="text-right">Máx</span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {perps.data.slice(0, 12).map((perp) => (
                <div
                  key={perp.asset}
                  className="grid grid-cols-[70px_minmax(0,1fr)_80px_100px] items-center gap-2 border-b border-border/15 px-2 py-1.5 hover:bg-accent/[0.04] md:grid-cols-[70px_minmax(0,1fr)_80px_100px_100px_60px]"
                >
                  <span className="truncate font-mono text-[10px] font-semibold text-foreground/85">{perp.asset}</span>
                  <span className="text-right font-mono text-[10px] text-foreground/75">{formatPrice(perp.markPrice, 4)}</span>
                  <span
                    className={`text-right font-mono text-[10px] ${
                      perp.fundingBp === null
                        ? "text-muted-foreground/40"
                        : perp.fundingBp >= 0
                          ? "text-primary"
                          : "text-destructive"
                    }`}
                  >
                    {perp.fundingBp === null ? "—" : `${formatPoints(perp.fundingBp, 2)}bp`}
                  </span>
                  <span className="text-right font-mono text-[10px] text-cyan-300/70">
                    {formatUsd(perp.openInterestUsd)}
                  </span>
                  <span className="text-right font-mono text-[10px] text-foreground/70">{formatUsd(perp.notional24h)}</span>
                  <span className="hidden text-right font-mono text-[9px] text-muted-foreground/50 md:block">
                    {perp.maxLeverage === null ? "—" : `${perp.maxLeverage}×`}
                  </span>
                </div>
              ))}
              {!perps.loading && perps.data.length === 0 && (
                <p className="py-6 text-center text-[9px] font-mono text-muted-foreground/45">
                  {perps.error ? `perps no disponibles: ${perps.error}` : "cargando perps…"}
                </p>
              )}
            </div>
          </Panel>

          <Panel>
            <SectionHeader
              icon={Rocket}
              title="AlienDEX · ADEX"
              subtitle="activos listados en adex.alienflow.space"
              tone="text-[#00E5FF]"
              right={<StatusLine loading={adex.loading} error={adex.error} lastUpdate={adex.lastUpdate} />}
            />
            <div className="divide-y divide-border/15">
              {adex.data.map((token) => (
                <div key={token.symbol} className="flex items-center gap-2 py-1.5">
                  <span className="w-10 shrink-0 font-mono text-[10px] text-secondary/80">{token.symbol}</span>
                  <span className="truncate text-[10px] text-foreground/70">{token.name}</span>
                  <span className="ml-auto font-mono text-[10px] text-foreground/85">
                    {token.priceUsd === null ? "—" : formatPrice(token.priceUsd, token.priceUsd < 1 ? 4 : 2)}
                  </span>
                  <span
                    className={`w-14 shrink-0 text-right font-mono text-[10px] ${
                      (token.change24h ?? 0) >= 0 ? "text-primary" : "text-destructive"
                    }`}
                  >
                    {formatPct(token.change24h)}
                  </span>
                </div>
              ))}
              {!adex.loading && adex.data.length === 0 && (
                <p className="py-3 text-[9px] font-mono text-muted-foreground/45">
                  {adex.error ? `precios no disponibles: ${adex.error}` : "cargando activos de ADEX…"}
                </p>
              )}
            </div>
            <p className="mt-2 text-[8px] font-mono leading-relaxed text-muted-foreground/40">
              ADEX aún no expone API de mercado propia; precios vía CoinGecko (la misma fuente que usa la app).
            </p>
            <a
              href={ADEX_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-mono text-[#00E5FF]/70 transition-colors hover:text-[#00E5FF]"
            >
              Operar en AlienDEX <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </Panel>
        </div>

        <p className="pb-2 text-[8px] font-mono leading-relaxed text-muted-foreground/40">
          Fuentes consultadas desde el navegador: DexScreener (pools DEX/AMM) · DefiLlama (DEX, agregadores, opciones) ·
          CoinGecko (spot, exchanges, global, activos de ADEX) · Hyperliquid (perps) · tipos del BCE · curva del Tesoro de
          EE. UU. · metales de gold-api · Polymarket, Kalshi y Limitless via proxy de mismo origen /api/predictions. Cadencia: pools
          30s · perps 60s · spot 60s · ADEX 2min · volúmenes 5min · FX y tipos 15min · predicciones 45s.
        </p>
      </div>
    </div>
  );
}
