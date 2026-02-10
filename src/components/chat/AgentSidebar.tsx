import { useState } from "react";
import {
  Shield, CheckCircle2, Cpu, Zap, Globe, Image, Code2,
  Brain, Atom, Link2, ChevronLeft, ChevronRight, Activity, Share2, Loader2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MOLTBOOK_AGENT, type MoltbookSkill } from "@/lib/moltbook-config";

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
  const [isSyncing, setIsSyncing] = useState(false);

  const [moltStatus, setMoltStatus] = useState<'unregistered' | 'pending' | 'verified'>(() => {
    return (localStorage.getItem('aitor_molt_status') as any) || 'unregistered';
  });

  const handleMoltbookSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch(MOLTBOOK_AGENT.endpoints.registry, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: MOLTBOOK_AGENT.name,
          description: MOLTBOOK_AGENT.description,
        }),
      });

      const data = await response.json();

      // Never store API keys client-side — only persist status
      if (data.agent) {
        localStorage.setItem('aitor_molt_status', 'pending');
        setMoltStatus('pending');
        toast({ title: "Protocolo Iniciado", description: "Claim URL generado." });
        if (data.agent.claim_url) window.open(data.agent.claim_url, '_blank');
      }
    } catch {
      setMoltStatus('pending');
      localStorage.setItem('aitor_molt_status', 'pending');
      toast({ title: "Modo Simulación", description: "Sincronización iniciada." });
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
        className="absolute top-3 left-3 z-40 h-7 w-7 text-muted-foreground/60 hover:text-primary"
      >
        {isOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>

      <div
        className={`${isOpen ? "w-64" : "w-0"} transition-all duration-300 overflow-hidden border-r border-border/30 bg-sidebar flex-shrink-0`}
      >
        <div className="w-64 h-full flex flex-col p-4 pt-12 overflow-y-auto">
          {/* Agent Identity */}
          <div className="text-center mb-4">
            <div className="w-16 h-16 mx-auto rounded-full border-2 border-primary/50 bg-card flex items-center justify-center text-3xl mb-2">
              👽
            </div>
            <h2 className="font-heading text-primary text-lg tracking-wider">
              {MOLTBOOK_AGENT.name}
            </h2>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              {MOLTBOOK_AGENT.version}
            </p>
          </div>

          {/* Moltbook Registry */}
          <div className="border border-border/30 rounded-md p-3 bg-card/40 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-secondary" />
              <span className="text-xs font-heading text-secondary tracking-wide uppercase">
                Moltbook Registry
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground font-mono">Status</span>
                <Badge
                  variant="outline"
                  className={`text-[9px] gap-1 ${
                    moltStatus === 'verified' ? 'border-green-500 text-green-500' : 'border-amber-500 text-amber-500'
                  }`}
                >
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  {moltStatus === 'unregistered' ? 'Offline' : moltStatus === 'pending' ? 'Pendiente' : 'Soberano'}
                </Badge>
              </div>

              <Button
                size="sm"
                onClick={handleMoltbookSync}
                disabled={isSyncing || moltStatus === 'verified'}
                className="w-full h-7 text-[9px] font-bold uppercase tracking-tighter bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isSyncing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : moltStatus === 'unregistered' ? (
                  <><Share2 className="w-3 h-3 mr-1" /> Sync Moltbook</>
                ) : (
                  "Verificar en X"
                )}
              </Button>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-muted-foreground font-mono">Protocolo</span>
                <span className="text-[10px] text-primary font-mono">{MOLTBOOK_AGENT.protocol}</span>
              </div>
            </div>
          </div>

          <Separator className="bg-border/20 mb-4" />

          {/* Metrics */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-3.5 h-3.5 text-primary animate-pulse" />
              <span className="text-[10px] font-heading text-primary tracking-wider uppercase">
                Métricas
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="border border-border/20 rounded p-2 bg-card/30 text-center">
                <p className="text-lg font-heading text-primary">{MOLTBOOK_AGENT.metrics.tasksCompleted}</p>
                <p className="text-[8px] text-muted-foreground font-mono uppercase">Tareas</p>
              </div>
              <div className="border border-border/20 rounded p-2 bg-card/30 text-center">
                <p className="text-lg font-heading text-secondary">{MOLTBOOK_AGENT.metrics.oracleCount}</p>
                <p className="text-[8px] text-muted-foreground font-mono uppercase">Oráculos</p>
              </div>
            </div>
          </div>

          <Separator className="bg-border/20 mb-4" />

          {/* Skills from Moltbook config */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="w-3.5 h-3.5 text-secondary" />
              <span className="text-[10px] font-heading text-secondary tracking-wider uppercase">
                Capacidades
              </span>
            </div>
            <div className="space-y-1.5">
              {MOLTBOOK_AGENT.skills.map((skill) => {
                const Icon = SKILL_ICON_MAP[skill.category] || Zap;
                return (
                  <div
                    key={skill.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded border border-border/10 bg-card/20 hover:bg-card/40 transition-colors"
                  >
                    <Icon className="w-3.5 h-3.5 text-primary/70" />
                    <span className="text-[10px] text-foreground/80 flex-1">{skill.label}</span>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      skill.status === "active" ? "bg-secondary animate-pulse" : "bg-primary/50"
                    }`} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-auto pt-4 text-center">
            <p className="text-[7px] font-mono text-muted-foreground/40 tracking-widest uppercase">
              {MOLTBOOK_AGENT.collective}
            </p>
            <p className="text-[7px] font-mono text-primary/30 mt-0.5 uppercase">
              {MOLTBOOK_AGENT.frequency}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
