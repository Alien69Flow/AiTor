import { cn } from "@/lib/utils";
import type { Message } from "@/hooks/useChat";
import { User, Copy, Check, Cpu, AlertTriangle } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { ReasoningBlock } from "./ReasoningBlock";

interface ChatMessageProps {
  message: Message;
  /**
   * Este mensaje se está escribiendo ahora mismo. Con esto el panel de
   * razonamiento sabe si el modelo sigue pensando (abierto, en vivo) o si ya
   * empezó a contestar (se pliega solo).
   */
  streaming?: boolean;
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

export function ChatMessage({ message, streaming = false }: ChatMessageProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  // El razonamiento está en curso mientras no haya ni una letra de respuesta:
  // en cuanto llega el primer delta, el panel se cierra y queda el resumen.
  const thinking = streaming && !message.content.trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn(
      "group w-full py-3.5 px-3 sm:py-5 sm:px-6 transition-colors",
      isUser ? "bg-transparent" : "bg-card/30"
    )}>
      <div className="max-w-3xl mx-auto flex gap-2.5 sm:gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0 mt-1">
          {isUser ? (
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
              <User className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />
            </div>
          ) : (
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg border border-secondary/30 overflow-hidden bg-card/60 flex items-center justify-center">
              <Cpu className="h-3.5 w-3.5 text-secondary sm:h-4 sm:w-4" aria-label="AI Tor" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono font-bold tracking-wide text-foreground/80">
              {isUser ? "Tú" : "AI Tor"}
            </span>
            <span className="text-[9px] font-mono text-muted-foreground/40 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              {formatTime(message.timestamp)}
            </span>
          </div>

          {/* What this turn consulted. A failed source stays visible in amber:
              a silent gap is how a broken integration looks like a thoughtful
              answer. */}
          {isUser && message.skills && message.skills.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5" aria-label="Fuentes consultadas">
              {message.skills.map((skill) => (
                <span
                  key={skill.label}
                  title={skill.ok ? "Datos consultados en este turno" : `Sin datos: ${skill.error ?? "fuente no disponible"}`}
                  className={cn(
                    "flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider",
                    skill.ok
                      ? "border-secondary/40 bg-secondary/10 text-secondary"
                      : "border-accent/50 bg-accent/10 text-accent",
                  )}
                >
                  {skill.ok ? <Check className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
                  {skill.label}
                </span>
              ))}
            </div>
          )}

          {!isUser && message.reasoning && (
            <ReasoningBlock text={message.reasoning} active={thinking} />
          )}

          {message.imageData && (
            <div className="mb-3 overflow-hidden rounded-lg border border-border max-w-xs">
              <img src={message.imageData} alt="Uploaded" className="max-h-[200px] w-auto object-contain" />
            </div>
          )}

          <div className={cn(
            "text-[13.5px] leading-6 sm:text-sm sm:leading-7 font-mono",
            isUser ? "whitespace-pre-wrap break-words rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-foreground/90" : "text-muted-foreground prose-terminal"
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

          {message.images && message.images.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {message.images.map((image, index) => (
                <a
                  key={`${index}-${image.url.slice(-16)}`}
                  href={image.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={image.alt}
                  className="block overflow-hidden rounded-lg border border-border/60 bg-muted/20 transition-colors hover:border-secondary/50"
                >
                  {/* `object-contain`: recortar con `cover` escondía media imagen
                      en las verticales (Gemini devuelve 9:16). */}
                  <img
                    src={image.url}
                    alt={image.alt}
                    loading="lazy"
                    className="mx-auto max-h-[320px] w-full object-contain"
                  />
                </a>
              ))}
            </div>
          )}

          {message.audios && message.audios.length > 0 && (
            <div className="mt-3 space-y-2">
              {message.audios.map((audio, index) => (
                <div
                  key={`${index}-${audio.url.slice(-16)}`}
                  className="rounded-lg border border-border/60 bg-muted/20 p-2"
                >
                  {/* Reproductor nativo: el audio llega como data URL, así que no
                      hay descarga externa ni enlace que pueda caducar. */}
                  <audio src={audio.url} controls preload="metadata" className="w-full">
                    <track kind="captions" label={audio.alt} />
                  </audio>
                  <p className="mt-1 truncate text-[10px] font-mono text-muted-foreground/60">
                    {audio.alt}
                  </p>
                </div>
              ))}
            </div>
          )}

          {message.videos && message.videos.length > 0 && (
            <div className="mt-3 space-y-2">
              {message.videos.map((video, index) => (
                <div
                  key={`${index}-${video.url.slice(-16)}`}
                  className="overflow-hidden rounded-lg border border-border/60 bg-muted/20"
                >
                  {/* Clip de Veo como data URL: se reproduce aquí mismo, sin
                      enlace temporal que caduque ni host externo. */}
                  <video
                    src={video.url}
                    controls
                    playsInline
                    preload="metadata"
                    className="mx-auto max-h-[420px] w-full bg-black"
                  >
                    <track kind="captions" label={video.alt} />
                  </video>
                  <p className="truncate px-2 py-1 text-[10px] font-mono text-muted-foreground/60">
                    {video.alt}
                  </p>
                </div>
              ))}
            </div>
          )}

          {!isUser && message.content && (
            <div className="mt-2 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
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
