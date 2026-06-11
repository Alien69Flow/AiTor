import { useEffect, useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import type { SpaceWeather } from "@/hooks/useSpaceWeather";
import type { Earthquake } from "@/hooks/useEarthquakes";
import type { NasaEvent } from "@/hooks/useNasaEvents";

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

export function LiveTicker({ spaceWeather, earthquakes = [], nasaEvents = [] }: LiveTickerProps) {
  const [lastUpdate, setLastUpdate] = useState(0);
  const prevStormRef = useRef(false);

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

  return (
    <div className="w-full flex items-center gap-3 px-3 py-1 bg-slate-900/50 backdrop-blur-xl border-b border-slate-700/25 text-[9px]">
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" style={{ boxShadow: '0 0 8px #38bdf880' }} />
        <span className="text-sky-400 tracking-wider uppercase font-bold text-[9px]">LIVE</span>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <div className="flex items-center gap-5 animate-ticker whitespace-nowrap">
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <div key={i} className="flex items-center gap-1.5 shrink-0">
              <Badge variant="outline" className={`text-[7px] px-1 py-0 h-3.5 rounded-md ${severityStyle[item.severity]}`}>
                {item.severity}
              </Badge>
              <span className="text-slate-400 max-w-[280px] truncate">{item.text}</span>
              <span className="text-slate-600 font-mono text-[8px]">{item.time}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sky-400 font-bold text-[10px] font-mono">{tickerItems.length} SIG</span>
        <span className="text-slate-500 font-mono text-[10px]">{lastUpdate}s</span>
      </div>
    </div>
  );
}
