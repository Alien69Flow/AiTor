import { useEffect, useState } from "react";
import type { Earthquake } from "@/hooks/useEarthquakes";
import type { NasaEvent } from "@/hooks/useNasaEvents";

interface OsintTickerBarProps {
  earthquakes?: Earthquake[];
  nasaEvents?: NasaEvent[];
}

interface TickerHeadline {
  tag: string;
  text: string;
  source: string;
  time: string;
}

export function OsintTickerBar({ earthquakes = [], nasaEvents = [] }: OsintTickerBarProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const headlines: TickerHeadline[] = [];

  // Real earthquake headlines
  [...earthquakes].sort((a, b) => b.magnitude - a.magnitude).slice(0, 5).forEach(q => {
    headlines.push({
      tag: "[ALERT]",
      text: `M${q.magnitude.toFixed(1)} earthquake — ${q.place}`,
      source: `Source: USGS`,
      time: new Date(q.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  });

  // NASA events
  nasaEvents.slice(0, 3).forEach(evt => {
    headlines.push({
      tag: "[ALERT]",
      text: `${evt.category}: ${evt.title}`,
      source: "Source: NASA EONET",
      time: evt.date ? new Date(evt.date).toLocaleDateString([], { month: "short", day: "numeric" }) : "Active",
    });
  });

  if (headlines.length === 0) {
    headlines.push(
      { tag: "[INFO]", text: "Connecting to OSINT feeds...", source: "Source: System", time: "..." },
    );
  }

  return (
    <div className="bg-black/80 backdrop-blur-[15px] border-t border-white/[0.06] px-3 py-1.5 flex items-center gap-3 z-30">
      {/* Label */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[8px] font-mono text-[#FF4444] font-bold">▸</span>
        <span className="text-[8px] font-mono uppercase tracking-wider text-white/30">OSINT FEED & TICKER</span>
      </div>

      {/* Headlines scrolling area */}
      <div className="flex-1 overflow-hidden relative">
        <div className="flex items-center gap-6 animate-ticker whitespace-nowrap">
          {[...headlines, ...headlines].map((h, i) => (
            <div key={i} className="flex items-center gap-2 shrink-0">
              <span className="text-[9px] font-mono font-bold text-[#FF4444]">{h.tag}</span>
              <span className="text-[9px] font-mono text-white/50">{h.text}</span>
              <span className="text-[8px] font-mono text-white/15">{h.source} … {h.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* OZONE LAYER badge */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[8px] font-mono text-white/25">OZONE LAYER:</span>
        <span className="text-[8px] font-mono text-[#00FF41] font-bold">[ONLINE]</span>
      </div>
    </div>
  );
}
