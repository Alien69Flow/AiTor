import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowUpRight, Loader2, Maximize2, Send, Sparkles, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NeuralChatIcon } from "./NeuralChatIcon";
import { useChat } from "@/hooks/useChat";
import { AI_MODELS } from "@/lib/ai-models";
import { readPreferredModel } from "@/lib/chat-prefs";

interface ChatDockProps {
  /** Jump to the full Agents workspace, keeping the same conversation. */
  onOpenAgents: () => void;
}

const QUICK_PROMPTS = [
  "Resume la última sesión",
  "Analiza el mercado DeFi ahora",
  "Genera un hilo para X",
];

/**
 * Floating assistant: a compact, always-available chat over every tab except
 * Agents. It shares the same persisted thread as the Agents workspace, so a
 * conversation started here continues there and vice versa.
 */
export function ChatDock({ onOpenAgents }: ChatDockProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [unread, setUnread] = useState(0);
  const [dismissedPreview, setDismissedPreview] = useState(false);
  const { messages, isLoading, sendMessage, clearChat } = useChat();
  const model = useMemo(() => readPreferredModel(), []);
  const modelName = AI_MODELS.find((entry) => entry.id === model)?.name ?? "AI Tor";
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastCount = useRef(messages.length);

  // Badge only when the dock is closed and the oracle finished answering.
  useEffect(() => {
    const previous = lastCount.current;
    lastCount.current = messages.length;
    if (open || messages.length <= previous) return;
    const last = messages[messages.length - 1];
    if (last?.role === "assistant" && last.content) {
      setUnread((value) => value + 1);
      setDismissedPreview(false);
    }
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    const viewport = scrollRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages, isLoading, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => textareaRef.current?.focus(), 120);
    return () => window.clearTimeout(id);
  }, [open]);

  const submit = useCallback(
    (event?: FormEvent) => {
      event?.preventDefault();
      const content = input.trim();
      if (!content || isLoading) return;
      void sendMessage(content, model);
      setInput("");
      setUnread(0);
    },
    [input, isLoading, model, sendMessage]
  );

  const sendQuick = (prompt: string) => {
    if (isLoading) return;
    void sendMessage(prompt, model);
    setUnread(0);
  };

  const openWith = () => {
    setOpen(true);
    setUnread(0);
  };

  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant" && message.content);

  if (!open) {
    return (
      <div className="pointer-events-none fixed bottom-20 right-3 z-[55] flex flex-col items-end gap-2 md:bottom-6 md:right-6">
        {unread > 0 && lastAssistant && !dismissedPreview && (
          <div className="pointer-events-auto flex w-[min(78vw,268px)] items-start gap-2 border border-secondary/40 bg-card/95 p-2.5 text-left shadow-[0_10px_40px_hsl(var(--background)/0.8)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-200">
            <button type="button" onClick={openWith} className="min-w-0 flex-1 text-left">
              <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-secondary">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                Respuesta de {modelName}
              </p>
              <p className="mt-1 line-clamp-3 font-mono text-[10px] leading-4 text-foreground/80">
                {lastAssistant.content.replace(/\s+/g, " ").slice(0, 160)}
              </p>
              <p className="mt-1.5 font-mono text-[9px] text-primary">Abrir chat →</p>
            </button>
            <button
              type="button"
              onClick={() => setDismissedPreview(true)}
              aria-label="Descartar aviso"
              className="shrink-0 p-0.5 text-muted-foreground/50 transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={openWith}
          aria-label="Abrir el chat de AI Tor"
          aria-expanded={false}
          className="pointer-events-auto group relative flex h-14 w-14 items-center justify-center rounded-full border border-primary/45 bg-card/90 shadow-[0_0_28px_hsl(var(--primary)/0.28)] backdrop-blur-xl transition-transform duration-200 hover:scale-[1.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          {isLoading && (
            <span className="absolute inset-0 animate-spin rounded-full border border-transparent border-t-secondary [animation-duration:3s]" aria-hidden="true" />
          )}
          <NeuralChatIcon className="h-7 w-7 text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.45)]" sparkClassName="text-secondary" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1 font-mono text-[10px] font-bold text-background">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
          <span className="pointer-events-none absolute right-full mr-2 hidden whitespace-nowrap border border-border/60 bg-card/95 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground opacity-0 backdrop-blur-xl transition-opacity duration-200 group-hover:opacity-100 md:block">
            Chat AI Tor
          </span>
        </button>
      </div>
    );
  }

  return (
    <section
      aria-label="Chat rápido de AI Tor"
      className="fixed bottom-20 right-3 left-3 z-[65] flex h-[min(72vh,560px)] flex-col overflow-hidden border border-border/70 bg-card/95 shadow-[0_20px_60px_hsl(var(--background)/0.85)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-200 md:bottom-6 md:left-auto md:right-6 md:w-[384px]"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/70 bg-background/60 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative flex h-7 w-7 items-center justify-center border border-primary/35 bg-primary/10">
            <NeuralChatIcon className="h-4 w-4 text-primary" sparkClassName="text-secondary" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-mono text-[10px] uppercase tracking-wider text-foreground/85">AI Tor · Canal rápido</p>
            <p className="flex items-center gap-1.5 font-mono text-[9px] text-muted-foreground">
              <span className={`h-1.5 w-1.5 rounded-full ${isLoading ? "bg-amber-300" : "bg-secondary"} animate-pulse`} aria-hidden="true" />
              {isLoading ? "Pensando…" : modelName}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground/60 hover:text-destructive"
              aria-label="Limpiar conversación"
              title="Limpiar conversación"
              onClick={() => {
                clearChat();
                setUnread(0);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground/60 hover:text-primary"
            aria-label="Abrir en la pestaña Agents"
            title="Abrir en Agents"
            onClick={() => {
              setOpen(false);
              onOpenAgents();
            }}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground/60 hover:text-foreground"
            aria-label="Cerrar chat"
            title="Cerrar (Esc)"
            onClick={() => setOpen(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <NeuralChatIcon className="h-7 w-7 text-muted-foreground/30" />
            <p className="font-mono text-[10px] text-muted-foreground">
              Pregunta lo que sea sin salir de esta pestaña.
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={isLoading}
                  onClick={() => sendQuick(prompt)}
                  className="border border-border/60 bg-background/40 px-2 py-1 font-mono text-[9px] text-muted-foreground transition-colors hover:border-secondary/50 hover:text-secondary disabled:opacity-40"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap border border-primary/25 bg-primary/10 px-2.5 py-1.5 font-mono text-[11px] leading-5 text-foreground/90">
                    {message.content}
                  </p>
                </div>
              ) : (
                <div key={message.id} className="max-w-[92%] border border-border/60 bg-background/50 px-2.5 py-1.5 font-mono text-[11px] leading-5 text-muted-foreground">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="text-foreground">{children}</strong>,
                      ul: ({ children }) => <ul className="mb-1.5 list-inside list-disc space-y-0.5">{children}</ul>,
                      ol: ({ children }) => <ol className="mb-1.5 list-inside list-decimal space-y-0.5">{children}</ol>,
                      a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-secondary underline">
                          {children}
                        </a>
                      ),
                      code: ({ children }) => (
                        <code className="bg-muted/40 px-1 text-[10px] text-secondary">{children}</code>
                      ),
                      pre: ({ children }) => (
                        <pre className="mb-1.5 overflow-x-auto border border-border/60 bg-background/70 p-2 text-[10px]">{children}</pre>
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              )
            )}
            {isLoading && (
              <p className="flex items-center gap-2 font-mono text-[10px] text-secondary" aria-live="polite">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                AI Tor está razonando…
              </p>
            )}
          </div>
        )}
      </div>

      <form onSubmit={submit} className="shrink-0 border-t border-border/70 bg-background/60 px-3 py-2">
        <div className="flex items-end gap-2 border border-border/60 bg-card/70 px-2 py-1.5 focus-within:border-primary/50">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            rows={1}
            maxLength={6000}
            disabled={isLoading}
            placeholder="Escribe al oráculo…"
            aria-label="Mensaje para AI Tor"
            className="max-h-[120px] min-h-[28px] flex-1 resize-none bg-transparent font-mono text-[11px] leading-5 text-foreground placeholder:text-muted-foreground/40 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            aria-label="Enviar mensaje"
            className="flex h-7 w-7 shrink-0 items-center justify-center bg-primary text-background transition-colors hover:bg-primary/90 disabled:opacity-30"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </div>
        <p className="mt-1.5 flex items-center justify-between font-mono text-[8px] text-muted-foreground/50">
          <span>Enter envía · Shift+Enter salto de línea</span>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenAgents();
            }}
            className="flex items-center gap-1 text-primary/80 transition-colors hover:text-primary"
          >
            Abrir en Agents <ArrowUpRight className="h-2.5 w-2.5" aria-hidden="true" />
          </button>
        </p>
      </form>
    </section>
  );
}
