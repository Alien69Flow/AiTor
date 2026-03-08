import { useState, useRef, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { AI_MODELS } from "@/lib/ai-models";
import { ChatHeader } from "./ChatHeader";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { EmptyState } from "./EmptyState";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { ControlRoom } from "./ControlRoom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GitBranch, Globe, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function ChatContainer() {
  const [selectedModel, setSelectedModel] = useState("google/gemini-2.5-flash");
  const [controlRoomOpen, setControlRoomOpen] = useState(false);
  const { messages, isLoading, sendMessage, clearChat } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentModel = AI_MODELS.find(m => m.id === selectedModel);
  const supportsVision = currentModel?.supportsVision ?? false;

  const handleSend = (content: string, imageData?: string) => {
    sendMessage(content, selectedModel, imageData);
  };

  const quickActions = [
    { label: "Sync GitHub", icon: GitBranch, prompt: "Muestra el estado de mis repositorios de GitHub y los últimos commits" },
    { label: "Auto-Post RRSS", icon: Globe, prompt: "Genera un thread viral para X/Twitter sobre las últimas tendencias en crypto" },
    { label: "Analyze Contracts", icon: FileSearch, prompt: "Analiza el siguiente smart contract buscando vulnerabilidades de seguridad: " },
  ];

  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
      }
    }
  }, [messages, isLoading]);

  return (
    <div className="relative flex w-full h-full overflow-hidden bg-background">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        <ChatHeader
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          onClear={clearChat}
          hasMessages={messages.length > 0}
          controlRoomOpen={controlRoomOpen}
          onToggleControlRoom={() => setControlRoomOpen(!controlRoomOpen)}
        />

        {/* Messages */}
        <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
          {messages.length === 0 ? (
            <EmptyState onPromptClick={(prompt) => handleSend(prompt)} />
          ) : (
            <div className="flex flex-col">
              {messages.map((message) => <ChatMessage key={message.id} message={message} />)}
              {isLoading && <ThinkingIndicator />}
            </div>
          )}
        </ScrollArea>

        {/* Quick actions + Input */}
        <div className="border-t border-border bg-background/80 backdrop-blur-sm">
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center gap-1.5 px-4 pt-2 max-w-3xl mx-auto w-full overflow-x-auto no-scrollbar">
              {quickActions.map((action, i) => (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSend(action.prompt)}
                      className="h-7 px-2.5 text-[10px] font-mono tracking-wider border-border bg-card/30 hover:bg-card/60 hover:border-secondary/40 transition-all gap-1.5 uppercase shrink-0"
                    >
                      <action.icon className="w-3 h-3 text-muted-foreground/60" />
                      <span className="text-muted-foreground/60">{action.label}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs font-mono">{action.prompt}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>

          <ChatInput onSend={handleSend} isLoading={isLoading} supportsVision={supportsVision} />
        </div>
      </div>

      {/* Control Room sidebar */}
      <ControlRoom isOpen={controlRoomOpen} />
    </div>
  );
}
