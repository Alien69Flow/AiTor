import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, ImagePlus, X, Loader2, ArrowUp, Globe, Code2, FileSearch, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ChatInputProps {
  onSend: (content: string, imageData?: string) => void;
  isLoading: boolean;
  supportsVision: boolean;
}

const TOOLS = [
  { icon: Globe, label: "Buscar Web", prompt: "Busca en la web: " },
  { icon: Code2, label: "Analizar Código", prompt: "Analiza este código buscando vulnerabilidades: " },
  { icon: FileSearch, label: "Auditar Contrato", prompt: "Audita este smart contract: " },
  { icon: Sparkles, label: "Generar Contenido", prompt: "Genera un thread viral para X/Twitter sobre: " },
];

export function ChatInput({ onSend, isLoading, supportsVision }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !imageData) return;
    onSend(input, imageData || undefined);
    setInput("");
    setImageData(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setImageData(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleToolClick = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto px-4 pb-4 pt-2">
      {imageData && (
        <div className="relative mb-2 inline-block">
          <img src={imageData} alt="Preview" className="h-16 rounded-lg border border-border object-contain bg-card/40" />
          <button
            type="button"
            onClick={() => setImageData(null)}
            className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-card/60 backdrop-blur-sm px-3 py-2 focus-within:border-secondary/50 focus-within:ring-1 focus-within:ring-secondary/20 transition-all">
        {/* Tool buttons row */}
        <TooltipProvider delayDuration={200}>
          <div className="flex items-center gap-0.5 shrink-0">
            {supportsVision && (
              <>
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                      className="shrink-0 p-1.5 rounded-lg text-muted-foreground/50 hover:text-secondary hover:bg-muted/30 transition-colors disabled:opacity-30"
                    >
                      <ImagePlus className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs font-mono">Subir imagen</TooltipContent>
                </Tooltip>
              </>
            )}
            {TOOLS.map((tool, i) => (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => handleToolClick(tool.prompt)}
                    disabled={isLoading}
                    className="shrink-0 p-1.5 rounded-lg text-muted-foreground/50 hover:text-secondary hover:bg-muted/30 transition-colors disabled:opacity-30"
                  >
                    <tool.icon className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs font-mono">{tool.label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>

        {/* Divider */}
        <div className="w-px h-5 bg-border/50 shrink-0" />

        {/* Command prefix */}
        <span className="text-xs font-mono text-secondary/60 shrink-0 pb-1.5 select-none hidden sm:block">AITOR &gt;</span>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje..."
          disabled={isLoading}
          rows={1}
          className="flex-1 min-h-[36px] max-h-[200px] resize-none bg-transparent border-none p-0 pb-1 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-0 disabled:opacity-50"
        />

        {/* Send */}
        <button
          type="submit"
          disabled={isLoading || (!input.trim() && !imageData)}
          className="shrink-0 p-1.5 rounded-lg bg-secondary/80 text-secondary-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
        </button>
      </div>

      <p className="text-center text-[9px] font-mono text-muted-foreground/30 mt-2">
        AI Tor puede generar inexactitudes. Verifica datos críticos.
      </p>
    </form>
  );
}
