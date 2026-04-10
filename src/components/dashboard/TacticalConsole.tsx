import { useState } from "react";
import { ChevronUp, ChevronDown, X } from "lucide-react";
import { useSpaceWeather } from "@/hooks/useSpaceWeather";

const glass = "bg-black/60 backdrop-blur-[20px] border border-white/[0.06] rounded-lg";

export function TacticalConsole({ onClose }: { onClose?: () => void }) {
  const sw = useSpaceWeather();
  const [sections, setSections] = useState({ tension: true, noaa: true });
  const toggle = (k: "tension" | "noaa") => setSections(s => ({ ...s, [k]: !s[k] }));

  const kpColor = sw.kpIndex > 5 ? "#FF00FF" : sw.kpIndex > 4 ? "#FF4444" : "#00FF41";
  const kpAlert = sw.kpIndex >= 4;

  // Fake sparkline SVG data for NOAA chart
  const sparkPoints = Array.from({ length: 24 }, (_, i) => {
    const v = 20 + Math.sin(i * 0.6) * 15 + Math.random() * 10;
    return `${10 + i * 10},${80 - v}`;
  }).join(" ");

  const rScale = sw.radioBlackout !== "none" ? sw.radioBlackout : "0";
  const sScale = sw.stormLevel !== "none" ? sw.stormLevel : "0";
  const gScale = sw.geomagneticStorm !== "none" ? sw.geomagneticStorm : "0";

  return (
    <div className={`${glass} w-[260px] overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04]">
        <span className="text-[10px] font-mono uppercase tracking-widest text-white/50">📡 Tactical Overview & Console</span>
        {onClose && <button onClick={onClose}><X className="w-3 h-3 text-white/20 hover:text-white/60" /></button>}
      </div>

      {/* GLOBAL TENSION */}
      <div className="border-b border-white/[0.04]">
        <button onClick={() => toggle("tension")} className="w-full flex items-center justify-between px-3 py-2">
          <span className="text-[9px] font-mono uppercase tracking-wider text-white/30">⚡ GLOBAL TENSION</span>
          {sections.tension ? <ChevronUp className="w-3 h-3 text-white/20" /> : <ChevronDown className="w-3 h-3 text-white/20" />}
        </button>
        {sections.tension && (
          <div className="px-3 pb-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono" style={{ color: kpColor }}>Kp: {sw.kpIndex.toFixed(1)}</span>
              {kpAlert && (
                <span className="text-[9px] font-mono text-[#FF4444] animate-pulse">[ALERT] TESLA CONVERGENCE</span>
              )}
            </div>
            {!kpAlert && (
              <span className="text-[9px] font-mono text-white/20">Magnetic field nominal</span>
            )}
          </div>
        )}
      </div>

      {/* NOAA SPACE WEATHER */}
      <div>
        <button onClick={() => toggle("noaa")} className="w-full flex items-center justify-between px-3 py-2">
          <span className="text-[9px] font-mono uppercase tracking-wider text-white/30">☀️ NOAA SPACE WEATHER</span>
          {sections.noaa ? <ChevronUp className="w-3 h-3 text-white/20" /> : <ChevronDown className="w-3 h-3 text-white/20" />}
        </button>
        {sections.noaa && (
          <div className="px-3 pb-3 space-y-2">
            {/* Indices */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[8px] font-mono text-white/25 uppercase">Realtime Indices</div>
                <div className="text-sm font-mono font-bold text-[#00FF41]">{rScale} | {sScale} | {gScale}</div>
              </div>
              <div>
                <div className="text-[8px] font-mono text-white/25 uppercase">Reactive Indices</div>
                <div className="text-sm font-mono font-bold text-white/60">32 | Bx Ka</div>
              </div>
            </div>

            {/* Mini Chart */}
            <div className="bg-black/40 rounded p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[7px] font-mono text-white/20 uppercase">Notenungs</span>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-0.5 text-[7px] text-white/20">
                    <span className="w-1.5 h-0.5 bg-[#00FF41] inline-block" /> INOI028
                  </span>
                  <span className="flex items-center gap-0.5 text-[7px] text-white/20">
                    <span className="w-1.5 h-0.5 bg-white/40 inline-block" /> RMXPH
                  </span>
                </div>
              </div>
              <svg viewBox="0 0 260 90" className="w-full h-16">
                <polyline
                  fill="none"
                  stroke="#00FF41"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  points={sparkPoints}
                  opacity="0.8"
                />
                <polyline
                  fill="none"
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth="1"
                  strokeLinejoin="round"
                  points={Array.from({ length: 24 }, (_, i) => `${10 + i * 10},${60 - Math.cos(i * 0.4) * 12 + Math.random() * 5}`).join(" ")}
                />
                {/* Y axis labels */}
                {[0, 25, 50, 75, 100].map(v => (
                  <text key={v} x="255" y={80 - v * 0.7} fill="rgba(255,255,255,0.15)" fontSize="6" textAnchor="end">{v}</text>
                ))}
              </svg>
              <div className="flex justify-between text-[7px] font-mono text-white/15 mt-0.5">
                <span>10:00</span><span>12:30</span><span>15:00</span><span>13:30</span><span>13:00</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
