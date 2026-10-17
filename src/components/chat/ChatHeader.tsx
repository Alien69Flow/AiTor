import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ModelSelector } from "./ModelSelector";
import { Trash2, LogOut, LogIn, PanelLeftOpen, PanelLeftClose, Plus, MessageSquare, BrainCircuit, Building2, Cpu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { ChatWorkspace } from "@/lib/chat-prefs";

interface ChatHeaderProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  onClear: () => void;
  onNewChat: () => void;
  hasMessages: boolean;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  workspace: ChatWorkspace;
  onWorkspaceChange: (workspace: ChatWorkspace) => void;
}

const WORKSPACES: { id: ChatWorkspace; label: string; icon: typeof MessageSquare; title: string }[] = [
  { id: "chat", label: "Chat", icon: MessageSquare, title: "Conversación con el oráculo" },
  { id: "neural", label: "Núcleo", icon: BrainCircuit, title: "Núcleo neural: skills, RAG y workflows en vivo" },
  { id: "city", label: "Ciudad", icon: Building2, title: "AlienFlow.Space DAO City" },
];

export function ChatHeader({ selectedModel, onModelChange, onClear, onNewChat, hasMessages, onToggleSidebar, sidebarOpen, workspace, onWorkspaceChange }: ChatHeaderProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const check = () => setIsCompact(window.innerWidth < 500);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) toast.error("Error al cerrar sesión");
  };

  const currentIndex = WORKSPACES.findIndex((entry) => entry.id === workspace);
  const nextWorkspace = WORKSPACES[(currentIndex + 1) % WORKSPACES.length];

  return (
    <header className={`flex items-center justify-between border-b border-border/60 bg-card/40 backdrop-blur-md shrink-0 ${isCompact ? "h-10 px-1.5" : "h-12 px-2 sm:px-3"}`}>
      {hasMessages && <h1 className="sr-only">AI Tor — Real-Time Intelligence Terminal</h1>}
      {/* Left */}
      <div className="flex items-center gap-1.5 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? "Cerrar barra lateral" : "Abrir barra lateral"}
          aria-expanded={sidebarOpen}
          aria-controls="agent-sidebar"
          title={sidebarOpen ? "Cerrar barra lateral (Esc)" : "Abrir barra lateral"}
          className={`h-8 w-8 shrink-0 border transition-colors ${sidebarOpen ? "border-primary/40 bg-primary/10 text-primary" : "border-transparent text-muted-foreground/60 hover:text-foreground hover:border-border/60"}`}
        >
          {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </Button>

        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center border border-primary/30 bg-primary/10"><Cpu className="h-3.5 w-3.5 text-primary" /></div>
          <div className="flex flex-col leading-none min-w-0">
            <span className="text-xs font-heading font-bold tracking-wider text-foreground truncate max-w-[120px] sm:max-w-none">
              AI Tor
            </span>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
              <span className="text-[8px] text-muted-foreground/40 truncate">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Center: workspace + oracle selector */}
      <div className="hidden items-center gap-2 md:flex">
        <div className="flex h-8 items-center border border-border/60 bg-muted/20 p-0.5">
          {WORKSPACES.map((entry) => {
            const active = workspace === entry.id;
            return (
              <Button
                key={entry.id}
                variant="ghost"
                size="sm"
                onClick={() => onWorkspaceChange(entry.id)}
                aria-pressed={active}
                title={entry.title}
                className={`h-7 rounded-sm px-2 text-[9px] uppercase ${active ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
              >
                <entry.icon className="h-3 w-3" />
                <span className="hidden lg:inline">{entry.label}</span>
              </Button>
            );
          })}
        </div>
        <ModelSelector value={selectedModel} onChange={onModelChange} />
      </div>

      {/* Right */}
      <div className="flex items-center gap-0.5">
        <div className="md:hidden">
          <ModelSelector value={selectedModel} onChange={onModelChange} />
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onWorkspaceChange(nextWorkspace.id)}
          aria-label={`Cambiar a ${nextWorkspace.label}`}
          title={`Cambiar a ${nextWorkspace.label}`}
          className="h-8 w-8 text-primary md:hidden"
        >
          <nextWorkspace.icon className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon" onClick={onNewChat} aria-label="Nuevo chat" className="h-8 w-8 text-muted-foreground/40 hover:text-primary" title="Nuevo chat">
          <Plus className="h-4 w-4" />
        </Button>

        {hasMessages && (
          <Button variant="ghost" size="icon" onClick={onClear} aria-label="Limpiar chat" className="h-8 w-8 text-muted-foreground/40 hover:text-destructive" title="Limpiar chat">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}

        {!isCompact && (
          user ? (
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Cerrar sesión" className="h-8 w-8 text-muted-foreground/40 hover:text-foreground" title="Cerrar sesión">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => navigate('/auth')} aria-label="Iniciar sesión" className="h-8 w-8 text-muted-foreground/40 hover:text-foreground" title="Iniciar sesión">
              <LogIn className="h-3.5 w-3.5" />
            </Button>
          )
        )}
      </div>
    </header>
  );
}
