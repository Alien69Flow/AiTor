import { Button } from "@/components/ui/button";
import { ModelSelector } from "./ModelSelector";
import { Trash2, LogOut, LogIn, Wallet, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AI_MODELS } from "@/lib/ai-models";

interface ChatHeaderProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  onClear: () => void;
  hasMessages: boolean;
}

export function ChatHeader({ selectedModel, onModelChange, onClear, hasMessages }: ChatHeaderProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const currentModel = AI_MODELS.find(m => m.id === selectedModel);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error("Error al cerrar sesión");
    }
  };

  const handleConnectWallet = () => {
    toast.info("Conectar Wallet disponible próximamente", {
      description: "Desbloquea el modo Nexo Soberano con Web3"
    });
  };

  return (
    <header className="bg-card/80 backdrop-blur-xl border-b border-secondary/20 px-4 py-2.5">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Brand + Oracle Status */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">👽</span>
            <div className="flex flex-col">
              <span className="text-sm font-heading text-primary neon-text-gold tracking-wider leading-tight">
                AI Tor
              </span>
              {currentModel && (
                <span className="text-[9px] font-mono text-secondary/70 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                  {currentModel.name}
                </span>
              )}
            </div>
          </div>

          {/* User badge */}
          {user && (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full bg-secondary/10 border border-secondary/20">
              <div className="w-2 h-2 rounded-full bg-secondary" />
              <span className="text-[9px] font-mono text-secondary/80 truncate max-w-[100px]">
                {user.email?.split('@')[0]}
              </span>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleConnectWallet}
            className="h-8 px-3 text-[10px] font-heading tracking-wider border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 hover:border-primary/50 neon-border-gold transition-all duration-300 uppercase"
          >
            <Wallet className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Wallet</span>
          </Button>

          <ModelSelector value={selectedModel} onChange={onModelChange} />
          
          {hasMessages && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onClear}
              className="h-8 w-8 text-muted-foreground/60 hover:text-destructive"
              title="Limpiar chat"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}

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
              onClick={() => navigate('/auth')}
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
