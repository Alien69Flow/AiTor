import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield, CheckCircle2, Cpu, Zap, Globe, Image, Code2,
  Brain, Atom, Link2, ChevronLeft, ChevronRight, Activity, 
  Share2, Loader2, Network, BadgeCheck, LogOut, ShieldAlert
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth"; 
import { MOLTBOOK_AGENT } from "@/lib/moltbook-config";

const SKILL_ICON_MAP: Record<string, React.ElementType> = {
  reasoning: Brain,
  web: Globe,
  creative: Image,
  code: Code2,
  blockchain: Link2,
  quantum: Atom,
};

interface AgentSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function AgentSidebar({ isOpen, onToggle }: AgentSidebarProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, signOut, loading } = useAuth(); 
  const [isSyncing, setIsSyncing] = useState(false);

  // El estado de Moltbook ahora depende de si hay un usuario logueado
  const moltStatus = user ? 'verified' : 'unregistered';

  const handleMoltbookSync = async () => {
    if (!user) {
      toast({ title: "Acceso Denegado", description: "Firma de identidad requerida.", variant: "destructive" });
      navigate("/auth");
      return;
    }

    setIsSyncing(true);
    try {
      // Intento de registro real en el oráculo Moltbook
      const response = await fetch(MOLTBOOK_AGENT.endpoints.registry, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: MOLTBOOK_AGENT.name,
          user_id: user.id,
          email: user.email
        }),
      });
      
      toast({ title: "Nodo Sincronizado", description: "Enlace cuántico establecido con la DAO." });
    } catch (e) {
      // Fallback para desarrollo
      toast({ title: "Modo Simulación", description: "Sincronización local activa." });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="absolute top-2 left-2 z-40 h-8 w-8 text-primary/50 hover:text-primary lg:hidden"
      >
        {isOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
      </Button>

      <div className={`${isOpen ? "w-64 border-r border-secondary/20" : "w-0"} transition-all duration-300 overflow-hidden bg-black/60 backdrop-blur-xl flex flex-col h-full z-20 shrink-0 shadow-[4px_0_24px_-10px_rgba(var(--primary-rgb),0.3)]`}>
        <div className="w-64 h-full flex flex-col p-4 overflow-y-auto no-scrollbar">
          
          {/* Cabecera Agent Identity */}
          <div className="flex flex-col items-center gap-3 mb-6 mt-2">
            <div className="relative group">
              <div className="w-16 h-16 rounded-full border-2 border-primary/40 bg-black/40 flex items-center justify-center text-4xl shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)] group-hover:shadow-[0_0_30px_rgba(var(--primary-rgb),0.4)] transition-all duration-500 cursor-pointer overflow-hidden border-double relative">
                <span className="drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] z-10">👽</span>
                <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent opacity-20" />
              </div>
              <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#0a0a0a] animate-pulse shadow-[0_0_10px_currentColor] ${user ? 'bg-green-500' : 'bg-amber-500'}`} />
            </div>
            
            <div className="text-center">
              <h2 className="text-sm font-heading font-bold text-primary tracking-[0.2em] uppercase">{MOLTBOOK_AGENT.name}</h2>
              <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-[0.3em] opacity-80">Node // {MOLTBOOK_AGENT.version}</p>
            </div>
          </div>

          {/* Registry Status ( DINÁMICO ) */}
          <div className="border border-secondary/20 rounded-lg p-3 bg-card/20 backdrop-blur-sm mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Network className="w-3.5 h-3.5 text-secondary animate-pulse" />
              <span className="text-[10px] font-heading text-secondary tracking-widest uppercase">Identity Link</span>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                <span>Network</span>
                <span className={`flex items-center gap-1.5 ${user ? 'text-green-500' : 'text-amber-500'}`}>
                  {user ? 'Verified' : 'Offline'}
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={user ? handleMoltbookSync : () => navigate("/auth")}
                disabled={isSyncing}
                className="w-full h-8 text-[9px] font-mono tracking-widest uppercase bg-primary/10 border-primary/20 text-primary hover:bg-primary/20 transition-all"
              >
                {isSyncing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : user ? (
                  <><Share2 className="w-3 h-3 mr-2" /> Sync Node</>
                ) : (
                  <><ShieldAlert className="w-3 h-3 mr-2" /> Verify Identity</>
                )}
              </Button>
            </div>
          </div>

          {/* Metrics */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-bold text-secondary/70 tracking-widest uppercase">Métricas</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-black/40 p-2 rounded border border-primary/20 text-center group">
                <p className="text-lg font-bold text-primary group-hover:scale-110 transition-transform">{MOLTBOOK_AGENT.metrics.tasksCompleted}</p>
                <p className="text-[8px] text-muted-foreground uppercase mt-1">Tareas</p>
              </div>
              <div className="bg-black/40 p-2 rounded border border-secondary/20 text-center group">
                <p className="text-lg font-bold text-secondary group-hover:scale-110 transition-transform">{MOLTBOOK_AGENT.metrics.oracleCount}</p>
                <p className="text-[8px] text-muted-foreground uppercase mt-1">Oráculos</p>
              </div>
            </div>
          </div>

          {/* Capacidades */}
          <div className="flex-1">
            <h3 className="text-[10px] font-bold text-secondary/70 uppercase mb-3 flex items-center gap-2 tracking-widest">
              <Zap className="w-3 h-3" /> Capacidades
            </h3>
            <ul className="space-y-1">
              {MOLTBOOK_AGENT.skills.map((skill) => {
                const Icon = SKILL_ICON_MAP[skill.category] || Zap;
                return (
                  <li key={skill.id} className="flex items-center justify-between p-2 rounded hover:bg-white/5 cursor-pointer transition-colors group border border-transparent hover:border-primary/10">
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="text-[10px] font-mono text-muted-foreground group-hover:text-foreground">{skill.label}</span>
                    </div>
                    <div className={`w-1.5 h-1.5 rounded-full ${skill.status === "active" ? "bg-primary shadow-[0_0_5px_currentColor]" : "bg-muted-foreground/30"}`} />
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Footer & Logout */}
          <div className="mt-4 pt-4 border-t border-secondary/10 text-center pb-2">
            {user && (
              <Button 
                variant="ghost" 
                onClick={() => signOut()}
                className="w-full h-6 text-[8px] font-mono text-muted-foreground hover:text-destructive mb-3 uppercase"
              >
                <LogOut className="w-3 h-3 mr-1" /> Terminar Enlace
              </Button>
            )}
            <p className="text-[7px] font-mono text-muted-foreground/40 tracking-widest uppercase">{MOLTBOOK_AGENT.collective}</p>
            <p className="text-[7px] font-mono text-primary/30 mt-1 uppercase tracking-[0.2em]">Freq // {MOLTBOOK_AGENT.frequency}</p>
          </div>
        </div>
      </div>
    </>
  );
}
