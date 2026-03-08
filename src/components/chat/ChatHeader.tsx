import { Button } from "@/components/ui/button";
import { ModelSelector } from "./ModelSelector";
import { Trash2, LogOut, LogIn, PanelLeftOpen, PanelLeftClose, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AI_MODELS } from "@/lib/ai-models";
import alienflowLogo from "@/assets/alienflow-logo.png";

interface ChatHeaderProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  onClear: () => void;
  onNewChat: () => void;
  hasMessages: boolean;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  conversationTitle?: string;
}

export function ChatHeader({ selectedModel, onModelChange, onClear, onNewChat, hasMessages, onToggleSidebar, sidebarOpen, conversationTitle }: ChatHeaderProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const currentModel = AI_MODELS.find(m => m.id === selectedModel);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) toast.error("Error al cerrar sesión");
  };

  return (
    <header className="h-14 flex items-center justify-between px-3 border-b border-border/60 bg-card/40 backdrop-blur-md shrink-0">
      {/* Left: Toggle + Branding */}
      <div className="flex items-center gap-2 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="h-9 w-9 text-muted-foreground/50 hover:text-foreground shrink-0"
        >
          {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </Button>

        <div className="flex items-center gap-2.5">
          <img src={alienflowLogo} alt="AlienFlow" className="w-7 h-7 object-contain" />
          <div className="flex flex-col leading-none min-w-0">
            <span className="text-sm font-heading font-bold tracking-wider text-foreground">
              {conversationTitle ? conversationTitle : "AI Tor"}
            </span>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
              <span className="text-[9px] text-muted-foreground/50 truncate">
                {currentModel?.name || "Oracle"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Center: Model selector on larger screens */}
      <div className="hidden md:flex items-center">
        <ModelSelector value={selectedModel} onChange={onModelChange} />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        <div className="md:hidden">
          <ModelSelector value={selectedModel} onChange={onModelChange} />
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onNewChat}
          className="h-9 w-9 text-muted-foreground/40 hover:text-primary"
          title="Nuevo chat"
        >
          <Plus className="h-4 w-4" />
        </Button>

        {hasMessages && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClear}
            className="h-9 w-9 text-muted-foreground/40 hover:text-destructive"
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
            className="h-9 w-9 text-muted-foreground/40 hover:text-foreground"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/auth')}
            className="h-9 w-9 text-muted-foreground/40 hover:text-foreground"
            title="Iniciar sesión"
          >
            <LogIn className="h-4 w-4" />
          </Button>
        )}
      </div>
    </header>
  );
}
