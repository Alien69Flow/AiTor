import { Button } from "@/components/ui/button";
import { ModelSelector } from "./ModelSelector";
import { Trash2, LogOut, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useState, useEffect } from "react";

interface ChatHeaderProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  onClear: () => void;
  hasMessages: boolean;
}

export function ChatHeader({ selectedModel, onModelChange, onClear, hasMessages }: ChatHeaderProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    // Generate random hex session ID
    setSessionId(Math.random().toString(16).slice(2, 10).toUpperCase());
  }, []);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error("Error al cerrar sesión");
    }
  };

  return (
    <header className="bg-card/90 backdrop-blur-sm border-b border-secondary/40">
      {/* Terminal window bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-secondary/20">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-destructive/80 hover:bg-destructive transition-colors" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 hover:bg-yellow-500 transition-colors" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/80 hover:bg-green-500 transition-colors" />
        </div>
        
        <div className="flex-1 flex items-center justify-center gap-2">
          <span className="text-xs font-mono text-secondary font-medium tracking-wider">
            [ AI_TOR.v69 ]
          </span>
          <span className="flex items-center gap-1 text-[10px] text-primary font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            SYNCED
          </span>
        </div>

        <div className="w-[52px]" /> {/* Spacer for balance */}
      </div>
      
      {/* Controls row */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="flex flex-col">
          <span className="text-[10px] font-mono text-muted-foreground tracking-wide">
            ΔlieπFlΦw DAO Synapse
          </span>
          <span className="text-[9px] font-mono text-secondary/60">
            SESSION:0x{sessionId}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          <ModelSelector value={selectedModel} onChange={onModelChange} />
          
          {hasMessages && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onClear}
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}

          {user ? (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleSignOut}
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              title="Cerrar sesión"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/auth')}
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              title="Guardar historial"
            >
              <LogIn className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
