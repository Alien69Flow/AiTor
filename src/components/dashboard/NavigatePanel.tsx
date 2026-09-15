import { useState } from "react";
import { ChevronUp, ChevronDown, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Region {
  label: string;
  flag: string;
  lat: number;
  lng: number;
  altitude: number;
}

const REGIONS: Region[] = [
  { label: "DAO HQ — Zaragoza", flag: "🛸", lat: 41.65, lng: -0.88, altitude: 0.9 },
  { label: "Spain", flag: "🇪🇸", lat: 40.4, lng: -3.7, altitude: 1.2 },
  { label: "France", flag: "🇫🇷", lat: 46.6, lng: 2.4, altitude: 1.3 },
  { label: "United Kingdom", flag: "🇬🇧", lat: 54.0, lng: -2.5, altitude: 1.3 },
  { label: "Germany", flag: "🇩🇪", lat: 51.2, lng: 10.4, altitude: 1.3 },
  { label: "Europe", flag: "🇪🇺", lat: 48, lng: 10, altitude: 2.0 },
  { label: "Ukraine", flag: "🇺🇦", lat: 48.4, lng: 31.2, altitude: 1.4 },
  { label: "Russia", flag: "🇷🇺", lat: 58.0, lng: 60.0, altitude: 2.6 },
  { label: "Israel", flag: "🇮🇱", lat: 31.5, lng: 34.9, altitude: 1.0 },
  { label: "Iran", flag: "🇮🇷", lat: 32.4, lng: 53.7, altitude: 1.7 },
  { label: "Middle East", flag: "🇸🇦", lat: 28, lng: 45, altitude: 1.8 },
  { label: "United States", flag: "🇺🇸", lat: 39, lng: -98, altitude: 2.2 },
  { label: "Americas / LatAm", flag: "🇧🇷", lat: -12, lng: -55, altitude: 2.4 },
  { label: "China", flag: "🇨🇳", lat: 35, lng: 105, altitude: 2.2 },
  { label: "Taiwan", flag: "🇹🇼", lat: 23.7, lng: 121, altitude: 1.0 },
  { label: "India", flag: "🇮🇳", lat: 22, lng: 79, altitude: 2.0 },
  { label: "Korean Peninsula", flag: "🇰🇷", lat: 37.5, lng: 127.5, altitude: 1.2 },
  { label: "Africa", flag: "🇿🇦", lat: 5, lng: 20, altitude: 2.3 },
  { label: "Oceania", flag: "🇦🇺", lat: -25, lng: 135, altitude: 2.2 },
];

const glass = "bg-card/75 backdrop-blur-xl border border-border/70 rounded-sm";

interface NavigatePanelProps {
  onNavigate?: (lat: number, lng: number, altitude: number) => void;
  forceOpen?: boolean;
  onClose?: () => void;
}

export function NavigatePanel({ onNavigate, forceOpen, onClose }: NavigatePanelProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = forceOpen !== undefined ? forceOpen : internalOpen;

  return (
    <div className={`${glass} w-full max-w-[260px] overflow-hidden`}>
      <Button variant="ghost" onClick={() => (onClose ? onClose() : setInternalOpen(!open))} className="w-full h-auto flex items-center justify-between px-4 py-2.5 rounded-none">
        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-medium">
          <Compass className="w-3 h-3 inline mr-1.5" />Navigate
        </span>
        {open ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
      </Button>
      {open && (
        <div className="px-3.5 pb-3.5 space-y-2.5">
          {/* Region flags row */}
          <div className="flex items-center gap-2 flex-wrap">
            {REGIONS.map(r => (
              <Button
                variant="ghost"
                size="icon"
                key={r.label}
                onClick={() => onNavigate?.(r.lat, r.lng, r.altitude)}
                className="text-base h-7 w-7 rounded-sm hover:scale-110 transition-transform"
                title={r.label}
              >
                {r.flag}
              </Button>
            ))}
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
