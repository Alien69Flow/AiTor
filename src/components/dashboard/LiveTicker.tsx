import { useEffect, useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";
import type { SpaceWeather } from "@/hooks/useSpaceWeather";
import { spaceWeatherAlert } from "@/lib/space-weather-alert";
import type { Earthquake } from "@/hooks/useEarthquakes";
import type { NasaEvent } from "@/hooks/useNasaEvents";
import type { TideObservation } from "@/hooks/connectors/useTides";
import type { IssPosition } from "@/hooks/connectors/useIssPosition";
import { Button } from "@/components/ui/button";

interface TickerItem {
  text: string;
  severity: "CRITICAL" | "HIGH" | "LOW";
  time: string;
  kind?: "OBS" | "ÓRBITA";
  source?: string;
  lat?: number;
  lon?: number;
}

const severityStyle: Record<string, string> = {
  CRITICAL: "bg-destructive/20 text-destructive border-destructive/30",
  HIGH: "bg-secondary/20 text-secondary border-secondary/30",
  LOW: "bg-muted/20 text-muted-foreground border-border",
};

interface LiveTickerProps {
  spaceWeather?: SpaceWeather;
  earthquakes?: Earthquake[];
  nasaEvents?: NasaEvent[];
  tides?: TideObservation[];
  iss?: IssPosition | null;
  onLocate?: (lat: number, lon: number) => void;
}

export function LiveTicker({ spaceWeather, earthquakes = [], nasaEvents = [], tides = [], iss, onLocate }: LiveTickerProps) {
  const [lastUpdate, setLastUpdate] = useState(0);
  const prevStormRef = useRef(false);

  const tickerItems: TickerItem[] = [];

  // Una sola entrada de clima espacial, con la escala que de verdad está
  // activa (R/S/G) y su gravedad: la barra anunciaba «radiación solar» para
  // cualquier tormenta y la marcaba siempre CRITICAL.
  const weatherAlert = spaceWeather ? spaceWeatherAlert(spaceWeather) : null;
  if (weatherAlert) {
    tickerItems.push({ ...weatherAlert, time: "NOW" });
  }

  const topQuakes = [...earthquakes].sort((a, b) => b.magnitude - a.magnitude).slice(0, 5);
  topQuakes.forEach(q => {
    tickerItems.push({
      text: `M${q.magnitude.toFixed(1)} earthquake — ${q.place}`,
      severity: q.magnitude >= 5 ? "CRITICAL" : q.magnitude >= 4 ? "HIGH" : "LOW",
      time: new Date(q.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      source: "USGS / EMSC",
    });
  });

  nasaEvents.slice(0, 3).forEach(evt => {
    tickerItems.push({
      text: `${evt.category}: ${evt.title}`,
      severity: "HIGH",
      time: evt.date ? new Date(evt.date).toLocaleDateString([], { month: "short", day: "numeric" }) : "Active",
    });
  });

  tides.filter(t => Date.now() - Date.parse(t.time) < 3600000).forEach(t => tickerItems.push({
    text: `Marea · ${t.name}: ${t.heightM.toFixed(2)} m MLLW${t.provisional ? " · provisional" : ""}`,
    severity: "LOW", kind: "OBS", source: t.source,
    time: new Date(t.time).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC", lat: t.lat, lon: t.lon,
  }));
  if (iss && Number.isFinite(iss.lat) && Number.isFinite(iss.lon) && iss.measuredAt > 0 && Date.now() - iss.measuredAt * 1000 < 60000) tickerItems.push({
    text: `ISS · ${iss.altKm.toFixed(0)} km · ${iss.lat.toFixed(1)}°, ${iss.lon.toFixed(1)}°`, severity: "LOW", kind: "ÓRBITA", source: "WhereTheISS.at · posición propagada",
    time: new Date(iss.measuredAt * 1000).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC", lat: iss.lat, lon: iss.lon,
  });

  useEffect(() => {
    const interval = setInterval(() => setLastUpdate((p) => p + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (spaceWeather?.solarStorm && !prevStormRef.current) {
      try {
        const AudioContextCtor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) return;
        const ctx = new AudioContextCtor();
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
    <div className="w-full h-9 flex items-center gap-3 bg-destructive/5 backdrop-blur-xl border-t border-destructive/25 text-[9px] overflow-hidden">
      <div className="h-full flex items-center gap-2 shrink-0 px-3 md:px-4 bg-destructive/10 border-r border-destructive/25">
        <Activity className="w-3.5 h-3.5 text-destructive" />
        <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
        <span className="text-destructive tracking-wider uppercase font-bold text-[9px]">LIVE ALERTS</span>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {tickerItems.length === 0 && <span className="text-muted-foreground">Sin alertas verificadas</span>}
        <div className="flex items-center gap-5 animate-ticker whitespace-nowrap">
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <div key={i} className="flex items-center gap-1.5 shrink-0">
              <Badge variant="outline" className={`text-[7px] px-1 py-0 h-3.5 rounded-md ${severityStyle[item.severity]}`}>
                {item.kind ?? item.severity}
              </Badge>
              {item.lat !== undefined && item.lon !== undefined ? <Button variant="ghost" size="sm" className="h-6 max-w-[280px] truncate px-1 text-[9px] text-muted-foreground" title={item.source} onClick={() => { if (item.lat !== undefined && item.lon !== undefined) onLocate?.(item.lat, item.lon); }}>{item.text}</Button> : <span title={item.source} className="text-muted-foreground max-w-[280px] truncate">{item.text}</span>}
              <span className="text-muted-foreground font-mono text-[8px]">{item.time}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className="text-primary font-bold text-[10px] font-mono">{tickerItems.length} SIG</span>
        <span className="text-muted-foreground font-mono text-[10px]">{lastUpdate}s</span>
      </div>
    </div>
  );
}
