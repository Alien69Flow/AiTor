import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, Plus, Trash2, TrendingUp, AlertTriangle, Radio, Globe } from "lucide-react";

interface AlertConfig {
  id: string;
  type: "price" | "volume" | "uap" | "geopolitical";
  label: string;
  condition: string;
  active: boolean;
}

const MOCK_ALERTS: AlertConfig[] = [
  { id: "1", type: "price", label: "BTC > $70,000", condition: "Price above threshold", active: true },
  { id: "2", type: "volume", label: "ETH Vol > $5B", condition: "24h volume spike", active: true },
  { id: "3", type: "uap", label: "New UAP Sighting", condition: "NUFORC new report", active: false },
  { id: "4", type: "geopolitical", label: "Tension > 80", condition: "Global tension critical", active: true },
];

const typeIcons = { price: TrendingUp, volume: Radio, uap: AlertTriangle, geopolitical: Globe };
const typeColors = {
  price: "text-secondary border-secondary/30",
  volume: "text-primary border-primary/30",
  uap: "text-destructive border-destructive/30",
  geopolitical: "text-primary/70 border-primary/20",
};

export function AlertsTab() {
  const [alerts, setAlerts] = useState(MOCK_ALERTS);

  const toggleAlert = (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, active: !a.active } : a)));
  };

  const removeAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-heading text-primary uppercase tracking-wider">Alert Configuration</h2>
        </div>
        <Button variant="outline" size="sm" className="h-7 text-[10px]">
          <Plus className="w-3 h-3 mr-1" />
          New Alert
        </Button>
      </div>

      {/* Alert types */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(["price", "volume", "uap", "geopolitical"] as const).map((t) => {
          const Icon = typeIcons[t];
          return (
            <Badge key={t} variant="outline" className={`text-[9px] px-2 py-0.5 cursor-pointer hover:bg-muted/20 ${typeColors[t]}`}>
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
                alert.active ? "border-primary/20" : "border-border/10 opacity-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${typeColors[alert.type].split(" ")[0]}`} />
                <div>
                  <span className="text-xs font-bold text-foreground/90">{alert.label}</span>
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
        Alerts are demo-only. Real-time notifications coming soon via ΔlieπFlΦw DAO.
      </p>
    </div>
  );
}
