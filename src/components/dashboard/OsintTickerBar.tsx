import { useEffect, useState } from "react";
import type { Earthquake } from "@/hooks/useEarthquakes";
import type { NasaEvent } from "@/hooks/useNasaEvents";
import type { TickerItem } from "@/hooks/useUnifiedIntel";

interface OsintTickerBarProps {
  tickerItems?: TickerItem[];
  earthquakes?: Earthquake[];
  nasaEvents?: NasaEvent[];
}

export function OsintTickerBar({ tickerItems = [], earthquakes = [], nasaEvents = [] }: OsintTickerBarProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const headlines: TickerItem[] = tickerItems.length > 0 ? tickerItems : (() => {
    const fallback: TickerItem[] = [];
    [...earthquakes].sort((a, b) => b.magnitude - a.magnitude).slice(0, 5).forEach(q => {
      fallback.push({
        tag: "[ALERT]",
        text: `M${q.magnitude.toFixed(1)} earthquake — ${q.place}`,
        source: "Source: USGS",
        time: new Date(q.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    });
    nasaEvents.slice(0, 3).forEach(evt => {
      fallback.push({
        tag: "[NASA]",
        text: `${evt.category}: ${evt.title}`,
        source: "Source: NASA EONET",
        time: evt.date ? new Date(evt.date).toLocaleDateString([], { month: "short", day: "numeric" }) : "Active",
      });
    });
    if (fallback.length === 0) {
      fallback.push({ tag: "[INFO]", text: "Connecting to OSINT feeds...", source: "Source: System", time: "..." });
    }
    return fallback;
  })();

  const tagColor = (sev?: TickerItem["severity"]) => {
    if (sev === "CRITICAL") return "#f87171";
    if (sev === "HIGH") return "#fb923c";
    if (sev === "MEDIUM") return "#fbbf24";
    return "#f87171";
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border-t border-slate-700/30 px-3 py-1.5 flex items-center gap-3 z-30">
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-sky-400" />
        <span className="text-[8px] font-mono uppercase tracking-wider text-slate-400">OSINT FEED</span>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <div className="flex items-center gap-6 animate-ticker whitespace-nowrap">
          {[...headlines, ...headlines].map((h, i) => (
            <div key={i} className="flex items-center gap-2 shrink-0">
              <span className="text-[9px] font-mono font-bold" style={{ color: tagColor(h.severity) }}>{h.tag}</span>
              <span className="text-[9px] font-mono text-slate-400">{h.text}</span>
              <span className="text-[8px] font-mono text-slate-600">{h.source} … {h.time}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[8px] font-mono text-slate-500">STATUS:</span>
        <span className="text-[8px] font-mono text-emerald-400 font-bold">ONLINE</span>
      </div>
    </div>
  );
}
