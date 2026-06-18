import {
  Crosshair,
  Wifi,
  Zap,
  Activity,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useSpaceWeather } from "@/hooks/useSpaceWeather";
import {
  GlassPanel,
  LedIndicator,
  StatusBadge,
  MetricCard,
  SectionTitle,
} from "./GlassPanels";

function TensionSparkline({ value, color }: { value: number; color: string }) {
  const points = Array.from({ length: 24 }, (_, i) => {
    const base = 20 + Math.sin(i * 0.5) * 15 + (value / 100) * 20;
    const noise = Math.random() * 8;
    return `${10 + i * 10},${80 - base - noise}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 260 90" className="w-full h-20">
      <defs>
        <linearGradient id="sparkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,90 ${points} 260,90`} fill="url(#sparkGrad)" />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        points={points}
        opacity="0.9"
      />
      {[20, 40, 60, 80].map((v) => (
        <line
          key={v}
          x1="0"
          y1={90 - v}
          x2="260"
          y2={90 - v}
          stroke="rgba(148,163,184,0.1)"
          strokeDasharray="4 4"
        />
      ))}
    </svg>
  );
}

function TensionMeter({ value }: { value: number }) {
  const segments = 8;
  const activeSegments = Math.round((value / 100) * segments);

  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: segments }).map((_, i) => {
        const isActive = i < activeSegments;
        const segmentColor = isActive
          ? i < 3
            ? "#34d399"
            : i < 5
            ? "#fbbf24"
            : "#f87171"
          : "#334155";
        return (
          <div
            key={i}
            className="w-4 h-6 rounded-sm transition-all duration-300"
            style={{
              backgroundColor: segmentColor,
              boxShadow: isActive
                ? `0 0 8px ${segmentColor}80, 0 0 16px ${segmentColor}40`
                : "none",
            }}
          />
        );
      })}
    </div>
  );
}

export function TacticalConsole() {
  const sw = useSpaceWeather();

  const kpColor =
    sw.kpIndex > 5 ? "#f87171" : sw.kpIndex > 4 ? "#fbbf24" : "#34d399";
  const kpStatus =
    sw.kpIndex > 5 ? "SEVERE" : sw.kpIndex > 4 ? "ELEVATED" : "NOMINAL";
  const kpVariant =
    sw.kpIndex > 5 ? "danger" : sw.kpIndex > 4 ? "warning" : "success";

  const rScale = sw.radioBlackout !== "none" ? sw.radioBlackout : "R0";
  const sScale = sw.stormLevel !== "none" ? sw.stormLevel : "S0";
  const gScale = sw.geomagneticStorm !== "none" ? sw.geomagneticStorm : "G0";

  return (
    <GlassPanel
      icon={Crosshair}
      title="Global Tension"
      className="w-[300px]"
      glowBorder
      glowColor={kpColor}
      headerRight={<StatusBadge variant={kpVariant} glow>{kpStatus}</StatusBadge>}
    >
      <div className="space-y-5">
        {/* Main Kp Index Display */}
        <div className="text-center py-2">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Zap className="w-5 h-5" style={{ color: kpColor }} />
            <span
              className="text-4xl font-bold font-mono"
              style={{ color: kpColor }}
            >
              {sw.kpIndex.toFixed(1)}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-4">
            Kp Index
          </div>
          <TensionMeter value={sw.kpIndex * 10} />
        </div>

        {/* Realtime Indices Grid */}
        <div>
          <SectionTitle>NOAA Indices</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            <MetricCard
              id={rScale}
              value="Radio"
              status={rScale !== "R0" ? "alert" : "stable"}
              variant="compact"
            />
            <MetricCard
              id={sScale}
              value="Solar"
              status={sScale !== "S0" ? "warn" : "stable"}
              variant="compact"
            />
            <MetricCard
              id={gScale}
              value="Geo"
              status={gScale !== "G0" ? "alert" : "stable"}
              variant="compact"
            />
          </div>
        </div>

        {/* Sparkline Chart */}
        <div className="bg-slate-800/20 border border-slate-700/20 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[9px] uppercase tracking-wider text-slate-500">
                Tension Trend
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {sw.kpIndex > 3 ? (
                <TrendingUp className="w-3 h-3 text-amber-400" />
              ) : (
                <TrendingDown className="w-3 h-3 text-emerald-400" />
              )}
              <span className="text-[9px] font-mono" style={{ color: kpColor }}>
                {sw.kpIndex > 3 ? "+0.2" : "-0.1"}
              </span>
            </div>
          </div>
          <TensionSparkline value={sw.kpIndex * 10} color={kpColor} />
          <div className="flex justify-between text-[8px] text-slate-600 mt-1.5 px-2">
            <span>-24h</span>
            <span>-12h</span>
            <span>-6h</span>
            <span>-1h</span>
            <span>NOW</span>
          </div>
        </div>

        {/* Status Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-700/25">
          <div className="flex items-center gap-2">
            <Wifi className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[9px] text-slate-500 uppercase tracking-wider">
              Data Link
            </span>
          </div>
          <div className="flex items-center gap-2">
            <LedIndicator color="#34d399" active size="xs" />
            <span className="text-[9px] text-emerald-400 uppercase font-semibold">
              Real-time
            </span>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
