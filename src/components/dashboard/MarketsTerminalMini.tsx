import { useState } from "react";
import { useCryptoPrices } from "@/hooks/useCryptoPrices";

const glass = "bg-black/60 backdrop-blur-[20px] border border-white/[0.06] rounded-lg";

const MARKET_PAIRS = [
  { name: "GVD GSY", sparkDir: "down" },
  { name: "USD USDT", sparkDir: "flat" },
  { name: "USD DSTK", sparkDir: "up" },
  { name: "NEP USDY", sparkDir: "flat" },
];

function MiniSparkline({ dir }: { dir: string }) {
  const points = dir === "up"
    ? "0,12 5,10 10,11 15,8 20,6 25,3 30,2"
    : dir === "down"
    ? "0,2 5,4 10,3 15,7 20,9 25,10 30,12"
    : "0,7 5,6 10,8 15,7 20,6 25,8 30,7";
  const color = dir === "up" ? "#00FF41" : dir === "down" ? "#FF4444" : "#FFD700";
  return (
    <svg viewBox="0 0 30 14" className="w-10 h-4">
      <polyline fill="none" stroke={color} strokeWidth="1.2" points={points} />
    </svg>
  );
}

export function MarketsTerminalMini() {
  const [tab, setTab] = useState<"dashboard" | "glint">("dashboard");
  const { prices } = useCryptoPrices();

  // Map real prices to pairs
  const pairData = MARKET_PAIRS.map((pair, i) => {
    const crypto = prices[i % prices.length];
    return {
      ...pair,
      price: crypto ? crypto.price.toFixed(2) : "—",
      change: crypto ? (crypto.change24h >= 0 ? `+${crypto.change24h.toFixed(1)}%` : `${crypto.change24h.toFixed(1)}%`) : "—",
      changeColor: crypto ? (crypto.change24h >= 0 ? "#00FF41" : "#FF4444") : "#666",
    };
  });

  return (
    <div className={`${glass} w-[260px] overflow-hidden`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04]">
        <span className="text-[9px] font-mono uppercase tracking-wider text-white/30">📊 MARKETS TERMINAL</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.04]">
        {(["dashboard", "glint"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-[9px] font-mono uppercase tracking-wider ${
              tab === t ? "text-white border-b border-white/30" : "text-white/25 hover:text-white/40"
            }`}
          >
            {t === "dashboard" ? "Dashboard" : "Glint.trade"}
          </button>
        ))}
      </div>

      {/* Table header */}
      <div className="grid grid-cols-4 px-3 py-1 text-[7px] font-mono text-white/20 uppercase border-b border-white/[0.03]">
        <span>Export</span><span>Ándoo</span><span>Charitto</span><span></span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-white/[0.03]">
        {pairData.map(pair => (
          <div key={pair.name} className="grid grid-cols-4 items-center px-3 py-1.5 hover:bg-white/[0.02] transition-colors">
            <span className="text-[9px] font-mono text-white/70 font-bold">{pair.name}</span>
            <MiniSparkline dir={pair.sparkDir} />
            <span className="text-[9px] font-mono text-white/50">${pair.price}</span>
            <span className="text-[9px] font-mono text-right" style={{ color: pair.changeColor }}>{pair.change}</span>
          </div>
        ))}
      </div>

      <div className="px-3 py-1.5 text-[7px] font-mono text-white/15 border-t border-white/[0.03]">
        Ada · 8 reports
      </div>
    </div>
  );
}
