import { useCryptoPrices } from "@/hooks/useCryptoPrices";

const glass = "bg-black/60 backdrop-blur-[20px] border border-white/[0.06] rounded-lg";

function MiniSparkline({ change }: { change: number }) {
  const dir = change >= 1 ? "up" : change <= -1 ? "down" : "flat";
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
  const { prices } = useCryptoPrices();

  return (
    <div className={`${glass} w-[240px] overflow-hidden`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04]">
        <span className="text-[9px] font-mono uppercase tracking-wider text-white/30">📊 MARKETS TERMINAL</span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-4 px-3 py-1 text-[7px] font-mono text-white/20 uppercase border-b border-white/[0.03]">
        <span>Pair</span><span>Trend</span><span>Price</span><span className="text-right">24h</span>
      </div>

      {/* Rows — real crypto data */}
      <div className="divide-y divide-white/[0.03]">
        {prices.slice(0, 5).map(coin => {
          const changeColor = coin.change24h >= 0 ? "#00FF41" : "#FF4444";
          const changeStr = coin.change24h >= 0 ? `+${coin.change24h.toFixed(1)}%` : `${coin.change24h.toFixed(1)}%`;
          return (
            <div key={coin.id} className="grid grid-cols-4 items-center px-3 py-1.5 hover:bg-white/[0.02] transition-colors">
              <span className="text-[9px] font-mono text-white/70 font-bold">{coin.symbol}</span>
              <MiniSparkline change={coin.change24h} />
              <span className="text-[9px] font-mono text-white/50">${coin.price >= 1000 ? (coin.price / 1000).toFixed(1) + "k" : coin.price.toFixed(2)}</span>
              <span className="text-[9px] font-mono text-right" style={{ color: changeColor }}>{changeStr}</span>
            </div>
          );
        })}
      </div>

      <div className="px-3 py-1.5 text-[7px] font-mono text-white/15 border-t border-white/[0.03]">
        CoinGecko · Live
      </div>
    </div>
  );
}
