import { cn } from "@/lib/utils";
import type { Message } from "@/hooks/useChat";
import { User, Bot, Clock, Terminal } from "lucide-react";
import ReactMarkdown from 'react-markdown'; // Asumiendo que usas react-markdown

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: false 
    });
  };

  return (
    <div className={cn(
      "group relative py-6 px-4 transition-all duration-300",
      isUser 
        ? "bg-transparent" 
        : "bg-secondary/5 backdrop-blur-sm border-y border-secondary/10"
    )}>
      {/* Indicador lateral neón */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1 transition-all duration-500",
        isUser ? "bg-primary/20 group-hover:bg-primary/60" : "bg-secondary/20 group-hover:bg-secondary/60"
      )} />

      <div className="max-w-3xl mx-auto">
        {/* Header: Avatar, Rol y Meta */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-1.5 rounded-md border",
              isUser 
                ? "bg-primary/10 border-primary/30 text-primary" 
                : "bg-secondary/10 border-secondary/30 text-secondary"
            )}>
              {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>
            <div className="flex flex-col">
              <span className={cn(
                "text-[10px] font-heading tracking-[0.15em] uppercase",
                isUser ? "text-primary/80" : "text-secondary/80"
              )}>
                {isUser ? "Authorized_User" : "AI_Tor_Oracle"}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <Clock className="w-2.5 h-2.5 text-muted-foreground/40" />
                <span className="text-[9px] font-mono text-muted-foreground/40">
                  {formatTimestamp(message.timestamp)}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Terminal className="w-3 h-3 text-muted-foreground/30" />
            <span className="text-[8px] font-mono text-muted-foreground/30">
              ID: {message.id.slice(0, 8)}
            </span>
          </div>
        </div>

        {/* Contenido de Imagen */}
        {message.imageData && (
          <div className="relative mb-4 mt-2 overflow-hidden rounded-lg border border-secondary/20 bg-black/40 p-1 group/img">
            <img 
              src={message.imageData} 
              alt="Uploaded context" 
              className="max-h-[300px] w-auto rounded-md object-contain transition-transform duration-500 group-hover/img:scale-[1.02]"
            />
            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[8px] text-primary font-mono border border-primary/20">
              IMG_ANALYSIS_MOD_v69
            </div>
          </div>
        )}

        {/* Cuerpo del Mensaje */}
        <div className={cn(
          "font-sans text-sm leading-relaxed prose prose-invert max-w-none",
          isUser ? "text-foreground/90 pl-1" : "text-muted-foreground pl-1"
        )}>
          {/* Si usas Markdown, se vería así (mucho más pro para código) */}
          {/* @ts-ignore */}
          <ReactMarkdown
            components={{
              code: ({ node, ...props }) => (
                <code className="bg-black/40 border border-secondary/20 rounded px-1.5 py-0.5 font-mono text-primary text-xs" {...props} />
              ),
              pre: ({ node, ...props }) => (
                <pre className="bg-black/60 border border-secondary/30 rounded-lg p-4 font-mono text-xs overflow-x-auto my-4 scanlines" {...props} />
              )
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
