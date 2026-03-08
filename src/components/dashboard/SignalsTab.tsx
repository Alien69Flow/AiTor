import { useState, useEffect } from "react";
import { Zap, RefreshCw, TrendingUp, TrendingDown, ExternalLink, Filter, LayoutGrid, LayoutList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PolymarketEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  yesPrice: string | null;
  noPrice: string | null;
  volume: number;
  totalVolume: number;
  endDate: string | null;
  image: string | null;
  slug: string | null;
  source: string;
}

interface TrendingCoin {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  priceChange24h: number;
  sparkline: string;
  image: string;
  marketCap: string;
  volume: string;
  source: string;
}

const CATEGORIES = ["All", "Crypto", "Politics", "Sports", "Tech", "World"];

const getImpactLevel = (volume: number): { label: string; className: string } => {
  if (volume > 1000000) return { label: "Critical", className: "border-destructive/50 text-destructive bg-destructive/10" };
  if (volume > 500000) return { label: "High", className: "border-primary/50 text-primary bg-primary/10" };
  if (volume > 100000) return { label: "Medium", className: "border-secondary/50 text-secondary bg-secondary/10" };
  return { label: "Low", className: "border-muted-foreground/30 text-muted-foreground bg-muted/20" };
};

const formatVolume = (n: number) => {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

export function SignalsTab() {
  const [polymarket, setPolymarket] = useState<PolymarketEvent[]>([]);
  const [trending, setTrending] = useState<TrendingCoin[]>([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("All");
  const [view, setView] = useState<"list" | "grid">("list");
  const [tab, setTab] = useState<"predictions" | "trending">("predictions");

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("crypto-signals", {
        body: { action: "all" },
      });
      if (error) throw error;
      setPolymarket(data?.polymarket || []);
      setTrending(data?.trending || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to fetch signals data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    const interval = setInterval(fetchData, 120000);
    return () => clearInterval(interval);
  }, []);

  const filteredMarkets = category === "All" ? polymarket : polymarket.filter(e => e.category?.toLowerCase().includes(category.toLowerCase()));

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Zap className="w-4 h-4 text-primary" />
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-secondary animate-pulse" />
          </div>
          <h2 className="text-sm font-heading text-primary uppercase tracking-wider">Live Signals</h2>
          <Badge variant="outline" className="text-[7px] font-mono border-secondary/30 text-secondary bg-secondary/5">LIVE</Badge>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setView(view === "list" ? "grid" : "list")} className="p-1.5 rounded text-muted-foreground/40 hover:text-foreground/60 transition-colors">
            {view === "list" ? <LayoutGrid className="w-3.5 h-3.5" /> : <LayoutList className="w-3.5 h-3.5" />}
          </button>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="h-7 text-[10px]">
            <RefreshCw className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-3">
        {(["predictions", "trending"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-[10px] font-heading uppercase tracking-wider rounded-sm transition-colors ${
              tab === t ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground/60 hover:text-foreground/80"
            }`}
          >
            {t === "predictions" ? "📊 Prediction Markets" : "🔥 Trending Crypto"}
          </button>
        ))}
      </div>

      {/* Category filters */}
      {tab === "predictions" && (
        <div className="flex gap-1 mb-3 flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-2.5 py-1 text-[9px] font-mono rounded-full transition-all ${
                category === cat
                  ? "bg-secondary/20 text-secondary border border-secondary/30"
                  : "text-muted-foreground/50 hover:text-foreground/70 border border-transparent hover:border-border/40"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && polymarket.length === 0 && trending.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 text-primary animate-spin" />
          </div>
        )}

        {tab === "predictions" && (
          <div className={view === "grid" ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "space-y-2"}>
            {filteredMarkets.map((event) => {
              const yesPercent = event.yesPrice ? Math.round(parseFloat(event.yesPrice) * 100) : null;
              const noPercent = event.noPrice ? Math.round(parseFloat(event.noPrice) * 100) : null;
              const impact = getImpactLevel(event.volume);
              return (
                <div key={event.id} className="p-4 rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm hover:bg-card/50 hover:border-primary/20 transition-all">
                  <div className="flex items-start gap-3">
                    {event.image && (
                      <img src={event.image} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 border border-border/30" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium text-foreground/90 line-clamp-2 leading-relaxed">{event.title}</p>
                        <Badge variant="outline" className={`text-[7px] px-1.5 py-0 h-4 font-mono shrink-0 ${impact.className}`}>
                          {impact.label}
                        </Badge>
                      </div>

                      {/* YES/NO bars */}
                      {yesPercent !== null && noPercent !== null && (
                        <div className="mt-3 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono text-secondary w-7">YES</span>
                            <div className="flex-1 h-2 bg-muted/20 rounded-full overflow-hidden">
                              <div className="h-full bg-secondary/80 rounded-full transition-all" style={{ width: `${yesPercent}%` }} />
                            </div>
                            <span className="text-[10px] font-mono font-bold text-secondary w-8 text-right">{yesPercent}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono text-destructive w-7">NO</span>
                            <div className="flex-1 h-2 bg-muted/20 rounded-full overflow-hidden">
                              <div className="h-full bg-destructive/60 rounded-full transition-all" style={{ width: `${noPercent}%` }} />
                            </div>
                            <span className="text-[10px] font-mono font-bold text-destructive w-8 text-right">{noPercent}%</span>
                          </div>
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-3">
                          <span className="text-[8px] font-mono text-muted-foreground/40">Vol: {formatVolume(event.volume)}</span>
                          {event.category && (
                            <Badge variant="outline" className="text-[7px] px-1 py-0 h-3.5 font-mono border-border/30 text-muted-foreground/50">
                              {event.category}
                            </Badge>
                          )}
                        </div>
                        {event.slug && (
                          <a
                            href={`https://polymarket.com/event/${event.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[8px] font-mono text-primary/60 hover:text-primary transition-colors"
                          >
                            Trade <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {!loading && filteredMarkets.length === 0 && (
              <p className="text-xs text-muted-foreground/50 text-center py-8">No prediction markets found. Try refreshing.</p>
            )}
          </div>
        )}

        {tab === "trending" && (
          <div className="space-y-2">
            {trending.map((coin) => {
              const positive = coin.priceChange24h >= 0;
              return (
                <div key={coin.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm hover:bg-card/50 transition-all">
                  {coin.image && <img src={coin.image} alt="" className="w-7 h-7 rounded-full shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-bold text-foreground/90">{coin.title}</p>
                    <p className="text-[9px] text-muted-foreground/50">{coin.description}</p>
                  </div>
                  {coin.priceChange24h !== undefined && (
                    <div className="flex items-center gap-1 shrink-0">
                      {positive ? <TrendingUp className="w-3 h-3 text-secondary" /> : <TrendingDown className="w-3 h-3 text-destructive" />}
                      <span className={`text-xs font-mono font-bold ${positive ? "text-secondary" : "text-destructive"}`}>
                        {positive ? "+" : ""}{coin.priceChange24h?.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
            {!loading && trending.length === 0 && (
              <p className="text-xs text-muted-foreground/50 text-center py-8">No trending data. Try refreshing.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
