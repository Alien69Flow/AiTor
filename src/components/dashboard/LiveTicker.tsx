import { useEffect, useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import type { SpaceWeather } from "@/hooks/useSpaceWeather";

interface TickerItem {
  text: string;
  severity: "CRITICAL" | "HIGH" | "LOW";
  time: string;
}

const BASE_TICKER: TickerItem[] = [
  { text: "BTC breaks $67,000 resistance level amid institutional buying", severity: "HIGH", time: "2M" },
  { text: "ETH/BTC ratio hits new monthly high as DeFi activity surges", severity: "HIGH", time: "5M" },
  { text: "Solana network processes 50K TPS in new benchmark test", severity: "LOW", time: "3M" },
  { text: "SEC announces new framework for crypto asset classification", severity: "CRITICAL", time: "1M" },
  { text: "ChainGPT AI oracle integration reaches 1M daily queries", severity: "HIGH", time: "4M" },
  { text: "Web3 DAO governance participation hits all-time high", severity: "HIGH", time: "3M" },
];

const severityColor = {
  CRITICAL: "bg-destructive/80 text-destructive-foreground",
  HIGH: "bg-primary/20 text-primary border-primary/30",
  LOW: "bg-muted/50 text-muted-foreground border-border/30",
};

interface LiveTickerProps {
  spaceWeather?: SpaceWeather;
}

export function LiveTicker({ spaceWeather }: LiveTickerProps) {
  const [lastUpdate, setLastUpdate] = useState(0);
  const blipRef = useRef<HTMLAudioElement | null>(null);
  const prevStormRef = useRef(false);

  // Build ticker items dynamically based on NOAA data
  const tickerItems: TickerItem[] = [...BASE_TICKER];

  if (spaceWeather?.solarStorm) {
    tickerItems.unshift({
      text: `⚡ SOLAR RADIATION DETECTED — Radio: ${spaceWeather.radioBlackout} | Storm: ${spaceWeather.stormLevel} | Geo: ${spaceWeather.geomagneticStorm}`,
      severity: "CRITICAL",
      time: "NOW",
    });
  }

  if ((spaceWeather?.kpIndex || 0) > 4) {
    tickerItems.unshift({
      text: `🧲 TESLA CONVERGENCE — Kp Index: ${spaceWeather?.kpIndex?.toFixed(1)} — Magnetic field anomaly active`,
      severity: "CRITICAL",
      time: "NOW",
    });
  }

  useEffect(() => {
    const interval = setInterval(() => setLastUpdate((p) => p + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Radar blip on new critical alert
  useEffect(() => {
    if (spaceWeather?.solarStorm && !prevStormRef.current) {
      try {
        // Generate a low-frequency radar blip using Web Audio API
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
      } catch { /* audio not available */ }
    }
    prevStormRef.current = spaceWeather?.solarStorm || false;
  }, [spaceWeather?.solarStorm]);

  return (
    <div className="w-full flex items-center gap-3 px-3 py-1 bg-card/60 border-b border-border/10 text-[9px]">
      {/* LIVE badge */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
        <span className="font-heading text-secondary tracking-wider uppercase font-bold text-[9px]">LIVE</span>
      </div>

      {/* Scrolling ticker */}
      <div className="flex-1 overflow-hidden relative">
        <div className="flex items-center gap-5 animate-ticker whitespace-nowrap">
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <div key={i} className="flex items-center gap-1.5 shrink-0">
              <Badge variant="outline" className={`text-[7px] px-1 py-0 h-3.5 ${severityColor[item.severity]}`}>
                {item.severity}
              </Badge>
              <span className="text-muted-foreground/70 max-w-[280px] truncate">{item.text}</span>
              <span className="text-muted-foreground/30 font-mono text-[8px]">{item.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Compact stats */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-primary font-bold text-[10px] font-mono">{tickerItems.length} SIG</span>
        <span className="text-foreground/50 font-mono text-[10px]">{lastUpdate}s</span>
      </div>
    </div>
  );
}
