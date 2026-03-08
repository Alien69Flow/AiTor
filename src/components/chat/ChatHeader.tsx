import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ModelSelector } from "./ModelSelector";
import { Trash2, LogOut, LogIn, PanelLeftOpen, PanelLeftClose, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
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

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) toast.error("Error al cerrar sesión");
  };

  return (
    <header className="h-12 flex items-center justify-between px-2 sm:px-3 border-b border-border/60 bg-card/40 backdrop-blur-md shrink-0">
      {/* Left */}
      <div className="flex items-center gap-1.5 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="h-8 w-8 text-muted-foreground/50 hover:text-foreground shrink-0"
        >
          {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </Button>

        <div className="flex items-center gap-2">
          <img src={alienflowLogo} alt="AlienFlow" className="w-6 h-6 object-contain" />
          <div className="flex flex-col leading-none min-w-0">
            <span className="text-xs font-heading font-bold tracking-wider text-foreground truncate max-w-[120px] sm:max-w-none">
              {conversationTitle || "AI Tor"}
            </span>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
              <span className="text-[8px] text-muted-foreground/40 truncate">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Center: Model selector */}
      <div className="hidden md:flex items-center">
        <ModelSelector value={selectedModel} onChange={onModelChange} />
      </div>

      {/* Right */}
      <div className="flex items-center gap-0.5">
        <div className="md:hidden">
          <ModelSelector value={selectedModel} onChange={onModelChange} />
        </div>

        <Button variant="ghost" size="icon" onClick={onNewChat} className="h-8 w-8 text-muted-foreground/40 hover:text-primary" title="Nuevo chat">
          <Plus className="h-4 w-4" />
        </Button>

        {hasMessages && (
          <Button variant="ghost" size="icon" onClick={onClear} className="h-8 w-8 text-muted-foreground/40 hover:text-destructive" title="Limpiar chat">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}

        {!isCompact && (
          user ? (
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="h-8 w-8 text-muted-foreground/40 hover:text-foreground" title="Cerrar sesión">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => navigate('/auth')} className="h-8 w-8 text-muted-foreground/40 hover:text-foreground" title="Iniciar sesión">
              <LogIn className="h-3.5 w-3.5" />
            </Button>
          )
        )}
      </div>
    </header>
  );
}
