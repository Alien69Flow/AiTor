import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Brain, Atom, Image, Code2, Globe, Link2,
  ChevronLeft, ChevronRight, Activity,
  Share2, Loader2, Network, LogOut, Zap, MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useMoltbook } from "@/hooks/useMoltbook";
import { MOLTBOOK_AGENT } from "@/lib/moltbook-config";
import { Progress } from "@/components/ui/progress";
import { ConversationHistory } from "./ConversationHistory";
import type { Conversation } from "@/hooks/useChat";

const SKILL_ICON_MAP: Record<string, React.ElementType> = {
  reasoning: Brain,
  web: Globe,
  creative: Image,
  code: Code2,
  blockchain: Link2,
  quantum: Atom,
};

const SKILL_LEVELS: Record<string, number> = {
  reasoning: 92, web: 85, creative: 78, code: 95, blockchain: 88, quantum: 72,
};

interface AgentSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onNewConversation: () => void;
}

export function AgentSidebar({
  isOpen, onToggle,
  conversations, currentConversationId,
  onSelectConversation, onDeleteConversation, onNewConversation,
}: AgentSidebarProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { registerAgent, isRegistering } = useMoltbook();
  const [activeTab, setActiveTab] = useState<"agent" | "history">("history");

  const handleMoltbookSync = async () => {
    if (!user) {
      toast({ title: "Acceso Denegado", description: "Inicia sesión para sincronizar tu nodo.", variant: "destructive" });
      navigate("/auth");
      return;
    }
    const agentData = await registerAgent();
    if (agentData?.claim_url) {
      toast({ title: "Enlace Iniciado", description: "Redirigiendo para verificación..." });
      setTimeout(() => { window.open(agentData.claim_url, "_blank"); }, 1500);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="absolute top-2 left-2 z-40 h-8 w-8 text-primary/50 hover:text-primary"
      >
        {isOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
      </Button>

      <div className={`${isOpen ? "w-60 border-r border-secondary/15" : "w-0"} transition-all duration-300 overflow-hidden bg-card/40 backdrop-blur-xl flex flex-col h-full z-20 shrink-0`}>
        <div className="w-60 h-full flex flex-col p-4 overflow-y-auto no-scrollbar">

          {/* Tab Switcher */}
          <div className="flex items-center gap-1 mb-4 p-0.5 rounded-lg bg-muted/20 border border-border/30">
            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-heading tracking-wider uppercase transition-all ${
                activeTab === "history" ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground/50 hover:text-foreground"
              }`}
            >
              <MessageSquare className="w-3 h-3" /> Historial
            </button>
            <button
              onClick={() => setActiveTab("agent")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-heading tracking-wider uppercase transition-all ${
                activeTab === "agent" ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground/50 hover:text-foreground"
              }`}
            >
              <Zap className="w-3 h-3" /> Agente
            </button>
          </div>

          {activeTab === "history" ? (
            <ConversationHistory
              conversations={conversations}
              currentId={currentConversationId}
              onSelect={onSelectConversation}
              onDelete={onDeleteConversation}
              onNew={onNewConversation}
            />
          ) : (
            <>
              {/* Agent Identity */}
              <div className="flex flex-col items-center gap-3 mb-6 mt-2">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl border border-primary/20 bg-card/60 flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(var(--primary-rgb),0.15)] transition-all duration-500 overflow-hidden">
                    <span className="drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">⚡</span>
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-card ${user ? 'bg-secondary shadow-[0_0_8px_hsl(75,100%,34%,0.5)]' : 'bg-muted-foreground/40'}`} />
                </div>
                <div className="text-center">
                  <h2 className="text-sm font-heading text-primary tracking-wider">{MOLTBOOK_AGENT.name}</h2>
                  <p className="text-[9px] text-muted-foreground/50 font-mono mt-0.5">v{MOLTBOOK_AGENT.version}</p>
                </div>
              </div>

              {/* Sync Node */}
              <div className="rounded-xl border border-secondary/15 p-3 bg-card/30 mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <Network className="w-3.5 h-3.5 text-secondary/70" />
                  <span className="text-[10px] font-heading text-secondary/70 tracking-wider uppercase">Identity Link</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground/50 font-mono mb-3">
                  <span>X Account</span>
                  <span className="text-primary/60">@Alien69Flow</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMoltbookSync}
                  disabled={isRegistering}
                  className="w-full h-8 text-[10px] font-heading tracking-wider uppercase bg-secondary/5 border-secondary/20 text-secondary/80 hover:bg-secondary/15 hover:text-secondary transition-all rounded-lg"
                >
                  {isRegistering ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <><Share2 className="w-3 h-3 mr-2" /> Sync Node</>
                  )}
                </Button>
              </div>

              {/* Metrics */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-3 h-3 text-primary/60" />
                  <span className="text-[10px] font-heading text-muted-foreground/60 tracking-wider uppercase">Métricas</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-card/40 p-2.5 rounded-xl border border-primary/10 text-center">
                    <p className="text-lg font-heading text-primary">{MOLTBOOK_AGENT.metrics.tasksCompleted}</p>
                    <p className="text-[8px] text-muted-foreground/50 uppercase mt-0.5">Tareas</p>
                  </div>
                  <div className="bg-card/40 p-2.5 rounded-xl border border-secondary/10 text-center">
                    <p className="text-lg font-heading text-secondary">{MOLTBOOK_AGENT.metrics.oracleCount}</p>
                    <p className="text-[8px] text-muted-foreground/50 uppercase mt-0.5">Oráculos</p>
                  </div>
                </div>
              </div>

              {/* Capabilities */}
              <div className="flex-1">
                <h3 className="text-[10px] font-heading text-muted-foreground/60 uppercase mb-3 flex items-center gap-2 tracking-wider">
                  <Zap className="w-3 h-3" /> Capacidades
                </h3>
                <ul className="space-y-2.5">
                  {MOLTBOOK_AGENT.skills.map((skill) => {
                    const Icon = SKILL_ICON_MAP[skill.category] || Zap;
                    const level = SKILL_LEVELS[skill.category] || 70;
                    return (
                      <li key={skill.id} className="group">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Icon className="w-3 h-3 text-muted-foreground/50 group-hover:text-secondary transition-colors" />
                            <span className="text-[10px] text-muted-foreground/70 group-hover:text-foreground/80 transition-colors">{skill.label}</span>
                          </div>
                          <span className="text-[9px] font-mono text-muted-foreground/40">{level}%</span>
                        </div>
                        <Progress value={level} className="h-1 bg-muted/30" />
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="mt-4 pt-4 border-t border-secondary/10 text-center pb-2">
            {user && (
              <Button
                variant="ghost"
                onClick={() => signOut()}
                className="w-full h-7 text-[9px] font-mono text-muted-foreground/40 hover:text-destructive mb-2 uppercase tracking-wider"
              >
                <LogOut className="w-3 h-3 mr-1" /> Cerrar sesión
              </Button>
            )}
            <p className="text-[8px] font-mono text-muted-foreground/30 tracking-wider">{MOLTBOOK_AGENT.collective}</p>
          </div>
        </div>
      </div>
    </>
  );
}
