import { cn } from "@/lib/utils";
import type { Message } from "@/hooks/useChat";
import { User, Copy, Check } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import aitorLogo from "@/assets/aitor-brain-logo.png";

interface ChatMessageProps {
  message: Message;
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
      "group w-full py-4 px-4 md:px-6 transition-colors",
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
              <img src={aitorLogo} alt="AI Tor" className="w-6 h-6 object-contain" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold tracking-wide text-foreground/80">
              {isUser ? "Tú" : "AI Tor"}
            </span>
          </div>

          {/* Image */}
          {message.imageData && (
            <div className="mb-3 overflow-hidden rounded-lg border border-border max-w-xs">
              <img
                src={message.imageData}
                alt="Uploaded"
                className="max-h-[200px] w-auto object-contain"
              />
            </div>
          )}

          {/* Text content with markdown */}
          <div className={cn(
            "text-sm leading-relaxed font-mono",
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
                    return isInline ? (
                      <code className="px-1.5 py-0.5 rounded bg-muted/50 border border-border text-secondary text-xs font-mono" {...props}>{children}</code>
                    ) : (
                      <code className={cn("block p-3 rounded-lg bg-background border border-border text-xs font-mono overflow-x-auto mb-3", className)} {...props}>{children}</code>
                    );
                  },
                  pre: ({ children }) => <pre className="mb-3 last:mb-0">{children}</pre>,
                  ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
                  h1: ({ children }) => <h1 className="text-lg font-bold text-foreground mb-2 mt-4 first:mt-0">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-base font-bold text-foreground mb-2 mt-3 first:mt-0">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-bold text-foreground mb-1 mt-2 first:mt-0">{children}</h3>,
                  strong: ({ children }) => <strong className="text-foreground font-bold">{children}</strong>,
                  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-secondary underline hover:text-primary transition-colors">{children}</a>,
                  blockquote: ({ children }) => <blockquote className="border-l-2 border-secondary/50 pl-3 italic text-muted-foreground/70 mb-3">{children}</blockquote>,
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}
          </div>

          {/* Actions */}
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
