import { Button } from "@/components/ui/button";
import { Bot, Radio, Orbit, Globe, BarChart3, Settings, Wallet, LogOut, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import alienflowLogo from "@/assets/alienflow-logo.png";
import type { TabId } from "@/pages/Index";

const SECTIONS: { id: TabId; label: string; icon: typeof Bot }[] = [
  { id: "agents", label: "Agents", icon: Bot },
  { id: "alien", label: "Alien", icon: Radio },
  { id: "cosmos", label: "Cosmos", icon: Orbit },
  { id: "globe", label: "Globe", icon: Globe },
  { id: "markets", label: "Markets", icon: BarChart3 },
  { id: "system", label: "System", icon: Settings },
];

interface TopNavBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

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
    <header className="w-full bg-card/90 backdrop-blur-xl border-b border-border/40 z-50 shrink-0">
      <div className="flex items-center justify-between px-2 md:px-4 py-1.5 gap-2">
        {/* Left: logo */}
        <div className="flex items-center gap-2 shrink-0">
          <img src={alienflowLogo} alt="AlienFlow" className="w-7 h-7 object-contain" />
          <span className="text-sm font-heading text-primary neon-text-green tracking-wider hidden sm:inline">
            ΔlieπFlΦw
          </span>
        </div>

        {/* Center: 6 section tabs (desktop only) */}
        <nav className="hidden md:flex items-center gap-0.5">
          {SECTIONS.map((section) => {
            const isActive = activeTab === section.id;
            return (
              <button
                key={section.id}
                onClick={() => onTabChange(section.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-heading tracking-wider uppercase transition-all duration-200 ${
                  isActive
                    ? "bg-primary/15 text-primary shadow-[0_0_8px_hsl(var(--primary)/0.2)]"
                    : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/30"
                }`}
              >
                <section.icon className="h-3.5 w-3.5" />
                {section.label}
              </button>
            );
          })}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleConnectWallet}
            className="h-7 px-2 md:px-3 text-[10px] font-heading tracking-wider border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 hover:border-primary/50 transition-all uppercase"
          >
            <Wallet className="h-3.5 w-3.5 md:mr-1" />
            <span className="hidden lg:inline">Wallet</span>
          </Button>

          {user ? (
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="h-7 w-7 text-muted-foreground/60 hover:text-primary" title="Cerrar sesión">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => navigate("/auth")} className="h-7 w-7 text-muted-foreground/60 hover:text-primary" title="Iniciar sesión">
              <LogIn className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
