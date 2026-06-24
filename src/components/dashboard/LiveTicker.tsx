import { useEffect, useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import type { SpaceWeather } from "@/hooks/useSpaceWeather";
import type { Earthquake } from "@/hooks/useEarthquakes";
import type { NasaEvent } from "@/hooks/useNasaEvents";
import { useCryptoPrices } from "@/hooks/useCryptoPrices";

interface TickerItem {
  text: string;
  severity: "CRITICAL" | "HIGH" | "LOW";
  time: string;
}

const severityStyle: Record<string, string> = {
  CRITICAL: "bg-red-500/20 text-red-300 border-red-500/30",
  HIGH: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  LOW: "bg-slate-500/20 text-slate-400 border-slate-600/30",
};

interface LiveTickerProps {
  spaceWeather?: SpaceWeather;
  earthquakes?: Earthquake[];
  nasaEvents?: NasaEvent[];
}

// Static commodity reference (real-time feed would replace this).
const COMMODITIES = [
  { symbol: "XAU", price: 2410.3, change24h: 0.6, label: "Gold" },
  { symbol: "XAG", price: 30.85, change24h: -0.4, label: "Silver" },
  { symbol: "WTI", price: 78.12, change24h: 1.2, label: "Oil" },
  { symbol: "NG",  price: 2.94,  change24h: -1.8, label: "Gas" },
  { symbol: "SPX", price: 5827.4, change24h: 0.3, label: "S&P" },
  { symbol: "DXY", price: 104.6,  change24h: -0.1, label: "USD" },
];

export function LiveTicker({ spaceWeather, earthquakes = [], nasaEvents = [] }: LiveTickerProps) {
  const [lastUpdate, setLastUpdate] = useState(0);
  const prevStormRef = useRef(false);
  const { prices } = useCryptoPrices();

  const tickerItems: TickerItem[] = [];

  if (spaceWeather?.solarStorm) {
    tickerItems.push({
      text: `SOLAR RADIATION DETECTED — Radio: ${spaceWeather.radioBlackout} | Storm: ${spaceWeather.stormLevel} | Geo: ${spaceWeather.geomagneticStorm}`,
      severity: "CRITICAL", time: "NOW",
    });
  }
  if ((spaceWeather?.kpIndex || 0) > 4) {
    tickerItems.push({
      text: `TESLA CONVERGENCE — Kp Index: ${spaceWeather?.kpIndex?.toFixed(1)} — Magnetic field anomaly active`,
      severity: "CRITICAL", time: "NOW",
    });
  }

  const topQuakes = [...earthquakes].sort((a, b) => b.magnitude - a.magnitude).slice(0, 5);
  topQuakes.forEach(q => {
    tickerItems.push({
      text: `M${q.magnitude.toFixed(1)} earthquake — ${q.place}`,
      severity: q.magnitude >= 5 ? "CRITICAL" : q.magnitude >= 4 ? "HIGH" : "LOW",
      time: new Date(q.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  });

  nasaEvents.slice(0, 3).forEach(evt => {
    tickerItems.push({
      text: `${evt.category}: ${evt.title}`,
      severity: "HIGH",
      time: evt.date ? new Date(evt.date).toLocaleDateString([], { month: "short", day: "numeric" }) : "Active",
    });
  });

  if (tickerItems.length === 0) {
    tickerItems.push(
      { text: "Connecting to OSINT feeds...", severity: "LOW", time: "..." },
      { text: "Waiting for USGS seismic data...", severity: "LOW", time: "..." },
    );
  }

  useEffect(() => {
    const interval = setInterval(() => setLastUpdate((p) => p + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (spaceWeather?.solarStorm && !prevStormRef.current) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
      } catch { /* audio not available */ }
    }
    prevStormRef.current = spaceWeather?.solarStorm || false;
  }, [spaceWeather?.solarStorm]);

  // Combined market strip: crypto + commodities/indices.
  const marketRow = [
    ...prices.map(p => ({ symbol: p.symbol, price: p.price, change: p.change24h, kind: "crypto" as const })),
    ...COMMODITIES.map(c => ({ symbol: c.symbol, price: c.price, change: c.change24h, kind: "comm" as const })),
  ];

  return (
    <div className="w-full flex flex-col border-b border-slate-700/25 animate-fade-in">
      {/* ───────── Bar 1 — MARKETS (crypto + commodities) ───────── */}
      <div className="w-full flex items-center gap-3 px-3 py-1 bg-slate-950/60 backdrop-blur-xl text-[9px] border-b border-slate-700/20">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" style={{ boxShadow: '0 0 8px #34d399cc' }} />
          <span className="text-emerald-400 tracking-wider uppercase font-bold text-[9px]">MKT</span>
        </div>
        <div className="flex-1 overflow-hidden relative">
          <div className="flex items-center gap-5 animate-ticker whitespace-nowrap">
            {[...marketRow, ...marketRow].map((c, i) => {
              const up = c.change >= 0;
              return (
                <div key={i} className="flex items-center gap-1 font-mono shrink-0">
                  <span className={`font-bold text-[9px] ${c.kind === "comm" ? "text-amber-300" : "text-slate-200"}`}>{c.symbol}</span>
                  <span className="text-slate-400 text-[9px]">
                    ${c.price >= 100 ? c.price.toLocaleString(undefined, { maximumFractionDigits: 0 }) : c.price.toFixed(c.price >= 1 ? 2 : 3)}
                  </span>
                  <span className={`text-[8px] ${up ? "text-emerald-400" : "text-red-400"}`}>
                    {up ? "▲" : "▼"}{Math.abs(c.change).toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <span className="text-slate-500 font-mono text-[9px] shrink-0">{marketRow.length} SYM</span>
      </div>

      {/* ───────── Bar 2 — ALERTS / NEWS ───────── */}
      <div className="w-full flex items-center gap-3 px-3 py-1 bg-slate-900/50 backdrop-blur-xl text-[9px]">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" style={{ boxShadow: '0 0 8px #ef4444cc' }} />
          <span className="text-red-500 tracking-wider uppercase font-bold text-[9px]">LIVE</span>
        </div>
        <div className="flex-1 overflow-hidden relative">
          <div className="flex items-center gap-5 animate-ticker whitespace-nowrap">
            {[...tickerItems, ...tickerItems].map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 shrink-0">
                <Badge variant="outline" className={`text-[7px] px-1 py-0 h-3.5 rounded-md ${severityStyle[item.severity]}`}>
                  {item.severity}
                </Badge>
                <span className="text-slate-400 max-w-[320px] truncate">{item.text}</span>
                <span className="text-slate-600 font-mono text-[8px]">{item.time}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-red-400 font-bold text-[10px] font-mono">{tickerItems.length} SIG</span>
          <span className="text-slate-500 font-mono text-[10px]">{lastUpdate}s</span>
        </div>
      </div>
    </div>
  );
}
