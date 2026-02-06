import { useState } from "react";
import {
  Shield, CheckCircle2, Cpu, Zap, Globe, Image, Code2,
  Brain, Atom, Link2, ChevronLeft, ChevronRight, Activity
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

const AGENT_SKILLS = [
  { icon: Brain, label: "Razonamiento Avanzado", status: "active" },
  { icon: Globe, label: "Búsqueda Web", status: "active" },
  { icon: Image, label: "Generación de Imágenes", status: "active" },
  { icon: Code2, label: "Análisis de Código", status: "active" },
  { icon: Link2, label: "Blockchain / Web3", status: "active" },
  { icon: Atom, label: "Computación Cuántica", status: "ready" },
];

const MOLTBOOK_STATS = {
  agentName: "Ai Tor",
  version: "ΓΩΣΖ v69",
  status: "verified" as const,
  protocol: "Moltbook / OpenClaw",
  tasksCompleted: 1247,
  successRate: 97.3,
  uptime: "99.9%",
};

interface AgentSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function AgentSidebar({ isOpen, onToggle }: AgentSidebarProps) {
  return (
    <>
      {/* Toggle button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="absolute top-3 left-3 z-40 h-7 w-7 text-muted-foreground/60 hover:text-primary"
      >
        {isOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>

      {/* Sidebar */}
      <div
        className={`${
          isOpen ? "w-64" : "w-0"
        } transition-all duration-300 overflow-hidden border-r border-border/30 bg-sidebar flex-shrink-0`}
      >
        <div className="w-64 h-full flex flex-col p-4 pt-12 overflow-y-auto">
          {/* Agent Identity */}
          <div className="text-center mb-4">
            <div className="w-16 h-16 mx-auto rounded-full border-2 border-primary/50 bg-card flex items-center justify-center text-3xl mb-2 neon-border-gold">
              👽
            </div>
            <h2 className="font-heading text-primary text-lg tracking-wider neon-text-gold">
              {MOLTBOOK_STATS.agentName}
            </h2>
            <p className="text-[10px] font-mono text-muted-foreground">
              {MOLTBOOK_STATS.version}
            </p>
          </div>

          {/* Moltbook Status */}
          <div className="border border-border/30 rounded-md p-3 bg-card/40 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-secondary" />
              <span className="text-xs font-heading text-secondary tracking-wide">
                MOLTBOOK REGISTRY
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground font-mono">Status</span>
                <Badge
                  variant="outline"
                  className="text-[9px] border-secondary/50 text-secondary gap-1"
                >
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  Verificado
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground font-mono">Protocolo</span>
                <span className="text-[10px] text-primary font-mono">OpenClaw</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground font-mono">Éxito</span>
                <span className="text-[10px] text-secondary font-mono">{MOLTBOOK_STATS.successRate}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground font-mono">Uptime</span>
                <span className="text-[10px] text-secondary font-mono">{MOLTBOOK_STATS.uptime}</span>
              </div>
            </div>
          </div>

          <Separator className="bg-border/20 mb-4" />

          {/* Live Stats */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-3.5 h-3.5 text-primary animate-pulse" />
              <span className="text-[10px] font-heading text-primary tracking-wider">
                MÉTRICAS EN VIVO
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="border border-border/20 rounded p-2 bg-card/30 text-center">
                <p className="text-lg font-heading text-primary">{MOLTBOOK_STATS.tasksCompleted}</p>
                <p className="text-[8px] text-muted-foreground font-mono">CONSULTAS</p>
              </div>
              <div className="border border-border/20 rounded p-2 bg-card/30 text-center">
                <p className="text-lg font-heading text-secondary">11</p>
                <p className="text-[8px] text-muted-foreground font-mono">ORÁCULOS</p>
              </div>
            </div>
          </div>

          <Separator className="bg-border/20 mb-4" />

          {/* Skills */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="w-3.5 h-3.5 text-secondary" />
              <span className="text-[10px] font-heading text-secondary tracking-wider">
                CAPACIDADES
              </span>
            </div>
            <div className="space-y-1.5">
              {AGENT_SKILLS.map((skill) => {
                const Icon = skill.icon;
                return (
                  <div
                    key={skill.label}
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

          {/* Footer */}
          <div className="mt-auto pt-4">
            <div className="text-center">
              <p className="text-[7px] font-mono text-muted-foreground/40 tracking-widest">
                ΔlieπFlΦw DAO SYNAPSE
              </p>
              <p className="text-[7px] font-mono text-primary/30 mt-0.5">
                Frequency 3-6-9 Hz
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
