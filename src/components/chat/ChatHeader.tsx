import { Button } from "@/components/ui/button";
import { ModelSelector } from "./ModelSelector";
import { Trash2, LogOut, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import alienflowLogo from "@/assets/alienflow-logo.png";

interface ChatHeaderProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  onClear: () => void;
  hasMessages: boolean;
}

export function ChatHeader({ selectedModel, onModelChange, onClear, hasMessages }: ChatHeaderProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error("Error al cerrar sesión");
    }
  };

  return (
    <header className="flex items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-sm px-4 py-3">
      <div className="flex items-center gap-3">
        {/* AlienFlow Official Logo */}
        <img 
          src={alienflowLogo} 
          alt="AlienFlow Logo" 
          className="w-12 h-12 object-contain"
        />
        
        <div className="flex flex-col">
          <h1 className="text-lg font-heading font-bold tracking-tight">
            <span className="text-secondary">Δlieπ</span>
            <span className="text-primary">FlΦw</span>
            <span className="text-secondary"> $pac€</span>
            <span className="text-primary"> DAO</span>
          </h1>
          <span className="text-[10px] tracking-widest text-muted-foreground font-body">
            AI Tor • ΓΩΣΖ Synapse
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <ModelSelector value={selectedModel} onChange={onModelChange} />
        
        {hasMessages && (
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onClear}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}

        {user ? (
          <>
            <span className="text-xs text-muted-foreground hidden sm:block max-w-[120px] truncate">
              {user.email}
            </span>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-primary"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/auth')}
            className="gap-2"
          >
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">Guardar historial</span>
          </Button>
        )}
      </div>
    </header>
  );
}
