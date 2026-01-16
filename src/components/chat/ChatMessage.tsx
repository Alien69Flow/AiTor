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
    <div className={cn(
      "py-2 px-3 font-mono text-xs",
      isUser ? "bg-transparent" : "bg-card/30"
    )}>
      {/* Header with role and timestamp */}
      <div className="flex items-center gap-2 mb-1">
        <span className={cn(
          "font-medium tracking-wider",
          isUser ? "text-primary" : "text-secondary"
        )}>
          {isUser ? "[USER]" : "[TOR]"}
        </span>
        <span className="text-muted-foreground/60 text-[9px]">
          {formatTimestamp(message.timestamp)}
        </span>
      </div>

      {/* Image preview for user messages */}
      {message.imageData && (
        <div className="mb-2">
          <img 
            src={message.imageData} 
            alt="Uploaded" 
            className="max-h-32 rounded border border-secondary/30"
          />
        </div>
      )}

      {/* Message content */}
      <div className={cn(
        "pl-3 border-l-2",
        isUser ? "border-primary/40 text-foreground/90" : "border-secondary/40 text-muted-foreground"
      )}>
        <span className={cn(
          "mr-1.5",
          isUser ? "text-primary/60" : "text-secondary/60"
        )}>
          &gt;
        </span>
        <span className="whitespace-pre-wrap break-words leading-relaxed">
          {message.content}
        </span>
      </div>
    </div>
  );
}
