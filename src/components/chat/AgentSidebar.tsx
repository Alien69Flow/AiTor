import { useState, type ElementType } from "react";
import { useNavigate } from "react-router-dom";
import {
  Brain, Atom, Image, Code2, Globe, Link2,
  Activity, Building2,
  Share2, Loader2, Network, LogOut, Zap, MessageSquare, X, Route as RouteIcon,
  Database, Layers3, Cpu, Wallet, ArrowRight, ShieldCheck, ExternalLink, UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useMoltbook } from "@/hooks/useMoltbook";
import { useTier } from "@/hooks/useTier";
import { useAppKit } from "@reown/appkit/react";
import { useAccount } from "wagmi";
import { MOLTBOOK_AGENT } from "@/lib/moltbook-config";
import { Progress } from "@/components/ui/progress";
import { ConversationHistory } from "./ConversationHistory";
import type { Conversation } from "@/hooks/useChat";
import type { ChatWorkspace } from "@/lib/chat-prefs";
import {
  CORE_META,
  DOCUMENTED_DOMAINS,
  LOCAL_KNOWLEDGE_BASES,
  SKILL_NODES,
  SKILL_PROMPTS,
  TOKEN_ESTIMATE_NOTE,
  WORKFLOW_ROUTES,
  formatTokens,
} from "@/lib/neural-core-model";

const SKILL_ICON_MAP: Record<string, ElementType> = {
  reasoning: Brain,
  web: Globe,
  creative: Image,
  code: Code2,
  blockchain: Link2,
  quantum: Atom,
};

const WORKSPACES: { id: ChatWorkspace; label: string; icon: typeof MessageSquare }[] = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "neural", label: "Núcleo", icon: Brain },
  { id: "city", label: "Ciudad", icon: Building2 },
];

interface SessionStats {
  queries: number;
  replies: number;
  tokens: number;
  /** True when every reply carried real provider usage. */
  tokensExact: boolean;
  thinking: boolean;
}

interface AgentSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onNewConversation: () => void;
  workspace: ChatWorkspace;
  onWorkspaceChange: (workspace: ChatWorkspace) => void;
  sessionStats: SessionStats;
  /** Runs a real task in the chat with the active oracle. */
  onPrompt: (prompt: string) => void;
}

const TIER_LABEL: Record<string, string> = {
  signal: "Signal · gratis",
  node: "Node · con cuenta",
  synapse: "Synapse · suscripción",
  oracle: "Oracle · NFT DAO",
  quantum: "Quantum · NFT + stake",
};

/** Real tasks the sidebar can launch without leaving the dashboard. */
const UTILITIES: { id: string; label: string; prompt: string }[] = [
  { id: "market", label: "Mercado", prompt: "Dame un resumen del mercado cripto de hoy con datos concretos y la fuente de cada cifra: " },
  { id: "osint", label: "OSINT", prompt: "Haz un barrido OSINT de este tema usando fuentes oficiales y devuelve enlaces con fecha: " },
  { id: "security", label: "Seguridad", prompt: "Revisa este código o configuración desde la seguridad y separa hallazgos comprobables de riesgos hipotéticos: " },
  { id: "content", label: "Contenido", prompt: "Prepara una propuesta de contenido para la DAO lista para revisión humana, sin publicar nada: " },
];

export function AgentSidebar({
  isOpen, onToggle, onClose,
  conversations, currentConversationId,
  onSelectConversation, onDeleteConversation, onNewConversation,
  workspace, onWorkspaceChange, sessionStats, onPrompt,
}: AgentSidebarProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { registerAgent, isRegistering } = useMoltbook();
  const { tier } = useTier();
  const { open } = useAppKit();
  const { address, isConnected, chainId } = useAccount();
  const [activeTab, setActiveTab] = useState<"core" | "history" | "agent">("core");

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

  const tabs: { id: typeof activeTab; label: string }[] = [
    { id: "core", label: "Núcleo" },
    { id: "history", label: "Historial" },
    { id: "agent", label: "Agente" },
  ];

  return (
    <>
      {isOpen && <button className="fixed inset-0 z-[60] bg-background/70 md:hidden" onClick={onToggle} aria-label="Cerrar panel lateral" />}
      <aside
        id="agent-sidebar"
        aria-label="Panel de agentes AI Tor"
        aria-hidden={!isOpen}
        className={`${isOpen ? "translate-x-0 visible md:w-60 md:border-r" : "-translate-x-full invisible md:w-0 md:translate-x-0"} fixed inset-y-0 left-0 z-[70] w-64 overflow-hidden border-secondary/15 bg-card/95 backdrop-blur-xl transition-all duration-300 md:relative md:z-20 md:flex md:h-full md:shrink-0`}
      >
        <div className="w-60 h-full flex flex-col p-3 overflow-y-auto no-scrollbar">
          {/* Header */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center border border-primary/30 bg-primary/10">
                <Cpu className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-mono text-[10px] uppercase tracking-wider text-foreground/85">Panel de agentes</p>
                <p className="truncate font-mono text-[9px] text-muted-foreground">{CORE_META.collective}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Cerrar panel lateral"
              title="Cerrar panel (Esc)"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Workspace switcher */}
          <div className="mb-3 grid grid-cols-3 gap-0.5 border border-border/40 bg-muted/20 p-0.5" role="group" aria-label="Vista del espacio de trabajo">
            {WORKSPACES.map((entry) => {
              const active = workspace === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onWorkspaceChange(entry.id)}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-1 rounded-sm py-1.5 font-mono text-[9px] uppercase transition-colors ${
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground/60 hover:text-foreground"
                  }`}
                >
                  <entry.icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {entry.label}
                </button>
              );
            })}
          </div>

          {/* Tab switcher */}
          <div className="mb-4 flex items-center gap-1 rounded-lg border border-border/30 bg-muted/20 p-0.5" role="tablist" aria-label="Secciones del panel">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 rounded-md py-1.5 font-heading text-[9px] uppercase tracking-wider transition-all ${
                  activeTab === tab.id ? "border border-primary/20 bg-primary/10 text-primary" : "text-muted-foreground/50 hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "history" && (
            <div className="flex min-h-0 flex-1 flex-col">
              <ConversationHistory
                conversations={conversations}
                currentId={currentConversationId}
                onSelect={onSelectConversation}
                onDelete={onDeleteConversation}
                onNew={onNewConversation}
              />
              <p className="mt-3 font-mono text-[8px] leading-relaxed text-muted-foreground/50">
                La terminal conserva un único hilo en este dispositivo. Cambiar de oráculo no lo borra.
              </p>
            </div>
          )}

          {activeTab === "core" && (
            <div className="flex flex-1 flex-col gap-4">
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 font-heading text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  <Activity className="h-3 w-3" aria-hidden="true" /> Sesión en vivo
                </h3>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="border border-primary/10 bg-card/40 p-2 text-center">
                    <p className="font-heading text-base text-primary">{sessionStats.queries}</p>
                    <p className="font-mono text-[8px] uppercase text-muted-foreground/50">Consultas</p>
                  </div>
                  <div className="border border-secondary/10 bg-card/40 p-2 text-center">
                    <p className="font-heading text-base text-secondary">{sessionStats.replies}</p>
                    <p className="font-mono text-[8px] uppercase text-muted-foreground/50">Respuestas</p>
                  </div>
                </div>
                <div
                  className="mt-1.5 flex items-center justify-between border border-border/40 bg-card/30 px-2 py-1.5 font-mono text-[9px]"
                  title={sessionStats.tokensExact ? "Tokens reales reportados por el proveedor." : TOKEN_ESTIMATE_NOTE}
                >
                  <span className="text-muted-foreground">{sessionStats.tokensExact ? "Tokens" : "Tokens ≈"}</span>
                  <span className="text-foreground/85">{formatTokens(sessionStats.tokens)}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between border border-border/40 bg-card/30 px-2 py-1.5 font-mono text-[9px]">
                  <span className="text-muted-foreground">Estado</span>
                  <span className={sessionStats.thinking ? "text-amber-300" : "text-primary"}>
                    {sessionStats.thinking ? "INFERENCIA" : "EN ESPERA"}
                  </span>
                </div>
              </section>

              <section>
                <h3 className="mb-2 flex items-center gap-1.5 font-heading text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  <Zap className="h-3 w-3" aria-hidden="true" /> Skills ({SKILL_NODES.length})
                </h3>
                <ul className="space-y-2.5">
                  {SKILL_NODES.map((skill) => {
                    const Icon = SKILL_ICON_MAP[skill.category] || Zap;
                    return (
                      <li key={skill.id}>
                        <button
                          type="button"
                          onClick={() =>
                            onPrompt(SKILL_PROMPTS[skill.id] ?? `${skill.label}: `)
                          }
                          title={`Lanzar esta skill en el chat — ${skill.label}`}
                          className="group w-full text-left"
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <Icon className="h-3 w-3 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-secondary" aria-hidden="true" />
                              <span className="truncate text-[10px] text-muted-foreground/70 transition-colors group-hover:text-secondary">{skill.label}</span>
                            </div>
                            <span className="flex shrink-0 items-center gap-1 font-mono text-[9px] text-muted-foreground/40 transition-colors group-hover:text-secondary/80">
                              {skill.level}%
                              <ArrowRight className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                            </span>
                          </div>
                          <Progress value={skill.level} className="h-1 bg-muted/30" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 font-mono text-[8px] leading-relaxed text-muted-foreground/45">
                  Niveles configurados en el registro del agente, no medidos en vivo. Pulsa una skill para lanzarla en el chat.
                </p>
              </section>

              <section>
                <h3 className="mb-2 flex items-center gap-1.5 font-heading text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  <Database className="h-3 w-3" aria-hidden="true" /> Bases de conocimiento
                </h3>
                <ul className="space-y-1">
                  {LOCAL_KNOWLEDGE_BASES.map((base) => (
                    <li key={base.id} className="flex items-center justify-between gap-2 font-mono text-[9px]">
                      <span className="min-w-0 truncate text-muted-foreground" title={base.source}>{base.label}</span>
                      <span className="text-secondary">{base.count}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 border-t border-border/40 pt-1.5 font-mono text-[8px] uppercase text-muted-foreground/50">
                  Documentado · sin indexar
                </p>
                <ul className="mt-1 space-y-1">
                  {DOCUMENTED_DOMAINS.map((domain) => (
                    <li key={domain.id} className="flex items-center justify-between gap-2 font-mono text-[9px]">
                      <span className="min-w-0 truncate text-muted-foreground/70" title={domain.detail}>{domain.label}</span>
                      <span className="text-muted-foreground/40">0</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="mb-2 flex items-center gap-1.5 font-heading text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  <RouteIcon className="h-3 w-3" aria-hidden="true" /> Rutas del supervisor
                </h3>
                <ul className="space-y-1">
                  {WORKFLOW_ROUTES.map((route) => (
                    <li key={route.id} className="flex items-baseline justify-between gap-2 font-mono text-[9px]">
                      <span className="truncate text-foreground/75">{route.agent}</span>
                      <span className="shrink-0 text-muted-foreground/50">{route.detail}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <Button
                variant="outline"
                size="sm"
                onClick={() => onWorkspaceChange("neural")}
                className="h-8 w-full border-secondary/25 bg-secondary/5 font-mono text-[10px] uppercase tracking-wider text-secondary/85 hover:bg-secondary/15"
              >
                <Layers3 className="h-3.5 w-3.5" /> Abrir núcleo neural
              </Button>
            </div>
          )}

          {activeTab === "agent" && (
            <div className="flex flex-1 flex-col">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-primary/25 bg-primary/10">
                  <Cpu className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-heading tracking-wider text-primary">{CORE_META.name}</h2>
                  <p className="font-mono text-[9px] text-muted-foreground/50">
                    v{CORE_META.version} · {CORE_META.protocol}
                  </p>
                </div>
              </div>

              {/* Real identity, not a decorative widget */}
              <section className="mb-4">
                <h3 className="mb-2 flex items-center gap-1.5 font-heading text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  <UserRound className="h-3 w-3" aria-hidden="true" /> Identidad
                </h3>
                <div className="space-y-1.5 border border-border/40 bg-card/30 p-2.5 font-mono text-[9px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Cuenta</span>
                    <span className="max-w-[60%] truncate text-foreground/85" title={user?.email ?? undefined}>
                      {user ? (user.email ?? user.id.slice(0, 8)) : "sin sesión"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Nivel</span>
                    <span className="text-secondary">{TIER_LABEL[tier] ?? tier}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Wallet</span>
                    <span className={isConnected ? "text-primary" : "text-muted-foreground/60"}>
                      {isConnected && address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "sin conectar"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Red</span>
                    <span className="text-foreground/70">{isConnected ? `chain ${chainId ?? "—"}` : "—"}</span>
                  </div>
                </div>
                <div className="mt-1.5 flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/auth")}
                    className="h-7 flex-1 font-mono text-[9px] uppercase tracking-wider"
                  >
                    <ShieldCheck className="mr-1 h-3 w-3" />
                    {user ? "Cuenta" : "Entrar"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => open()}
                    className="h-7 flex-1 font-mono text-[9px] uppercase tracking-wider"
                  >
                    <Wallet className="mr-1 h-3 w-3" />
                    {isConnected ? "Wallet" : "Conectar"}
                  </Button>
                </div>
              </section>

              {/* Utilities: each one runs a real task in the chat */}
              <section className="mb-4">
                <h3 className="mb-2 flex items-center gap-1.5 font-heading text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  <Zap className="h-3 w-3" aria-hidden="true" /> Utilidades
                </h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {UTILITIES.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => onPrompt(entry.prompt)}
                      className="group flex items-center justify-between gap-2 border border-border/40 bg-card/30 px-2 py-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground transition-colors hover:border-secondary/40 hover:text-secondary"
                    >
                      {entry.label}
                      <ArrowRight className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 font-mono text-[8px] leading-relaxed text-muted-foreground/45">
                  Abren una tarea real en el chat con el oráculo activo; no publican ni ejecutan nada fuera de Ai Tor.
                </p>
              </section>

              {/* External registration, explained instead of dressed up as metrics */}
              <section className="mb-4">
                <h3 className="mb-2 flex items-center gap-1.5 font-heading text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  <Network className="h-3 w-3" aria-hidden="true" /> Registro externo
                </h3>
                <div className="border border-border/40 bg-card/30 p-2.5">
                  <p className="font-mono text-[9px] leading-4 text-muted-foreground/60">
                    Moltbook registra a Ai Tor como agente público y devuelve un enlace de verificación en X.
                    No cambia tu sesión, tu nivel ni tus créditos.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMoltbookSync}
                    disabled={isRegistering}
                    className="mt-2 h-7 w-full border-secondary/20 bg-secondary/5 font-mono text-[9px] uppercase tracking-wider text-secondary/80 hover:bg-secondary/15"
                  >
                    {isRegistering ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Share2 className="mr-1 h-3 w-3" />
                    )}
                    {isRegistering ? "Registrando…" : "Registrar agente"}
                  </Button>
                  <a
                    href={MOLTBOOK_AGENT.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 flex items-center justify-center gap-1 font-mono text-[8px] uppercase tracking-wider text-muted-foreground/45 transition-colors hover:text-primary"
                  >
                    Qué es Moltbook <ExternalLink className="h-2 w-2" />
                  </a>
                </div>
              </section>

              <div className="space-y-1.5 border border-border/40 bg-card/30 p-2.5 font-mono text-[9px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Protocolo</span>
                  <span className="text-foreground/85">{CORE_META.protocol}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Frecuencia</span>
                  <span className="text-secondary">{CORE_META.frequency}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Mensajes</span>
                  <span className="text-foreground/85">
                    {sessionStats.queries + sessionStats.replies}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 border-t border-secondary/10 pt-4 pb-2 text-center">
            {user && (
              <Button
                variant="ghost"
                onClick={() => signOut()}
                className="mb-2 h-7 w-full font-mono text-[9px] uppercase tracking-wider text-muted-foreground/40 hover:text-destructive"
              >
                <LogOut className="mr-1 h-3 w-3" /> Cerrar sesión
              </Button>
            )}
            <p className="font-mono text-[8px] tracking-wider text-muted-foreground/30">{MOLTBOOK_AGENT.collective}</p>
          </div>
        </div>
      </aside>
    </>
  );
}
