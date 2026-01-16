import { cn } from "@/lib/utils";
import type { Message } from "@/hooks/useChat";

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
    <div className={cn("flex gap-3 py-3", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[90%] rounded-lg px-3 py-2",
          isUser 
            ? "bg-primary/90 text-primary-foreground" 
            : "bg-card/60 backdrop-blur-sm border border-secondary/20 text-foreground"
        )}
      >
        {message.imageData && (
          <img 
            src={message.imageData} 
            alt="Uploaded" 
            className="mb-2 max-h-40 rounded-md object-contain"
          />
        )}
        <div className={cn(
          "whitespace-pre-wrap text-sm leading-relaxed",
          !isUser && "font-mono"
        )}>
          {!isUser && (
            <span className="text-secondary mr-1.5">&gt;</span>
          )}
          {message.content}
        </div>
        <div className={cn(
          "mt-1.5 text-[10px] font-mono",
          isUser ? "text-primary-foreground/60" : "text-muted-foreground"
        )}>
          [{formatTimestamp(message.timestamp)}]
        </div>
      </div>
    </div>
  );
}
