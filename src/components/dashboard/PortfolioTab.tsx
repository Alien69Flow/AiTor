import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet, TrendingUp, PieChart } from "lucide-react";
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const MOCK_HOLDINGS = [
  { name: "BTC", value: 45, amount: "0.85 BTC", usd: "$52,340", pnl: "+12.4%", color: "hsl(var(--primary))" },
  { name: "ETH", value: 25, amount: "12.5 ETH", usd: "$29,100", pnl: "+8.2%", color: "hsl(var(--secondary))" },
  { name: "SOL", value: 15, amount: "180 SOL", usd: "$17,460", pnl: "+22.1%", color: "hsl(var(--accent))" },
  { name: "USDT", value: 10, amount: "11,640 USDT", usd: "$11,640", pnl: "0%", color: "hsl(var(--muted-foreground))" },
  { name: "Other", value: 5, amount: "—", usd: "$5,820", pnl: "+3.5%", color: "hsl(var(--border))" },
];

export function PortfolioTab() {
  const total = "$116,360";

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-heading text-primary uppercase tracking-wider">Portfolio</h2>
        </div>
        <Button variant="outline" size="sm" className="h-7 text-[10px]">
          <Wallet className="w-3 h-3 mr-1" />
          Connect Wallet
        </Button>
      </div>

      {/* Total Value */}
      <div className="bg-card/60 border border-border/20 rounded-lg p-4 mb-4">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Portfolio Value</span>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-2xl font-mono font-bold text-foreground">{total}</span>
          <div className="flex items-center gap-0.5">
            <TrendingUp className="w-3.5 h-3.5 text-secondary" />
            <span className="text-sm font-mono text-secondary">+10.8%</span>
          </div>
        </div>
        <span className="text-[9px] text-muted-foreground/50">Demo data — connect wallet for real tracking</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* Chart */}
        <div className="w-full lg:w-1/2 h-48 lg:h-auto">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPie>
              <Pie data={MOCK_HOLDINGS} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                {MOCK_HOLDINGS.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                itemStyle={{ color: "hsl(var(--foreground))" }}
              />
            </RechartsPie>
          </ResponsiveContainer>
        </div>

        {/* Holdings list */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {MOCK_HOLDINGS.map((h) => (
            <div key={h.name} className="flex items-center justify-between p-2.5 rounded-lg bg-card/40 border border-border/10">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ background: h.color }} />
                <div>
                  <span className="text-xs font-bold text-foreground">{h.name}</span>
                  <span className="text-[9px] text-muted-foreground ml-1.5">{h.amount}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono text-foreground/80">{h.usd}</span>
                <Badge variant="outline" className={`ml-2 text-[8px] px-1 py-0 h-4 ${h.pnl.startsWith("+") ? "text-secondary border-secondary/30" : "text-muted-foreground border-border/30"}`}>
                  {h.pnl}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
