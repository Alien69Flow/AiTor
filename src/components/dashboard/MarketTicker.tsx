import { TrendingUp } from "lucide-react";
import type { CryptoPrice } from "@/hooks/useCryptoPrices";

export function MarketTicker({ prices }: { prices: CryptoPrice[] }) {
  const rows = prices.length ? prices : [];
  return (
    <div className="h-9 w-full flex items-center overflow-hidden border-t border-accent/30 bg-background/95 backdrop-blur-xl font-mono">
      <div className="h-full shrink-0 flex items-center gap-2 border-r border-accent/30 bg-accent/10 px-3 md:px-4">
        <TrendingUp className="h-3.5 w-3.5 text-accent" />
        <span className="text-[9px] font-bold uppercase tracking-wider text-accent">Live markets</span>
        <span className="hidden sm:inline text-[8px] text-muted-foreground">{rows.length} ASSETS</span>
      </div>
      <div className="relative min-w-0 flex-1 overflow-hidden group">
        <div className="flex w-max items-center gap-7 px-5 whitespace-nowrap animate-ticker group-hover:[animation-play-state:paused]">
          {[...rows, ...rows].map((coin, index) => (
            <div key={`${coin.id}-${index}`} className="flex shrink-0 items-baseline gap-2 text-[10px]">
              <span className="font-bold text-accent">{coin.symbol}</span>
              <span className="text-foreground/80">${coin.price.toLocaleString(undefined, { maximumFractionDigits: coin.price < 1 ? 4 : 2 })}</span>
              <span className={coin.change24h >= 0 ? "text-primary" : "text-destructive"}>
                {coin.change24h >= 0 ? "+" : ""}{coin.change24h.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
