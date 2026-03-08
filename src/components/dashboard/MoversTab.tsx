import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, TrendingDown, BarChart3, Star, LayoutGrid, List } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CoinData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  total_volume: number;
  market_cap: number;
  market_cap_rank: number;
  image: string;
  sparkline_in_7d?: { price: number[] };
  ath?: number;
  atl?: number;
  circulating_supply?: number;
  total_supply?: number;
}

function MiniSparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 60;
  const h = 20;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={points} fill="none" stroke={positive ? "hsl(var(--secondary))" : "hsl(var(--destructive))"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Squarified treemap algorithm
function squarify(items: { coin: CoinData; value: number }[], x: number, y: number, w: number, h: number): { coin: CoinData; x: number; y: number; w: number; h: number }[] {
  if (items.length === 0) return [];
  if (items.length === 1) return [{ coin: items[0].coin, x, y, w, h }];

  const total = items.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return [];

  const results: { coin: CoinData; x: number; y: number; w: number; h: number }[] = [];
  let cx = x, cy = y;
  const isHorizontal = w >= h;

  for (const item of items) {
    const ratio = item.value / total;
    if (isHorizontal) {
      const iw = w * ratio;
      results.push({ coin: item.coin, x: cx, y: cy, w: iw, h });
      cx += iw;
    } else {
      const ih = h * ratio;
      results.push({ coin: item.coin, x: cx, y: cy, w, h: ih });
      cy += ih;
    }
  }
  return results;
}

function changeToColor(pct: number): string {
  const clamped = Math.max(-15, Math.min(15, pct));
  const t = (clamped + 15) / 30; // 0 = deep red, 1 = deep green
  const r = Math.round(255 * (1 - t));
  const g = Math.round(200 * t);
  const b = Math.round(40 + 20 * (1 - Math.abs(t - 0.5) * 2));
  return `rgb(${r}, ${g}, ${b})`;
}

function TreemapHeatmap({ coins }: { coins: CoinData[] }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rects = useMemo(() => {
    const items = coins.slice(0, 30).map(c => ({ coin: c, value: Math.max(c.market_cap, 1) }));
    return squarify(items, 0, 0, 100, 100);
  }, [coins]);

  const selected = selectedId ? coins.find(c => c.id === selectedId) : null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 relative min-h-[300px]">
        {rects.map((r) => {
          const pct = r.coin.price_change_percentage_24h;
          const positive = pct >= 0;
          const isHovered = hoveredId === r.coin.id;
          const isSelected = selectedId === r.coin.id;
          const showLabel = r.w > 5 && r.h > 6;

          return (
            <div
              key={r.coin.id}
              className="absolute transition-all duration-200 cursor-pointer border border-background/20 overflow-hidden flex flex-col items-center justify-center"
              style={{
                left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%`,
                backgroundColor: changeToColor(pct),
                opacity: isHovered ? 1 : 0.85,
                zIndex: isHovered || isSelected ? 10 : 1,
                outline: isSelected ? "2px solid hsl(var(--primary))" : "none",
              }}
              onMouseEnter={() => setHoveredId(r.coin.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => setSelectedId(isSelected ? null : r.coin.id)}
            >
              {showLabel && (
                <>
                  <span className="text-[11px] font-mono font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] leading-none">
                    {r.coin.symbol.toUpperCase()}
                  </span>
                  <span className="text-[9px] font-mono text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] leading-none mt-0.5">
                    {positive ? "+" : ""}{pct.toFixed(1)}%
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected coin detail */}
      {selected && (
        <div className="p-3 bg-card/80 border-t border-border/20 flex items-center gap-4 text-[10px]">
          <img src={selected.image} alt={selected.symbol} className="w-6 h-6 rounded-full" />
          <div>
            <span className="font-bold text-foreground">{selected.name}</span>
            <span className="text-muted-foreground ml-2">{selected.symbol.toUpperCase()}</span>
          </div>
          <div className="ml-auto flex gap-4">
            <div><span className="text-muted-foreground">Price:</span> <span className="font-mono text-foreground">${selected.current_price.toLocaleString()}</span></div>
            <div><span className="text-muted-foreground">MCap:</span> <span className="font-mono text-foreground">${(selected.market_cap / 1e9).toFixed(1)}B</span></div>
            <div className={`font-mono font-bold ${selected.price_change_percentage_24h >= 0 ? "text-secondary" : "text-destructive"}`}>
              {selected.price_change_percentage_24h >= 0 ? "+" : ""}{selected.price_change_percentage_24h.toFixed(2)}%
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-1 py-1.5 text-[8px] text-muted-foreground/50">
        <span className="w-3 h-2 rounded-sm" style={{ background: changeToColor(-15) }} />
        <span>-15%</span>
        <span className="w-3 h-2 rounded-sm" style={{ background: changeToColor(0) }} />
        <span>0%</span>
        <span className="w-3 h-2 rounded-sm" style={{ background: changeToColor(15) }} />
        <span>+15%</span>
        <span className="ml-2">Size = Market Cap</span>
      </div>
    </div>
  );
}

export function MoversTab() {
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"gainers" | "losers" | "volume">("gainers");
  const [mode, setMode] = useState<"list" | "heatmap">("heatmap");
  const [watchlist, setWatchlist] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("alienflow-watchlist");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const toggleWatchlist = (id: string) => {
    setWatchlist(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("alienflow-watchlist", JSON.stringify([...next]));
      return next;
    });
  };

  const fetchCoins = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("crypto-feed", {
        body: { action: "movers" },
      });
      if (error) throw error;
      setCoins(data?.coins || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to fetch market data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCoins(); }, []);
  useEffect(() => {
    const interval = setInterval(fetchCoins, 60000);
    return () => clearInterval(interval);
  }, []);

  const sorted = [...coins].sort((a, b) => {
    if (view === "gainers") return b.price_change_percentage_24h - a.price_change_percentage_24h;
    if (view === "losers") return a.price_change_percentage_24h - b.price_change_percentage_24h;
    return b.total_volume - a.total_volume;
  });

  const formatPrice = (n: number) => n >= 1 ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : `$${n.toFixed(6)}`;
  const formatVol = (n: number) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    return `$${(n / 1e3).toFixed(0)}K`;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-heading text-primary uppercase tracking-wider">Top Movers</h2>
          <Badge variant="outline" className="text-[7px] font-mono border-secondary/30 text-secondary bg-secondary/5">LIVE</Badge>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMode("heatmap")} className={`p-1.5 rounded transition-colors ${mode === "heatmap" ? "bg-primary/20 text-primary" : "text-muted-foreground/40 hover:text-foreground/60"}`} title="Heatmap">
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setMode("list")} className={`p-1.5 rounded transition-colors ${mode === "list" ? "bg-primary/20 text-primary" : "text-muted-foreground/40 hover:text-foreground/60"}`} title="List">
            <List className="w-3.5 h-3.5" />
          </button>
          <Button variant="outline" size="sm" onClick={fetchCoins} disabled={loading} className="h-7 text-[10px] ml-1">
            <RefreshCw className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {mode === "list" && (
        <div className="flex gap-1 mb-3">
          {(["gainers", "losers", "volume"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 text-[10px] font-heading uppercase tracking-wider rounded-sm transition-colors ${
                view === v ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground/60 hover:text-foreground/80"
              }`}
            >
              {v === "gainers" ? "🚀 Gainers" : v === "losers" ? "📉 Losers" : "📊 Volume"}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && coins.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 text-primary animate-spin" />
          </div>
        ) : mode === "heatmap" ? (
          <TreemapHeatmap coins={sorted.length > 0 ? sorted : coins} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/20">
                <TableHead className="text-[10px] text-muted-foreground/60 w-6"></TableHead>
                <TableHead className="text-[10px] text-muted-foreground/60">#</TableHead>
                <TableHead className="text-[10px] text-muted-foreground/60">Asset</TableHead>
                <TableHead className="text-[10px] text-muted-foreground/60 text-right">Price</TableHead>
                <TableHead className="text-[10px] text-muted-foreground/60 text-right">24h</TableHead>
                <TableHead className="text-[10px] text-muted-foreground/60 text-right hidden sm:table-cell">7d</TableHead>
                <TableHead className="text-[10px] text-muted-foreground/60 text-right hidden sm:table-cell">Volume</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.slice(0, 25).map((coin, i) => {
                const positive = coin.price_change_percentage_24h >= 0;
                const isExpanded = expandedRow === coin.id;
                return (
                  <>
                    <TableRow key={coin.id} className="border-border/10 hover:bg-muted/10 cursor-pointer" onClick={() => setExpandedRow(isExpanded ? null : coin.id)}>
                      <TableCell className="py-2 w-6">
                        <button onClick={(e) => { e.stopPropagation(); toggleWatchlist(coin.id); }} className="p-0.5">
                          <Star className={`w-3 h-3 transition-colors ${watchlist.has(coin.id) ? "text-primary fill-primary" : "text-muted-foreground/20 hover:text-muted-foreground/50"}`} />
                        </button>
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground/50 py-2">{coin.market_cap_rank || i + 1}</TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <img src={coin.image} alt={coin.symbol} className="w-5 h-5 rounded-full" />
                          <div>
                            <span className="text-xs font-bold text-foreground/90">{coin.symbol.toUpperCase()}</span>
                            <span className="text-[9px] text-muted-foreground/50 ml-1 hidden sm:inline">{coin.name}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-foreground/80 py-2">{formatPrice(coin.current_price)}</TableCell>
                      <TableCell className="text-right py-2">
                        <div className="flex items-center justify-end gap-0.5">
                          {positive ? <TrendingUp className="w-3 h-3 text-secondary" /> : <TrendingDown className="w-3 h-3 text-destructive" />}
                          <span className={`text-xs font-mono font-bold ${positive ? "text-secondary" : "text-destructive"}`}>
                            {positive ? "+" : ""}{coin.price_change_percentage_24h.toFixed(2)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-2 hidden sm:table-cell">
                        {coin.sparkline_in_7d?.price ? <MiniSparkline data={coin.sparkline_in_7d.price} positive={positive} /> : <span className="text-[9px] text-muted-foreground/30">—</span>}
                      </TableCell>
                      <TableCell className="text-right text-[10px] font-mono text-muted-foreground/60 py-2 hidden sm:table-cell">{formatVol(coin.total_volume)}</TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${coin.id}-detail`} className="border-border/10 bg-muted/5">
                        <TableCell colSpan={7} className="py-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px]">
                            <div><span className="text-muted-foreground/50">Market Cap</span><p className="font-mono text-foreground/80">{formatVol(coin.market_cap)}</p></div>
                            {coin.ath && <div><span className="text-muted-foreground/50">ATH</span><p className="font-mono text-foreground/80">{formatPrice(coin.ath)}</p></div>}
                            {coin.atl && <div><span className="text-muted-foreground/50">ATL</span><p className="font-mono text-foreground/80">{formatPrice(coin.atl)}</p></div>}
                            {coin.circulating_supply && <div><span className="text-muted-foreground/50">Circulating</span><p className="font-mono text-foreground/80">{(coin.circulating_supply / 1e6).toFixed(1)}M</p></div>}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
