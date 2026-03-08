import { Button } from "@/components/ui/button";
import { ModelSelector } from "./ModelSelector";
import { Trash2, LogOut, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AI_MODELS } from "@/lib/ai-models";
import aitorLogo from "@/assets/aitor-brain-logo.png";

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
    if (error) toast.error("Error al cerrar sesión");
  };

  return (
    <header className="h-12 flex items-center justify-between px-4 border-b border-border bg-card/60 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <img src={aitorLogo} alt="AI Tor" className="w-6 h-6 object-contain" />
        <div className="flex flex-col leading-none">
          <span className="text-sm font-mono font-bold text-primary tracking-wider">AI Tor</span>
          {currentModel && (
            <span className="text-[9px] font-mono text-muted-foreground/60 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse inline-block" />
              {currentModel.name}
            </span>
          )}
        </div>

        {user && (
          <div className="hidden md:flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-md bg-muted/30 border border-border">
            <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
            <span className="text-[9px] font-mono text-muted-foreground/70 truncate max-w-[80px]">
              {user.email?.split('@')[0]}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <ModelSelector value={selectedModel} onChange={onModelChange} />

        {hasMessages && (
          <Button variant="ghost" size="icon" onClick={onClear} className="h-8 w-8 text-muted-foreground/50 hover:text-destructive" title="Nuevo chat">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}

        {user ? (
          <Button variant="ghost" size="icon" onClick={handleSignOut} className="h-8 w-8 text-muted-foreground/50 hover:text-primary" title="Cerrar sesión">
            <LogOut className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" onClick={() => navigate('/auth')} className="h-8 w-8 text-muted-foreground/50 hover:text-primary" title="Iniciar sesión">
            <LogIn className="h-4 w-4" />
          </Button>
        )}
      </div>
    </header>
  );
}
