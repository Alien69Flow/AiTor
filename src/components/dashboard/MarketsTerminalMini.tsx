import { useCryptoPrices } from "@/hooks/useCryptoPrices";

const glass = "bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl";

function MiniSparkline({ change }: { change: number }) {
  const dir = change >= 1 ? "up" : change <= -1 ? "down" : "flat";
  const points = dir === "up"
    ? "0,12 5,10 10,11 15,8 20,6 25,3 30,2"
    : dir === "down"
    ? "0,2 5,4 10,3 15,7 20,9 25,10 30,12"
    : "0,7 5,6 10,8 15,7 20,6 25,8 30,7";
  const color = dir === "up" ? "#34d399" : dir === "down" ? "#f87171" : "#fbbf24";
  return (
    <svg viewBox="0 0 30 14" className="w-10 h-4">
      <polyline fill="none" stroke={color} strokeWidth="1.2" points={points} />
    </svg>
  );
}

export function MarketsTerminalMini() {
  const { prices } = useCryptoPrices();

  return (
    <div className={`${glass} w-[240px] overflow-hidden`}>
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-700/25">
        <span className="text-[9px] uppercase tracking-[0.12em] text-white/70 font-medium">Markets Terminal</span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-4 px-3.5 py-1.5 text-[7px] text-slate-500 uppercase border-b border-slate-700/20">
        <span>Pair</span><span>Trend</span><span>Price</span><span className="text-right">24h</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-700/15">
        {prices.slice(0, 5).map(coin => {
          const changeColor = coin.change24h >= 0 ? "#34d399" : "#f87171";
          const changeStr = coin.change24h >= 0 ? `+${coin.change24h.toFixed(1)}%` : `${coin.change24h.toFixed(1)}%`;
          return (
            <div key={coin.id} className="grid grid-cols-4 items-center px-3.5 py-1.5 hover:bg-slate-800/30 transition-colors">
              <span className="text-[9px] font-mono text-white/80 font-bold">{coin.symbol}</span>
              <MiniSparkline change={coin.change24h} />
              <span className="text-[9px] font-mono text-slate-400">${coin.price >= 1000 ? (coin.price / 1000).toFixed(1) + "k" : coin.price.toFixed(2)}</span>
              <span className="text-[9px] font-mono text-right" style={{ color: changeColor }}>{changeStr}</span>
            </div>
          );
        })}
      </div>

      <div className="px-3.5 py-1.5 text-[7px] text-slate-600 border-t border-slate-700/20 font-mono">
        CoinGecko · Live
      </div>
    </div>
  );
}
