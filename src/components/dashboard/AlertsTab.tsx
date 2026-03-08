import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, Plus, Trash2, TrendingUp, AlertTriangle, Radio, Globe, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AlertConfig {
  id: string;
  type: "price" | "volume" | "uap" | "geopolitical";
  label: string;
  condition: string;
  coinId?: string;
  threshold?: number;
  direction?: "above" | "below";
  active: boolean;
  triggered?: boolean;
}

const STORAGE_KEY = "alienflow-alerts";

function loadAlerts(): AlertConfig[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [
      { id: "1", type: "price", label: "BTC > $70,000", condition: "Price above threshold", coinId: "bitcoin", threshold: 70000, direction: "above", active: true },
      { id: "2", type: "price", label: "ETH < $2,000", condition: "Price below threshold", coinId: "ethereum", threshold: 2000, direction: "below", active: true },
    ];
  } catch { return []; }
}

const typeIcons = { price: TrendingUp, volume: Radio, uap: AlertTriangle, geopolitical: Globe };
const typeColors = {
  price: "text-secondary border-secondary/30",
  volume: "text-primary border-primary/30",
  uap: "text-destructive border-destructive/30",
  geopolitical: "text-primary/70 border-primary/20",
};

export function AlertsTab() {
  const [alerts, setAlerts] = useState<AlertConfig[]>(loadAlerts);
  const [showForm, setShowForm] = useState(false);
  const [newCoin, setNewCoin] = useState("bitcoin");
  const [newThreshold, setNewThreshold] = useState("");
  const [newDirection, setNewDirection] = useState<"above" | "below">("above");

  // Persist
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  }, [alerts]);

  // Check alerts against live prices
  const checkAlerts = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("crypto-feed", { body: { action: "movers" } });
      if (error) return;
      const coins = data?.coins || [];
      const priceMap: Record<string, number> = {};
      coins.forEach((c: any) => { priceMap[c.id] = c.current_price; });

      setAlerts(prev => prev.map(a => {
        if (!a.active || a.type !== "price" || !a.coinId || !a.threshold) return a;
        const price = priceMap[a.coinId];
        if (!price) return a;

        const wasTriggered = a.triggered;
        const isTriggered = a.direction === "above" ? price > a.threshold : price < a.threshold;

        if (isTriggered && !wasTriggered) {
          toast.success(`🔔 Alert: ${a.label}`, { description: `Current price: $${price.toLocaleString()}` });
        }
        return { ...a, triggered: isTriggered };
      }));
    } catch { /* silent */ }
  }, []);

  useEffect(() => { checkAlerts(); }, [checkAlerts]);
  useEffect(() => {
    const interval = setInterval(checkAlerts, 60000);
    return () => clearInterval(interval);
  }, [checkAlerts]);

  const toggleAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, active: !a.active, triggered: false } : a));
  };

  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const addAlert = () => {
    if (!newThreshold) return;
    const sym = newCoin === "bitcoin" ? "BTC" : newCoin === "ethereum" ? "ETH" : newCoin === "solana" ? "SOL" : newCoin.toUpperCase();
    const label = `${sym} ${newDirection === "above" ? ">" : "<"} $${parseFloat(newThreshold).toLocaleString()}`;
    setAlerts(prev => [...prev, {
      id: crypto.randomUUID(),
      type: "price",
      label,
      condition: `Price ${newDirection} threshold`,
      coinId: newCoin,
      threshold: parseFloat(newThreshold),
      direction: newDirection,
      active: true,
    }]);
    setNewThreshold("");
    setShowForm(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-heading text-primary uppercase tracking-wider">Alert Configuration</h2>
        </div>
        <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="w-3 h-3 mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
          {showForm ? "Cancel" : "New Alert"}
        </Button>
      </div>

      {showForm && (
        <div className="bg-card/60 border border-border/20 rounded-lg p-3 mb-4 space-y-2">
          <div className="flex gap-2">
            <select value={newCoin} onChange={e => setNewCoin(e.target.value)} className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs">
              <option value="bitcoin">Bitcoin (BTC)</option>
              <option value="ethereum">Ethereum (ETH)</option>
              <option value="solana">Solana (SOL)</option>
              <option value="ripple">XRP</option>
              <option value="dogecoin">Dogecoin (DOGE)</option>
            </select>
            <select value={newDirection} onChange={e => setNewDirection(e.target.value as "above" | "below")} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
              <option value="above">Above (&gt;)</option>
              <option value="below">Below (&lt;)</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Input placeholder="Price threshold ($)" type="number" value={newThreshold} onChange={e => setNewThreshold(e.target.value)} className="h-8 text-xs" />
            <Button size="sm" className="h-8 text-[10px]" onClick={addAlert}>Create</Button>
          </div>
        </div>
      )}

      {/* Alert types */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(["price", "volume", "uap", "geopolitical"] as const).map((t) => {
          const Icon = typeIcons[t];
          return (
            <Badge key={t} variant="outline" className={`text-[9px] px-2 py-0.5 ${typeColors[t]}`}>
              <Icon className="w-3 h-3 mr-1" />
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Badge>
          );
        })}
      </div>

      {/* Alerts list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {alerts.map((alert) => {
          const Icon = typeIcons[alert.type];
          return (
            <div
              key={alert.id}
              className={`flex items-center justify-between p-3 rounded-lg bg-card/60 border transition-colors ${
                alert.triggered ? "border-secondary/40 bg-secondary/5" : alert.active ? "border-primary/20" : "border-border/10 opacity-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${typeColors[alert.type].split(" ")[0]}`} />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground/90">{alert.label}</span>
                    {alert.triggered && <Badge variant="outline" className="text-[7px] px-1 py-0 h-3.5 text-secondary border-secondary/30 animate-pulse">TRIGGERED</Badge>}
                  </div>
                  <span className="text-[9px] text-muted-foreground block">{alert.condition}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleAlert(alert.id)}
                  className={`w-8 h-4 rounded-full transition-colors ${alert.active ? "bg-primary" : "bg-muted/40"}`}
                >
                  <div className={`w-3 h-3 rounded-full bg-background transition-transform ${alert.active ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
                <button onClick={() => removeAlert(alert.id)} className="p-1 hover:bg-destructive/10 rounded transition-colors">
                  <Trash2 className="w-3 h-3 text-destructive/60" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[9px] text-muted-foreground/40 text-center mt-3">
        Alerts check live prices every 60s. Persistent via localStorage.
      </p>
    </div>
  );
}
