import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, ExternalLink, Search, TrendingUp, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Market {
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
}

const CATEGORIES = ["All", "Politics", "Crypto", "Sports", "Tech", "Culture", "World"];

const formatVolume = (n: number | null | undefined) => {
  const val = typeof n === 'number' && !isNaN(n) ? n : 0;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
};

export function MarketsTab() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");

  const fetchMarkets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("crypto-signals", {
        body: { action: "polymarket" },
      });
      if (error) throw error;
      setMarkets(data?.polymarket || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to fetch markets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMarkets(); }, []);

  const filtered = markets.filter(m => {
    const matchCat = category === "All" || m.category?.toLowerCase().includes(category.toLowerCase());
    const matchSearch = !search || m.title.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-heading text-primary uppercase tracking-wider">Markets Browser</h2>
          <Badge variant="outline" className="text-[7px] font-mono border-secondary/30 text-secondary bg-secondary/5">LIVE</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={fetchMarkets} disabled={loading} className="h-7 text-[10px]">
          <RefreshCw className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
        <Input
          placeholder="Search markets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 pl-8 text-xs bg-muted/20 border-border/30"
        />
      </div>

      {/* Category pills */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 text-[10px] font-heading uppercase tracking-wider rounded-full transition-all ${
              category === cat
                ? "bg-primary/20 text-primary border border-primary/30"
                : "text-muted-foreground/50 hover:text-foreground/70 border border-transparent hover:border-border/40"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Markets grid */}
      <div className="flex-1 overflow-y-auto">
        {loading && markets.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 text-primary animate-spin" />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((market) => {
            const yesPercent = market.yesPrice ? Math.round(parseFloat(market.yesPrice) * 100) : null;
            const noPercent = market.noPrice ? Math.round(parseFloat(market.noPrice) * 100) : null;
            return (
              <div
                key={market.id}
                className="p-4 rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm hover:bg-card/50 hover:border-primary/20 transition-all flex flex-col"
              >
                <div className="flex items-start gap-3 mb-3">
                  {market.image && (
                    <img src={market.image} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 border border-border/30" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground/90 line-clamp-2 leading-relaxed">{market.title}</p>
                    {market.category && (
                      <Badge variant="outline" className="text-[7px] px-1 py-0 h-3.5 font-mono border-border/30 text-muted-foreground/50 mt-1">
                        {market.category}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* YES/NO bars */}
                {yesPercent !== null && noPercent !== null && (
                  <div className="space-y-1.5 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-secondary w-7">YES</span>
                      <div className="flex-1 h-2.5 bg-muted/20 rounded-full overflow-hidden">
                        <div className="h-full bg-secondary/80 rounded-full transition-all" style={{ width: `${yesPercent}%` }} />
                      </div>
                      <span className="text-[11px] font-mono font-bold text-secondary w-10 text-right">{yesPercent}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-destructive w-7">NO</span>
                      <div className="flex-1 h-2.5 bg-muted/20 rounded-full overflow-hidden">
                        <div className="h-full bg-destructive/60 rounded-full transition-all" style={{ width: `${noPercent}%` }} />
                      </div>
                      <span className="text-[11px] font-mono font-bold text-destructive w-10 text-right">{noPercent}%</span>
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/20">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-3 h-3 text-muted-foreground/40" />
                    <span className="text-[9px] font-mono text-muted-foreground/50">Vol: {formatVolume(market.totalVolume || market.volume)}</span>
                  </div>
                  {market.slug && (
                    <a
                      href={`https://polymarket.com/event/${market.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[9px] font-mono text-primary/60 hover:text-primary transition-colors"
                    >
                      Trade <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {!loading && filtered.length === 0 && (
          <p className="text-xs text-muted-foreground/50 text-center py-8">No markets found.</p>
        )}
      </div>
    </div>
  );
}
