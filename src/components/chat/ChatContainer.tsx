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
import { Maximize2, Minimize2, Code2, Globe, Zap, Link2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function ChatContainer() {
  const [selectedModel, setSelectedModel] = useState("google/gemini-2.5-flash");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { messages, isLoading, sendMessage, clearChat } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentModel = AI_MODELS.find(m => m.id === selectedModel);
  const supportsVision = currentModel?.supportsVision ?? false;

  const handleSend = (content: string, imageData?: string) => {
    sendMessage(content, selectedModel, imageData);
  };

  const tools = [
    { label: "Analizador", icon: Code2, desc: "Analiza código y busca vulnerabilidades", prompt: "Analiza el siguiente código buscando vulnerabilidades y optimizaciones: " },
    { label: "Buscador", icon: Globe, desc: "Búsqueda web en tiempo real", prompt: "Activa búsqueda web en tiempo real para investigar sobre: " },
    { label: "Generador", icon: Zap, desc: "Genera propuestas e imágenes", prompt: "Genera una propuesta creativa o imagen técnica basada en: " },
    { label: "Web3/DAO", icon: Link2, desc: "Escanea blockchain y contratos", prompt: "Escanea la red blockchain y verifica el contrato/propuesta: " },
  ];

  const handleToolClick = (prompt: string) => {
    sendMessage(prompt, selectedModel);
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
    : "relative flex w-full h-full shadow-[0_0_60px_-15px_rgba(var(--primary-rgb),0.3)]";

  return (
    <div className={`${containerClasses} glass-dark rounded-2xl border border-secondary/20 overflow-hidden terminal-glow transition-all duration-500`}>
          
          {/* Subtle HUD corners */}
          <div className="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-primary/25 rounded-tl-2xl z-20 pointer-events-none" />
          <div className="absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 border-primary/25 rounded-tr-2xl z-20 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 border-secondary/25 rounded-bl-2xl z-20 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-secondary/25 rounded-br-2xl z-20 pointer-events-none" />
          
          <AgentSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

          <div className="flex-1 flex flex-col min-w-0 relative">
            <Button
              variant="ghost" size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="absolute top-2.5 right-3 h-7 w-7 text-muted-foreground/40 hover:text-primary transition-colors z-30"
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
                {messages.length === 0 ? (
                  <EmptyState onPromptClick={(prompt) => handleSend(prompt)} />
                ) : (
                  <div className="flex flex-col py-4 px-4 gap-3">
                    {messages.map((message) => <ChatMessage key={message.id} message={message} />)}
                  </div>
                )}
                {isLoading && <div className="px-6 py-4"><ThinkingIndicator /></div>}
              </div>
            </ScrollArea>
            
            {/* Bottom panel */}
            <div className="bg-card/50 backdrop-blur-xl border-t border-secondary/15 relative z-10 flex flex-col">
              
              {/* Toolbelt */}
              <TooltipProvider delayDuration={300}>
                <div className="flex items-center gap-2 px-4 pt-3 pb-1 overflow-x-auto no-scrollbar">
                  {tools.map((tool, i) => (
                    <Tooltip key={i}>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" size="sm" 
                          onClick={() => handleToolClick(tool.prompt)}
                          className="h-8 px-3 text-[10px] font-heading tracking-wider border-secondary/15 bg-card/60 hover:bg-secondary/10 hover:border-secondary/40 transition-all gap-2 uppercase shrink-0 group"
                        >
                          <tool.icon className="w-3.5 h-3.5 text-secondary/70 group-hover:text-secondary transition-colors" />
                          <span className="text-muted-foreground/70 group-hover:text-foreground/90">{tool.label}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        {tool.desc}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>

              <ChatInput onSend={handleSend} isLoading={isLoading} supportsVision={supportsVision} />

              {/* Compact disclaimer */}
              <div className="px-4 py-1.5 border-t border-secondary/10 flex items-center justify-between text-[8px] font-mono text-muted-foreground/35 uppercase tracking-wider">
                <span>
                  <span className="text-primary/50">⚠</span> AI Tor puede generar inexactitudes. Verifica datos críticos.
                </span>
                <div className="flex items-center gap-1 hover:text-primary/50 transition-colors cursor-pointer">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  <span className="hidden sm:inline">Privacidad</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
