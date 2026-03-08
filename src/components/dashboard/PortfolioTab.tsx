import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, TrendingUp, TrendingDown, PieChart, Plus, Trash2, X } from "lucide-react";
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { usePortfolio } from "@/hooks/usePortfolio";

const CHART_COLORS = [
  "hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))",
  "hsl(var(--muted-foreground))", "hsl(var(--border))", "#8b5cf6", "#ec4899",
];

const POPULAR_COINS = [
  { coinId: "bitcoin", symbol: "btc", name: "Bitcoin" },
  { coinId: "ethereum", symbol: "eth", name: "Ethereum" },
  { coinId: "solana", symbol: "sol", name: "Solana" },
  { coinId: "ripple", symbol: "xrp", name: "XRP" },
  { coinId: "dogecoin", symbol: "doge", name: "Dogecoin" },
  { coinId: "cardano", symbol: "ada", name: "Cardano" },
];

export function PortfolioTab() {
  const { assets, addAsset, removeAsset, totalValue, totalPnl, totalPnlPercent, loading } = usePortfolio();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCoinId, setNewCoinId] = useState("bitcoin");
  const [newAmount, setNewAmount] = useState("");
  const [newEntryPrice, setNewEntryPrice] = useState("");

  const handleAdd = () => {
    const coin = POPULAR_COINS.find(c => c.coinId === newCoinId);
    if (!coin || !newAmount || !newEntryPrice) return;
    addAsset({
      coinId: coin.coinId,
      symbol: coin.symbol,
      name: coin.name,
      amount: parseFloat(newAmount),
      entryPrice: parseFloat(newEntryPrice),
    });
    setNewAmount("");
    setNewEntryPrice("");
    setShowAddForm(false);
  };

  const pieData = assets.map((a, i) => ({
    name: a.symbol.toUpperCase(),
    value: a.value,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const positive = totalPnl >= 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-heading text-primary uppercase tracking-wider">Portfolio</h2>
          {loading && <span className="text-[8px] text-muted-foreground/40 animate-pulse">updating...</span>}
        </div>
        <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? <X className="w-3 h-3 mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
          {showAddForm ? "Cancel" : "Add Asset"}
        </Button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-card/60 border border-border/20 rounded-lg p-3 mb-4 space-y-2">
          <div className="flex gap-2">
            <select
              value={newCoinId}
              onChange={e => setNewCoinId(e.target.value)}
              className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              {POPULAR_COINS.map(c => (
                <option key={c.coinId} value={c.coinId}>{c.name} ({c.symbol.toUpperCase()})</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Input placeholder="Amount" type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} className="h-8 text-xs" />
            <Input placeholder="Entry price ($)" type="number" value={newEntryPrice} onChange={e => setNewEntryPrice(e.target.value)} className="h-8 text-xs" />
            <Button size="sm" className="h-8 text-[10px]" onClick={handleAdd}>Add</Button>
          </div>
        </div>
      )}

      {/* Total Value */}
      <div className="bg-card/60 border border-border/20 rounded-lg p-4 mb-4">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Portfolio Value</span>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-2xl font-mono font-bold text-foreground">
            ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
          {assets.length > 0 && (
            <div className="flex items-center gap-0.5">
              {positive ? <TrendingUp className="w-3.5 h-3.5 text-secondary" /> : <TrendingDown className="w-3.5 h-3.5 text-destructive" />}
              <span className={`text-sm font-mono ${positive ? "text-secondary" : "text-destructive"}`}>
                {positive ? "+" : ""}{totalPnlPercent.toFixed(1)}%
              </span>
              <span className={`text-xs font-mono ml-1 ${positive ? "text-secondary/60" : "text-destructive/60"}`}>
                ({positive ? "+" : ""}${totalPnl.toFixed(2)})
              </span>
            </div>
          )}
        </div>
        {assets.length === 0 && (
          <span className="text-[9px] text-muted-foreground/50">Add assets to track your portfolio with live prices</span>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* Chart */}
        {assets.length > 0 && (
          <div className="w-full lg:w-1/2 h-48 lg:h-auto">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value: number) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                />
              </RechartsPie>
            </ResponsiveContainer>
          </div>
        )}

        {/* Holdings list */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {assets.map((h, i) => (
            <div key={h.id} className="flex items-center justify-between p-2.5 rounded-lg bg-card/40 border border-border/10">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                {h.image && <img src={h.image} alt={h.symbol} className="w-4 h-4 rounded-full" />}
                <div>
                  <span className="text-xs font-bold text-foreground">{h.symbol.toUpperCase()}</span>
                  <span className="text-[9px] text-muted-foreground ml-1.5">{h.amount} @ ${h.entryPrice}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <span className="text-xs font-mono text-foreground/80">${h.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  <Badge variant="outline" className={`ml-2 text-[8px] px-1 py-0 h-4 ${h.pnlPercent >= 0 ? "text-secondary border-secondary/30" : "text-destructive border-destructive/30"}`}>
                    {h.pnlPercent >= 0 ? "+" : ""}{h.pnlPercent.toFixed(1)}%
                  </Badge>
                </div>
                <button onClick={() => removeAsset(h.id)} className="p-1 hover:bg-destructive/10 rounded transition-colors">
                  <Trash2 className="w-3 h-3 text-destructive/40" />
                </button>
              </div>
            </div>
          ))}
          {assets.length === 0 && (
            <div className="text-center py-8 text-muted-foreground/40 text-xs">
              <Wallet className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No assets yet. Click "Add Asset" to start tracking.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
