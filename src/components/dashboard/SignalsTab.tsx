import { useState, useEffect } from "react";
import { Zap, RefreshCw, TrendingUp, TrendingDown, LayoutGrid, LayoutList, LineChart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

/**
 * Señales de mercado: solo tendencias reales de CoinGecko (via crypto-signals
 * con action "trending"). Las predicciones ya viven en la pestaña Predictions
 * —antes también se duplicaban aquí—, así que esta vista no las replica.
 */
const getImpactLevel = (change: number): { label: string; className: string } => {
  const abs = Math.abs(change);
  if (abs >= 10) return { label: "Critical", className: "border-destructive/50 text-destructive bg-destructive/10" };
  if (abs >= 5) return { label: "High", className: "border-primary/50 text-primary bg-primary/10" };
  if (abs >= 2) return { label: "Medium", className: "border-secondary/50 text-secondary bg-secondary/10" };
  return { label: "Low", className: "border-muted-foreground/30 text-muted-foreground bg-muted/20" };
};

export function SignalsTab() {
  const [trending, setTrending] = useState<TrendingCoin[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"list" | "grid">("list");

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("crypto-signals", {
        body: { action: "trending" },
      });
      if (error) throw error;
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
          <span className="text-[9px] font-mono text-muted-foreground/50">Trending · CoinGecko</span>
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && trending.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 text-primary animate-spin" />
          </div>
        )}

        <div className={view === "grid" ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "space-y-2"}>
          {trending.map((coin) => {
            const positive = coin.priceChange24h >= 0;
            const impact = getImpactLevel(coin.priceChange24h ?? 0);
            return (
              <div key={coin.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm hover:bg-card/50 transition-all">
                {coin.image && <img src={coin.image} alt="" className="w-7 h-7 rounded-full shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-foreground/90 truncate">{coin.title}</p>
                    <Badge variant="outline" className={`text-[7px] px-1.5 py-0 h-4 font-mono shrink-0 ${impact.className}`}>
                      {impact.label}
                    </Badge>
                  </div>
                  <p className="text-[9px] text-muted-foreground/50 truncate">{coin.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {coin.price !== undefined && coin.price > 0 && (
                    <span className="text-[10px] font-mono text-foreground/70">
                      ${coin.price < 1 ? coin.price.toFixed(6) : coin.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  )}
                  {coin.priceChange24h !== undefined && (
                    <div className="flex items-center gap-1">
                      {positive ? <TrendingUp className="w-3 h-3 text-secondary" /> : <TrendingDown className="w-3 h-3 text-destructive" />}
                      <span className={`text-xs font-mono font-bold ${positive ? "text-secondary" : "text-destructive"}`}>
                        {positive ? "+" : ""}{coin.priceChange24h?.toFixed(1)}%
                      </span>
                    </div>
                  )}
                  {Array.isArray((coin as { sparkline_in_7d?: { price: number[] } }).sparkline_in_7d?.price) && (
                    <LineChart className="w-3 h-3 text-muted-foreground/40" />
                  )}
                </div>
              </div>
            );
          })}
          {!loading && trending.length === 0 && (
            <p className="text-xs text-muted-foreground/50 text-center py-8">No trending data. Try refreshing.</p>
          )}
        </div>
      </div>
    </div>
  );
}
