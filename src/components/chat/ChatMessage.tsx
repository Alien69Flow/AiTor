import { cn } from "@/lib/utils";
import type { Message } from "@/hooks/useChat";
import { User, Copy, Check } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import alienflowLogo from "@/assets/alienflow-logo.png";

interface ChatMessageProps {
  message: Message;
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn(
      "group w-full py-5 px-4 md:px-6 transition-colors",
      isUser ? "bg-transparent" : "bg-card/30"
    )}>
      <div className="max-w-3xl mx-auto flex gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0 mt-1">
          {isUser ? (
            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-lg border border-secondary/30 overflow-hidden bg-card/60 flex items-center justify-center">
              <img src={alienflowLogo} alt="AI Tor" className="w-6 h-6 object-contain" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono font-bold tracking-wide text-foreground/80">
              {isUser ? "Tú" : "AI Tor"}
            </span>
            <span className="text-[9px] font-mono text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity">
              {formatTime(message.timestamp)}
            </span>
          </div>

          {message.imageData && (
            <div className="mb-3 overflow-hidden rounded-lg border border-border max-w-xs">
              <img src={message.imageData} alt="Uploaded" className="max-h-[200px] w-auto object-contain" />
            </div>
          )}

          <div className={cn(
            "text-sm leading-7 font-mono",
            isUser ? "text-foreground/90 whitespace-pre-wrap" : "text-muted-foreground prose-terminal"
          )}>
            {isUser ? (
              message.content
            ) : (
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                  code: ({ className, children, ...props }) => {
                    const isInline = !className;
                    const lang = className?.replace("language-", "") || "";
                    return isInline ? (
                      <code className="px-1.5 py-0.5 rounded bg-muted/50 border border-border text-secondary text-xs font-mono" {...props}>{children}</code>
                    ) : (
                      <div className="relative mb-3 group/code">
                        {lang && (
                          <div className="absolute top-0 left-0 px-2.5 py-1 text-[9px] font-mono text-muted-foreground/50 bg-muted/30 rounded-tl-lg rounded-br-lg border-b border-r border-border/50">
                            {lang}
                          </div>
                        )}
                        <code className={cn("block p-3 pt-7 rounded-lg bg-background border border-border text-xs font-mono overflow-x-auto", className)} {...props}>{children}</code>
                      </div>
                    );
                  },
                  pre: ({ children }) => <pre className="mb-3 last:mb-0">{children}</pre>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1.5">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1.5">{children}</ol>,
                  h1: ({ children }) => <h1 className="text-lg font-bold text-foreground mb-2 mt-4 first:mt-0">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-base font-bold text-foreground mb-2 mt-3 first:mt-0">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-bold text-foreground mb-1.5 mt-2.5 first:mt-0">{children}</h3>,
                  strong: ({ children }) => <strong className="text-foreground font-bold">{children}</strong>,
                  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-secondary underline hover:text-primary transition-colors">{children}</a>,
                  blockquote: ({ children }) => <blockquote className="border-l-2 border-secondary/50 pl-3 italic text-muted-foreground/70 mb-3">{children}</blockquote>,
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}
          </div>

          {!isUser && message.content && (
            <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/50 hover:text-foreground/70 transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-secondary" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
