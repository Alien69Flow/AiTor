import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Wallet, LogOut, LogIn, Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import alienflowLogo from "@/assets/alienflow-logo.png";

export type TabId = "terminal" | "markets" | "predictions" | "feed" | "movers" | "portfolio" | "alerts" | "monitor" | "ufo" | "solar" | "signals" | "agents";

type TabStatus = "live" | "demo" | "status" | "new";

interface TopNavBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string; status: TabStatus }[] = [
  { id: "terminal", label: "Nexus", status: "live" },
  { id: "markets", label: "Globe", status: "live" },
  { id: "predictions", label: "Markets", status: "live" },
  { id: "signals", label: "Signals", status: "live" },
  { id: "agents", label: "Agents", status: "new" },
  { id: "feed", label: "Feed", status: "live" },
  { id: "movers", label: "Movers", status: "live" },
  { id: "portfolio", label: "Portfolio", status: "demo" },
  { id: "alerts", label: "Alerts", status: "demo" },
  { id: "monitor", label: "Monitor", status: "status" },
  { id: "ufo", label: "UFO/Alien", status: "live" },
  { id: "solar", label: "Solar System", status: "demo" },
];

const STATUS_COLORS: Record<TabStatus, string> = {
  live: "bg-secondary",
  demo: "bg-yellow-500",
  status: "bg-muted-foreground/50",
  new: "bg-primary",
};

export function TopNavBar({ activeTab, onTabChange }: TopNavBarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) toast.error("Error al cerrar sesión");
  };

  const handleConnectWallet = () => {
    toast.info("Conectar Wallet disponible próximamente", {
      description: "Desbloquea el modo Nexo Soberano con Web3",
    });
  };

  const handleTabChange = (tab: TabId) => {
    onTabChange(tab);
    setMenuOpen(false);
  };

  const activeLabel = TABS.find((t) => t.id === activeTab)?.label ?? "Menu";

  return (
    <header className="w-full bg-card/90 backdrop-blur-xl border-b border-border/40 z-50 relative">
      <div className="flex items-center justify-between px-2 md:px-4 py-2 gap-2 md:gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <img src={alienflowLogo} alt="AlienFlow" className="w-7 h-7 object-contain" />
          <span className="text-sm font-heading text-primary neon-text-green tracking-wider hidden sm:inline">
            ΔlieπFlΦw
          </span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-0.5 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-3 py-1.5 text-[11px] font-heading tracking-wider uppercase whitespace-nowrap transition-all duration-200 rounded-sm flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground/60 hover:text-foreground/80"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[tab.status]} ${tab.status === "new" ? "animate-pulse" : ""}`} />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Mobile: hamburger + active label */}
        <div className="flex md:hidden items-center gap-2 flex-1 min-w-0">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-primary transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="text-xs font-heading text-primary uppercase tracking-wider truncate">
            {activeLabel}
          </span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          <div className="relative hidden md:flex items-center">
            <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground/40" />
            <Input
              placeholder="Search markets and events"
              className="h-8 w-[200px] lg:w-[280px] pl-8 text-xs bg-muted/30 border-border/30 focus:border-primary/40"
            />
            <kbd className="absolute right-2 text-[9px] text-muted-foreground/40 bg-muted/50 px-1.5 py-0.5 rounded font-mono">F</kbd>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleConnectWallet}
            className="h-8 px-2 md:px-3 text-[10px] font-heading tracking-wider border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 hover:border-primary/50 transition-all uppercase"
          >
            <Wallet className="h-3.5 w-3.5 md:mr-1.5" />
            <span className="hidden md:inline">Setup Trading Wallet</span>
          </Button>

          {user ? (
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="h-8 w-8 text-muted-foreground/60 hover:text-primary" title="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => navigate("/auth")} className="h-8 w-8 text-muted-foreground/60 hover:text-primary" title="Iniciar sesión">
              <LogIn className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-card/95 backdrop-blur-xl border-b border-border/40 z-50 max-h-[70dvh] overflow-y-auto">
          <nav className="flex flex-col p-2 gap-0.5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-3 py-2.5 text-[12px] font-heading tracking-wider uppercase rounded-md flex items-center gap-2 transition-all ${
                  activeTab === tab.id
                    ? "text-primary bg-primary/10 border-l-2 border-primary"
                    : "text-muted-foreground/60 hover:text-foreground/80 hover:bg-muted/30"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_COLORS[tab.status]} ${tab.status === "new" ? "animate-pulse" : ""}`} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
