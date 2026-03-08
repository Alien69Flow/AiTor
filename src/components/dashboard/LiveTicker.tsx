import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface TickerItem {
  text: string;
  severity: "CRITICAL" | "HIGH" | "LOW";
  time: string;
}

const TICKER_ITEMS: TickerItem[] = [
  { text: "BTC breaks $67,000 resistance level amid institutional buying", severity: "HIGH", time: "2M" },
  { text: "ETH/BTC ratio hits new monthly high as DeFi activity surges", severity: "HIGH", time: "5M" },
  { text: "Solana network processes 50K TPS in new benchmark test", severity: "LOW", time: "3M" },
  { text: "SEC announces new framework for crypto asset classification", severity: "CRITICAL", time: "1M" },
  { text: "ChainGPT AI oracle integration reaches 1M daily queries", severity: "HIGH", time: "4M" },
  { text: "Web3 DAO governance participation hits all-time high across protocols", severity: "HIGH", time: "3M" },
];

const severityColor = {
  CRITICAL: "bg-destructive/80 text-destructive-foreground",
  HIGH: "bg-primary/20 text-primary border-primary/30",
  LOW: "bg-muted/50 text-muted-foreground border-border/30",
};

export function LiveTicker() {
  const [activeSignals] = useState(18);
  const [lastUpdate, setLastUpdate] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full flex items-center gap-3 px-4 py-1.5 bg-card/60 border-b border-border/20 text-[10px]">
      {/* LIVE badge */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
        <span className="font-heading text-secondary tracking-wider uppercase font-bold">LIVE</span>
      </div>

      {/* Scrolling ticker */}
      <div className="flex-1 overflow-hidden relative">
        <div className="flex items-center gap-6 animate-ticker whitespace-nowrap">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <div key={i} className="flex items-center gap-2 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
              <Badge variant="outline" className={`text-[8px] px-1.5 py-0 h-4 ${severityColor[item.severity]}`}>
                {item.severity}
              </Badge>
              <span className="text-muted-foreground/80 max-w-[300px] truncate">{item.text}</span>
              <span className="text-muted-foreground/40 font-mono">{item.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 shrink-0 text-[10px]">
        <div className="flex flex-col items-center">
          <span className="text-primary font-bold text-sm">{activeSignals}</span>
          <span className="text-muted-foreground/50 uppercase tracking-wider">Active Signals</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-foreground/80 font-mono text-sm">{lastUpdate}s ago</span>
          <span className="text-muted-foreground/50 uppercase tracking-wider">Last Update</span>
        </div>
      </div>
    </div>
  );
}
