import { cn } from "@/lib/utils";
import type { Message } from "@/hooks/useChat";
import { User, Bot, Clock } from "lucide-react";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  return (
    <div className={cn(
      "flex gap-3 w-full",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      {/* Avatar */}
      <div className={cn(
        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border",
        isUser 
          ? "bg-primary/10 border-primary/30" 
          : "bg-secondary/10 border-secondary/30"
      )}>
        {isUser ? (
          <User className="w-4 h-4 text-primary" />
        ) : (
          <span className="text-base">👽</span>
        )}
      </div>

      {/* Bubble */}
      <div className={cn(
        "flex flex-col max-w-[80%] min-w-0",
        isUser ? "items-end" : "items-start"
      )}>
        {/* Name + Time */}
        <div className={cn(
          "flex items-center gap-2 mb-1 px-1",
          isUser ? "flex-row-reverse" : "flex-row"
        )}>
          <span className="text-[10px] font-heading tracking-wider uppercase text-muted-foreground/60">
            {isUser ? "Tú" : "AI Tor"}
          </span>
          <span className="text-[9px] font-mono text-muted-foreground/40 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {formatTimestamp(message.timestamp)}
          </span>
        </div>

        {/* Image */}
        {message.imageData && (
          <div className="mb-2 overflow-hidden rounded-xl border border-secondary/20 bg-card/40 p-1">
            <img 
              src={message.imageData} 
              alt="Uploaded context" 
              className="max-h-[250px] w-auto rounded-lg object-contain"
            />
          </div>
        )}

        {/* Content bubble */}
        <div className={cn(
          "px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words",
          isUser 
            ? "bg-primary/10 border border-primary/20 text-foreground/90 rounded-tr-md" 
            : "bg-card/60 border border-secondary/15 text-muted-foreground/90 rounded-tl-md backdrop-blur-sm"
        )}>
          {message.content}
        </div>
      </div>
    </div>
  );
}
