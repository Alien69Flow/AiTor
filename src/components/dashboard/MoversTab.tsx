import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
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
  image: string;
}

export function MoversTab() {
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"gainers" | "losers" | "volume">("gainers");

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
  const formatVol = (n: number) => `$${(n / 1e9).toFixed(2)}B`;

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-heading text-primary uppercase tracking-wider">Top Movers</h2>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCoins} disabled={loading} className="h-7 text-[10px]">
          <RefreshCw className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

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

      <div className="flex-1 overflow-y-auto">
        {loading && coins.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 text-primary animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/20">
                <TableHead className="text-[10px] text-muted-foreground/60">#</TableHead>
                <TableHead className="text-[10px] text-muted-foreground/60">Asset</TableHead>
                <TableHead className="text-[10px] text-muted-foreground/60 text-right">Price</TableHead>
                <TableHead className="text-[10px] text-muted-foreground/60 text-right">24h</TableHead>
                <TableHead className="text-[10px] text-muted-foreground/60 text-right hidden sm:table-cell">Volume</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.slice(0, 25).map((coin, i) => {
                const positive = coin.price_change_percentage_24h >= 0;
                return (
                  <TableRow key={coin.id} className="border-border/10 hover:bg-muted/10">
                    <TableCell className="text-[10px] text-muted-foreground/50 py-2">{i + 1}</TableCell>
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
                    <TableCell className="text-right text-[10px] font-mono text-muted-foreground/60 py-2 hidden sm:table-cell">
                      {formatVol(coin.total_volume)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
