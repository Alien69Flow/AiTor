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
      hour12: false
    });
  };

  return (
    <div className={cn(
      "py-3 px-4 flex",
      isUser ? "justify-end" : "justify-start"
    )}>
      <div className={cn(
        "max-w-[75%] flex flex-col gap-1",
        isUser ? "items-end" : "items-start"
      )}>
        <div className="flex items-center gap-2 px-1">
          <span className={cn(
            "text-xs font-medium",
            isUser ? "text-primary" : "text-secondary"
          )}>
            {isUser ? "Tú" : "AI Tor"}
          </span>
          <span className="text-muted-foreground/60 text-[10px]">
            {formatTimestamp(message.timestamp)}
          </span>
        </div>

        {message.imageData && (
          <div className="mb-1">
            <img
              src={message.imageData}
              alt="Uploaded"
              className="max-h-48 rounded-lg border border-secondary/30"
            />
          </div>
        )}

        <div className={cn(
          "rounded-2xl px-4 py-3 shadow-sm",
          isUser
            ? "bg-white text-gray-900 rounded-tr-sm"
            : "bg-card/60 text-white rounded-tl-sm"
        )}>
          <span className="whitespace-pre-wrap break-words leading-relaxed text-sm">
            {message.content}
          </span>
        </div>
      </div>
    </div>
  );
}
