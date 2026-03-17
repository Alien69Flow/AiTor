import { Settings, Wallet, Key, Shield, User } from "lucide-react";

export function SystemTab() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mx-auto">
          <Settings className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-heading text-foreground tracking-wide">DAO System</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Governance, profile, wallet & API key management
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: User, label: "Profile", desc: "Coming soon" },
            { icon: Wallet, label: "Wallet", desc: "Connect Web3" },
            { icon: Key, label: "API Keys", desc: "CoinGecko, Firecrawl" },
            { icon: Shield, label: "Governance", desc: "DAO voting" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/30 bg-card/50 hover:border-primary/30 transition-colors"
            >
              <item.icon className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs font-heading text-foreground tracking-wider uppercase">{item.label}</span>
              <span className="text-[10px] text-muted-foreground">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
