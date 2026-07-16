import { useState } from "react";
import { ChevronUp, ChevronDown, Compass } from "lucide-react";

interface Region {
  label: string;
  flag: string;
  lat: number;
  lng: number;
  altitude: number;
}

// Wide regions (macro fly-to).
const REGIONS: Region[] = [
  { label: "Europe", flag: "🇪🇺", lat: 48, lng: 10, altitude: 2.0 },
  { label: "Middle East", flag: "🇸🇦", lat: 28, lng: 45, altitude: 1.8 },
  { label: "Americas", flag: "🇺🇸", lat: 35, lng: -90, altitude: 2.5 },
  { label: "Asia", flag: "🇨🇳", lat: 35, lng: 105, altitude: 2.2 },
  { label: "Africa", flag: "🇿🇦", lat: 5, lng: 20, altitude: 2.3 },
  { label: "Oceania", flag: "🇦🇺", lat: -25, lng: 135, altitude: 2.2 },
];

// Country / hotspot pins — closer altitude for tactical drill-down.
const HOTSPOTS: Region[] = [
  { label: "España", flag: "🇪🇸", lat: 40.4, lng: -3.7, altitude: 0.9 },
  { label: "France", flag: "🇫🇷", lat: 46.6, lng: 2.5, altitude: 0.9 },
  { label: "United Kingdom", flag: "🇬🇧", lat: 54.0, lng: -2.0, altitude: 0.9 },
  { label: "Russia", flag: "🇷🇺", lat: 61.5, lng: 90.0, altitude: 2.2 },
  { label: "Israel", flag: "🇮🇱", lat: 31.5, lng: 34.8, altitude: 0.6 },
  { label: "Iran", flag: "🇮🇷", lat: 32.4, lng: 53.7, altitude: 1.2 },
  { label: "Ukraine", flag: "🇺🇦", lat: 48.4, lng: 31.2, altitude: 1.0 },
  { label: "Taiwan", flag: "🇹🇼", lat: 23.7, lng: 121.0, altitude: 0.6 },
  { label: "Kashmir", flag: "🇮🇳", lat: 34.0, lng: 76.5, altitude: 0.6 },
];

const glass = "bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl";

interface NavigatePanelProps {
  onNavigate?: (lat: number, lng: number, altitude: number) => void;
}

export function NavigatePanel({ onNavigate }: NavigatePanelProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className={`${glass} w-[260px] overflow-hidden`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-2.5">
        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-medium">
          <Compass className="w-3 h-3 inline mr-1.5" />Navigate
        </span>
        {open ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
      </button>
      {open && (
        <div className="px-3.5 pb-3.5 space-y-2.5">
          {/* Region flags row */}
          <div className="flex items-center gap-2">
            {REGIONS.map(r => (
              <button
                key={r.label}
                onClick={() => onNavigate?.(r.lat, r.lng, r.altitude)}
                className="text-base hover:scale-125 transition-transform"
                title={r.label}
              >
                {r.flag}
              </button>
            ))}
          </div>

          {/* Country / hotspot pins */}
          <div>
            <div className="text-[8px] uppercase tracking-wider text-slate-500 mb-1.5 px-0.5">
              Hotspots
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {HOTSPOTS.map(r => (
                <button
                  key={r.label}
                  onClick={() => onNavigate?.(r.lat, r.lng, r.altitude)}
                  className="text-sm hover:scale-125 transition-transform bg-slate-800/25 border border-slate-700/25 rounded-md py-1"
                  title={r.label}
                >
                  {r.flag}
                </button>
              ))}
            </div>
          </div>

          {/* Category status list */}
          <div className="space-y-1.5">
            {[
              { label: "Markets", color: "#34d399" },
              { label: "Receptoor", color: "#34d399" },
              { label: "Cryptooon", color: "#34d399" },
              { label: "Flameus", color: "#fbbf24" },
              { label: "Noertior", color: "#34d399" },
              { label: "Cryptfiaa", color: "#34d399" },
              { label: "Convergence", color: "#e2e8f0" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-[8px] px-2 py-1 bg-slate-800/20 border border-slate-700/20 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: item.color, boxShadow: `0 0 6px ${item.color}60` }} />
                <span className="text-slate-400">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
