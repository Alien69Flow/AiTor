import { useState } from "react";
import { ChevronUp, ChevronDown, X } from "lucide-react";
import { useSpaceWeather } from "@/hooks/useSpaceWeather";

const glass = "bg-slate-950/40 backdrop-blur-[24px] border border-slate-700/50 rounded-2xl font-mono shadow-2xl shadow-blue-900/10";

export function TacticalConsole({ onClose }: { onClose?: () => void }) {
  const sw = useSpaceWeather();
  const [sections, setSections] = useState({ tension: true, noaa: true });
  const toggle = (k: "tension" | "noaa") => setSections(s => ({ ...s, [k]: !s[k] }));

  const kpColor = sw.kpIndex >= 5 ? "#ef4444" : sw.kpIndex >= 4 ? "#fbbf24" : "#34d399";
  const kpAlert = sw.kpIndex >= 4;
  const accentBorder = kpAlert ? "border-l-2 border-[#ef4444]" : "border-l-2 border-emerald-500";

  const sparkPoints = Array.from({ length: 24 }, (_, i) => {
    const v = 20 + Math.sin(i * 0.6) * 15 + Math.random() * 10;
    return `${10 + i * 10},${80 - v}`;
  }).join(" ");

  const rScale = sw.radioBlackout !== "none" ? sw.radioBlackout : "0";
  const sScale = sw.stormLevel !== "none" ? sw.stormLevel : "0";
  const gScale = sw.geomagneticStorm !== "none" ? sw.geomagneticStorm : "0";

  return (
    <div className={`${glass} ${accentBorder} w-[260px] overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/30">
        <span className="text-[10px] uppercase tracking-[0.12em] text-[#b4c5b0] font-medium">Tactical Overview</span>
        {onClose && <button onClick={onClose}><X className="w-3 h-3 text-slate-500 hover:text-slate-300" /></button>}
      </div>

      {/* GLOBAL TENSION */}
      <div className="border-b border-slate-700/25">
        <button onClick={() => toggle("tension")} className="w-full flex items-center justify-between px-4 py-2">
          <span className="text-[9px] uppercase tracking-wider text-[#b4c5b0]">Global Tension</span>
          {sections.tension ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
        </button>
        {sections.tension && (
          <div className="px-4 pb-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold" style={{ color: kpColor }}>Kp: {sw.kpIndex.toFixed(1)}</span>
              {kpAlert && (
                <span className="text-[9px] animate-pulse" style={{ color: "#ef4444" }}>[ALERT] TESLA CONVERGENCE</span>
              )}
            </div>
            {!kpAlert && (
              <span className="text-[9px] text-emerald-400/70">Magnetic field nominal</span>
            )}
          </div>
        )}
      </div>

      {/* NOAA SPACE WEATHER */}
      <div>
        <button onClick={() => toggle("noaa")} className="w-full flex items-center justify-between px-4 py-2">
          <span className="text-[9px] uppercase tracking-wider text-[#b4c5b0]">NOAA Space Weather</span>
          {sections.noaa ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
        </button>
        {sections.noaa && (
          <div className="px-4 pb-3 space-y-2.5">
            {/* Indices */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-slate-950/60 border border-slate-700/30 rounded-xl">
                <div className="text-[8px] text-slate-500 uppercase mb-1">Realtime Indices</div>
                <div className="text-sm font-bold text-emerald-400">{rScale} | {sScale} | {gScale}</div>
              </div>
              <div className="p-2 bg-slate-950/60 border border-slate-700/30 rounded-xl">
                <div className="text-[8px] text-slate-500 uppercase mb-1">Reactive Indices</div>
                <div className="text-sm font-bold text-[#b4c5b0]">32 | Bx Ka</div>
              </div>
            </div>

            {/* Mini Chart */}
            <div className="bg-slate-950/60 border border-slate-700/30 rounded-xl p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[7px] text-slate-500 uppercase">Notenungs</span>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-0.5 text-[7px] text-slate-500">
                    <span className="w-1.5 h-0.5 bg-emerald-400 inline-block rounded-full" /> INOI028
                  </span>
                  <span className="flex items-center gap-0.5 text-[7px] text-slate-600">
                    <span className="w-1.5 h-0.5 bg-slate-500 inline-block rounded-full" /> RMXPH
                  </span>
                </div>
              </div>
              <svg viewBox="0 0 260 90" className="w-full h-16">
                <polyline
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  points={sparkPoints}
                  opacity="0.8"
                />
                <polyline
                  fill="none"
                  stroke="rgba(148,163,184,0.25)"
                  strokeWidth="1"
                  strokeLinejoin="round"
                  points={Array.from({ length: 24 }, (_, i) => `${10 + i * 10},${60 - Math.cos(i * 0.4) * 12 + Math.random() * 5}`).join(" ")}
                />
                {[0, 25, 50, 75, 100].map(v => (
                  <text key={v} x="255" y={80 - v * 0.7} fill="rgba(148,163,184,0.2)" fontSize="6" textAnchor="end">{v}</text>
                ))}
              </svg>
              <div className="flex justify-between text-[7px] text-slate-600 mt-1">
                <span>10:00</span><span>12:30</span><span>15:00</span><span>13:30</span><span>13:00</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
