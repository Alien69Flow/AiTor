import { Zap, Bot, TrendingUp, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const SIGNALS = [
  { pair: "BTC/USDT", direction: "LONG", confidence: 87, timeframe: "4H", status: "active" },
  { pair: "ETH/USDT", direction: "SHORT", confidence: 72, timeframe: "1H", status: "active" },
  { pair: "SOL/USDT", direction: "LONG", confidence: 91, timeframe: "1D", status: "pending" },
  { pair: "AVAX/USDT", direction: "LONG", confidence: 65, timeframe: "4H", status: "closed" },
];

export function SignalsTab() {
  return (
    <div className="flex-1 flex flex-col items-center justify-start p-6 overflow-auto">
      <div className="w-full max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Zap className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-heading font-bold text-foreground tracking-wider">AI Signals</h2>
          <Badge variant="outline" className="text-[8px] font-heading tracking-widest border-primary/30 text-primary bg-primary/5">BETA</Badge>
        </div>
        <p className="text-xs text-muted-foreground/60 mb-6">Señales de trading generadas por IA con puntuación de confianza en tiempo real.</p>

        <div className="space-y-3">
          {SIGNALS.map((s, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card/30 backdrop-blur-sm hover:bg-card/50 transition-all">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-mono font-bold text-foreground">{s.pair}</span>
                <Badge variant="outline" className={`text-[8px] font-mono ${s.direction === "LONG" ? "border-secondary/50 text-secondary" : "border-destructive/50 text-destructive"}`}>
                  {s.direction}
                </Badge>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-muted-foreground/50">Confianza</span>
                  <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                    <div className="h-full bg-secondary rounded-full transition-all" style={{ width: `${s.confidence}%` }} />
                  </div>
                  <span className="text-xs font-mono text-secondary font-bold">{s.confidence}%</span>
                </div>
                <span className="text-[9px] text-muted-foreground/40 font-mono">TF: {s.timeframe}</span>
              </div>
              <Badge variant="outline" className={`text-[7px] font-mono ${
                s.status === "active" ? "border-secondary/30 text-secondary" : s.status === "pending" ? "border-primary/30 text-primary" : "border-muted-foreground/30 text-muted-foreground/50"
              }`}>
                {s.status.toUpperCase()}
              </Badge>
            </div>
          ))}
        </div>

        <div className="mt-8 p-6 rounded-xl border border-border/40 bg-card/20 text-center">
          <Lock className="w-5 h-5 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground/50">Señales avanzadas con acceso Premium — próximamente</p>
        </div>
      </div>
    </div>
  );
}
