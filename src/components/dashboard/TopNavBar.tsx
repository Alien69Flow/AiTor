import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Wallet, LogOut, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import alienflowLogo from "@/assets/alienflow-logo.png";

export type TabId = "terminal" | "markets" | "feed" | "movers" | "portfolio" | "alerts" | "monitor" | "ufo" | "solar";

interface TopNavBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string }[] = [
  { id: "terminal", label: "Terminal" },
  { id: "markets", label: "Markets" },
  { id: "feed", label: "Feed" },
  { id: "movers", label: "Movers" },
  { id: "portfolio", label: "Portfolio" },
  { id: "alerts", label: "Alerts" },
  { id: "monitor", label: "Monitor" },
  { id: "ufo", label: "UFO/Alien" },
  { id: "solar", label: "Solar System" },
];

export function TopNavBar({ activeTab, onTabChange }: TopNavBarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) toast.error("Error al cerrar sesión");
  };

  const handleConnectWallet = () => {
    toast.info("Conectar Wallet disponible próximamente", {
      description: "Desbloquea el modo Nexo Soberano con Web3",
    });
  };

  return (
    <header className="w-full bg-card/90 backdrop-blur-xl border-b border-border/40 z-50 relative">
      <div className="flex items-center justify-between px-4 py-2 gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <img src={alienflowLogo} alt="AlienFlow" className="w-7 h-7 object-contain" />
          <span className="text-sm font-heading text-primary neon-text-green tracking-wider hidden sm:inline">
            ΔlieπFlΦw
          </span>
        </div>

        {/* Tabs */}
        <nav className="flex items-center gap-0.5 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-1.5 text-[11px] font-heading tracking-wider uppercase whitespace-nowrap transition-all duration-200 rounded-sm ${
                activeTab === tab.id
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground/60 hover:text-foreground/80"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Search + Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative hidden md:flex items-center">
            <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground/40" />
            <Input
              placeholder="Search markets and events"
              className="h-8 w-[200px] lg:w-[280px] pl-8 text-xs bg-muted/30 border-border/30 focus:border-primary/40"
            />
            <kbd className="absolute right-2 text-[9px] text-muted-foreground/40 bg-muted/50 px-1.5 py-0.5 rounded font-mono">
              F
            </kbd>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleConnectWallet}
            className="h-8 px-3 text-[10px] font-heading tracking-wider border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 hover:border-primary/50 transition-all uppercase"
          >
            <Wallet className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Setup Trading Wallet</span>
          </Button>

          {user ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="h-8 w-8 text-muted-foreground/60 hover:text-primary"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/auth")}
              className="h-8 w-8 text-muted-foreground/60 hover:text-primary"
              title="Iniciar sesión"
            >
              <LogIn className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
