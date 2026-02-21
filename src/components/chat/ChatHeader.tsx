import { Button } from "@/components/ui/button";
import { ModelSelector } from "./ModelSelector";
import { Trash2, LogOut, LogIn, Wallet, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useState, useEffect } from "react";
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
  const [sessionId, setSessionId] = useState("");

  const currentModel = AI_MODELS.find(m => m.id === selectedModel);

  useEffect(() => {
    // Generamos el ID de sesión hexadecimal aleatorio (Mejora de Febrero)
    setSessionId(Math.random().toString(16).slice(2, 10).toUpperCase());
  }, []);

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
    <header className="bg-card/90 backdrop-blur-md border-b border-secondary/40">
      {/* Terminal window bar: Estética Mac/Linux con semáforo */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-secondary/20">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-destructive/80 hover:bg-destructive transition-colors cursor-pointer" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 hover:bg-yellow-500 transition-colors cursor-pointer" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/80 hover:bg-green-500 transition-colors cursor-pointer" />
        </div>
        
        <div className="flex-1 flex items-center justify-center gap-2">
          <span className="text-xs font-heading text-primary neon-text-gold tracking-wider">
            [ AI_TOR.v69 ]
          </span>
          <span className="flex items-center gap-1 text-[10px] text-secondary font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
            SYNCED
          </span>
        </div>

        {/* Indicador del Oráculo Activo con icono de rayo parpadeante */}
        {currentModel && (
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <Zap className="w-2.5 h-2.5 text-primary animate-pulse" />
            <span className="hidden sm:inline">{currentModel.oracleIcon}</span>
          </div>
        )}
      </div>
      
      {/* Fila de controles: DAO ID y Botones de acción */}
      <div className="flex items-center justify-between px-3 py-1.5 gap-2">
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-heading text-secondary tracking-wide truncate">
            ΔlieπFlΦw DAO Synapse
          </span>
          <span className="text-[9px] font-mono text-muted-foreground/60 truncate">
            SESSION:0x{sessionId}
          </span>
        </div>
        
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Botón de Wallet con efecto neón que recuperamos del log */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleConnectWallet}
            className="h-7 px-2 text-[10px] font-mono border-secondary/50 bg-secondary/10 text-secondary hover:bg-secondary/20 hover:border-secondary hover:text-secondary-foreground neon-border transition-all duration-300"
          >
            <Wallet className="h-3 w-3 mr-1" />
            <span className="hidden sm:inline">Wallet</span>
          </Button>

          <ModelSelector value={selectedModel} onChange={onModelChange} />
          
          {hasMessages && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onClear}
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              title="Limpiar frecuencia"
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
              title="Guardar historial (Login)"
            >
              <LogIn className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
