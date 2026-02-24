import { useState, useRef, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { AI_MODELS } from "@/lib/ai-models";
import { ChatHeader } from "./ChatHeader";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { EmptyState } from "./EmptyState";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { AgentSidebar } from "./AgentSidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SpaceBackground } from "@/components/SpaceBackground";
import { 
  Maximize2, Minimize2, ShieldAlert, 
  Code2, Globe, Zap, Link2, Terminal, Info, Eye, ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function ChatContainer() {
  // Mantenemos la 2.5 flash por compatibilidad con Lovable
  const [selectedModel, setSelectedModel] = useState("google/gemini-2.5-flash");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { messages, isLoading, sendMessage, clearChat } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentModel = AI_MODELS.find(m => m.id === selectedModel);
  const supportsVision = currentModel?.supportsVision ?? false;

  const handleSend = (content: string, imageData?: string) => {
    sendMessage(content, selectedModel, imageData);
  };

  // HERRAMIENTAS ACTIVAS: Inyectan lógica directa al flujo
  const handleToolClick = (toolLabel: string) => {
    const promptMap: Record<string, string> = {
      "Analizador": "Analiza el siguiente código buscando vulnerabilidades y optimizaciones: ",
      "Buscador": "Activa búsqueda web en tiempo real para investigar sobre: ",
      "Generador": "Genera una propuesta creativa o imagen técnica basada en: ",
      "Web3/DAO": "Escanea la red blockchain y verifica el contrato/propuesta: "
    };
    // Enviamos el mensaje inicial para que el usuario complete la orden
    sendMessage(promptMap[toolLabel] || `Modo ${toolLabel} activado.`, selectedModel);
  };

  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
      }
    }
  }, [messages, isLoading]);

  const containerClasses = isFullscreen
    ? "fixed inset-2 sm:inset-4 flex z-50"
    : "relative flex w-full max-w-6xl h-[88vh] shadow-[0_0_60px_-15px_rgba(var(--primary-rgb),0.3)]";

  return (
    <>
      <SpaceBackground />
      <div className="fixed inset-0 flex items-center justify-center p-2 sm:p-6 pointer-events-none z-10">
        <div className={`pointer-events-auto ${containerClasses} glass-dark rounded-xl border border-secondary/30 overflow-hidden terminal-glow scanlines transition-all duration-500`}>
          
          {/* HUD CORNERS - DISEÑO AVANZADO */}
          <div className="absolute top-0 left-0 w-10 h-10 border-l-2 border-t-2 border-primary/40 rounded-tl-xl z-20 pointer-events-none" />
          <div className="absolute top-0 right-0 w-10 h-10 border-r-2 border-t-2 border-primary/40 rounded-tr-xl z-20 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-10 h-10 border-l-2 border-b-2 border-secondary/40 rounded-bl-xl z-20 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-10 h-10 border-r-2 border-b-2 border-secondary/40 rounded-br-xl z-20 pointer-events-none" />
          
          <AgentSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

          <div className="flex-1 flex flex-col min-w-0 relative bg-black/5">
            {/* BRANDING: SYS_OS // v69 + STATUS BADGE */}
            <div className="absolute top-2.5 left-4 flex items-center gap-3 text-primary/40 font-heading text-[9px] z-20 select-none hidden sm:flex tracking-[0.2em]">
              <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded border border-primary/10">
                <Terminal className="w-3 h-3 text-primary/60" />
                <span>SYS_OS // v69</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1 rounded bg-green-500/5 border border-green-500/20">
                <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse shadow-[0_0_5px_#22c55e]" />
                <span className="text-green-500/60 font-mono text-[8px]">CORE_STABLE</span>
              </div>
            </div>
            
            <Button
              variant="ghost" size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="absolute top-2.5 right-12 h-6 w-6 text-muted-foreground/40 hover:text-primary transition-colors z-30"
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
            
            <ChatHeader
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              onClear={clearChat}
              hasMessages={messages.length > 0}
            />
            
            <ScrollArea className="flex-1 min-h-0 relative z-0" ref={scrollRef}>
              <div className="max-w-3xl mx-auto w-full">
                {messages.length === 0 ? <EmptyState /> : (
                  <div className="flex flex-col py-6 px-4 gap-1">
                    {messages.map((message) => <ChatMessage key={message.id} message={message} />)}
                  </div>
                )}
                {isLoading && <div className="px-6 py-4"><ThinkingIndicator /></div>}
              </div>
            </ScrollArea>
            
            {/* PANEL DE CONTROL INFERIOR */}
            <div className="bg-card/40 backdrop-blur-3xl border-t border-secondary/20 relative z-10 flex flex-col">
              
              {/* TOOLBELT INTERACTIVO */}
              <div className="flex items-center gap-2 px-4 pt-3 pb-1 overflow-x-auto no-scrollbar">
                {[
                  { label: "Analizador", icon: Code2, color: "text-blue-400" },
                  { label: "Buscador", icon: Globe, color: "text-emerald-400" },
                  { label: "Generador", icon: Zap, color: "text-amber-400" },
                  { label: "Web3/DAO", icon: Link2, color: "text-purple-400" }
                ].map((tool, i) => (
                  <Button 
                    key={i}
                    variant="outline" size="sm" 
                    onClick={() => handleToolClick(tool.label)}
                    className="h-7 px-3 text-[9px] font-mono border-secondary/20 bg-black/40 hover:bg-primary/10 hover:border-primary/40 transition-all gap-2 uppercase tracking-widest group shrink-0"
                  >
                    <tool.icon className={`w-3 h-3 ${tool.color} group-hover:scale-125 transition-transform`} />
                    <span className="opacity-60 group-hover:opacity-100">{tool.label}</span>
                  </Button>
                ))}
              </div>

              <ChatInput onSend={handleSend} isLoading={isLoading} supportsVision={supportsVision} />

              {/* DISCLAIMER REFINADO & PRIVACIDAD */}
              <div className="px-4 py-2.5 border-t border-secondary/10 bg-black/60">
                <div className="flex flex-col gap-2 max-w-4xl mx-auto">
                  <div className="flex flex-wrap items-center justify-between gap-4 text-[8px] font-mono tracking-[0.1em] uppercase text-muted-foreground/40">
                    <div className="flex items-center gap-2">
                      <Info className="w-3 h-3 text-primary/40" />
                      <p>
                        <span className="text-primary/60 font-bold">Aviso:</span> Ai Tor puede generar alucinaciones cuánticas. Verifica los datos críticos.
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer group">
                        <ShieldCheck className="w-3 h-3 group-hover:text-primary" />
                        <span>Tu Privacidad</span>
                      </div>
                      <div className="h-2 w-[1px] bg-secondary/20" />
                      <span className="text-[7px] opacity-50">Build: 2026.02.24-Stable</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
