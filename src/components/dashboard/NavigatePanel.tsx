import { useState } from "react";
import { ChevronUp, ChevronDown, Compass } from "lucide-react";

interface Region {
  label: string;
  flag: string;
  lat: number;
  lng: number;
  altitude: number;
}

const REGIONS: Region[] = [
  { label: "Middle East", flag: "🇸🇦", lat: 28, lng: 45, altitude: 1.8 },
  { label: "Europe", flag: "🇪🇺", lat: 48, lng: 10, altitude: 2.0 },
  { label: "Americas", flag: "🇺🇸", lat: 35, lng: -90, altitude: 2.5 },
  { label: "Asia", flag: "🇨🇳", lat: 35, lng: 105, altitude: 2.2 },
  { label: "Africa", flag: "🇿🇦", lat: 5, lng: 20, altitude: 2.3 },
  { label: "Oceania", flag: "🇦🇺", lat: -25, lng: 135, altitude: 2.2 },
];

const glass = "bg-black/60 backdrop-blur-[20px] border border-white/[0.06] rounded-lg";

interface NavigatePanelProps {
  onNavigate?: (lat: number, lng: number, altitude: number) => void;
}

export function NavigatePanel({ onNavigate }: NavigatePanelProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className={`${glass} w-[260px] overflow-hidden`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3 py-2">
        <span className="text-[9px] font-mono uppercase tracking-wider text-white/30">
          <Compass className="w-3 h-3 inline mr-1" />NAVIGATE
        </span>
        {open ? <ChevronUp className="w-3 h-3 text-white/20" /> : <ChevronDown className="w-3 h-3 text-white/20" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {/* Region flags row */}
          <div className="flex items-center gap-1.5">
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

          {/* Category status list */}
          <div className="space-y-1">
            {[
              { label: "Markets", color: "#00FF41" },
              { label: "Receptoor", color: "#00FF41" },
              { label: "Cryptooon", color: "#00FF41" },
              { label: "Flameus", color: "#FFD700" },
              { label: "Noertior", color: "#00FF41" },
              { label: "Cryptfiaa", color: "#00FF41" },
              { label: "Convergence", color: "#FFFFFF" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5 text-[8px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: item.color }} />
                <span className="text-white/40">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1 text-[7px] font-mono text-white/15">
            <span>Acvt</span>
            <span>■</span>
            <span>■</span>
            <span className="ml-auto">· 0 reports</span>
          </div>
        </div>
      )}
    </div>
  );
}
