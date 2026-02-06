import { cn } from "@/lib/utils";
import type { Message } from "@/hooks/useChat";
import ReactMarkdown from "react-markdown";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const formatTimestamp = (date: Date) =>
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("py-3 px-2 flex group", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[80%] flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
        {/* Header */}
        <div className="flex items-center gap-2 px-1">
          <span className={cn("text-[10px] font-heading tracking-wider uppercase", isUser ? "text-primary/70" : "text-secondary")}>
            {isUser ? "USER" : "AI TOR"}
          </span>
          <span className="text-muted-foreground/40 text-[9px] font-mono">
            {formatTimestamp(message.timestamp)}
          </span>
          {!isUser && (
            <button
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/40 hover:text-primary"
            >
              {copied ? <Check className="h-3 w-3 text-secondary" /> : <Copy className="h-3 w-3" />}
            </button>
          )}
        </div>

        {/* Image */}
        {message.imageData && (
          <div className="mb-1">
            <img
              src={message.imageData}
              alt="Uploaded"
              className="max-h-48 rounded-lg border border-border/30 object-contain"
            />
          </div>
        )}

        {/* Content */}
        <div
          className={cn(
            "rounded-2xl px-4 py-3 shadow-sm",
            isUser
              ? "bg-primary/10 border border-primary/20 text-foreground rounded-tr-sm"
              : "bg-card/60 border border-border/10 text-foreground rounded-tl-sm"
          )}
        >
          {isUser ? (
            <span className="whitespace-pre-wrap break-words leading-relaxed text-sm">
              {message.content}
            </span>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none break-words leading-relaxed
              prose-headings:text-primary prose-headings:font-heading prose-headings:tracking-wide
              prose-strong:text-secondary prose-code:text-primary prose-code:bg-background/60 prose-code:px-1 prose-code:rounded
              prose-pre:bg-background/80 prose-pre:border prose-pre:border-border/20 prose-pre:rounded-lg
              prose-a:text-secondary prose-a:no-underline hover:prose-a:underline
              prose-li:marker:text-secondary/60
              prose-p:my-1.5 prose-ul:my-1 prose-ol:my-1
            ">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
