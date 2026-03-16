import { useState, useRef, useEffect } from "react";
import {
  Send, ImagePlus, X, Loader2, ArrowUp, Globe, Code2, Sparkles, Link2,
  Paperclip, Brain, Search, Mic, Plus, ChevronDown, FileText, Zap, Github, GitBranch
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ChatInputProps {
  onSend: (content: string, imageData?: string) => void;
  isLoading: boolean;
  supportsVision: boolean;
}

const TOOLS = [
  { icon: Search, label: "Búsqueda Web", prompt: "Busca en la web: ", shortcut: "⌘K" },
  { icon: Code2, label: "Analizar Código", prompt: "Analiza este código buscando vulnerabilidades: ", shortcut: "⌘J" },
  { icon: Github, label: "GitHub Repo", prompt: "Analiza el repositorio de GitHub: ", shortcut: "⌘H" },
  { icon: GitBranch, label: "Editar GitHub", prompt: "Edita el repositorio de GitHub: ", shortcut: "⌘E" },
  { icon: Sparkles, label: "Generar Contenido", prompt: "Genera un thread viral para X/Twitter sobre: ", shortcut: "⌘G" },
  { icon: Link2, label: "Web3 & DeFi", prompt: "Analiza este protocolo DeFi o contrato: ", shortcut: "⌘W" },
  { icon: FileText, label: "Analizar Documento", prompt: "Analiza el siguiente documento: ", shortcut: "⌘D" },
];

export function ChatInput({ onSend, isLoading, supportsVision }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [deepThink, setDeepThink] = useState(false);
  const [focused, setFocused] = useState(false);
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
    const prefix = deepThink ? "[DEEP THINK] " : "";
    onSend(prefix + input, imageData || undefined);
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
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto px-3 sm:px-4 pb-3 pt-2">
      {imageData && (
        <div className="relative mb-2 inline-block">
          <img src={imageData} alt="Preview" className="h-20 rounded-xl border border-border object-contain bg-card/40" />
          <button type="button" onClick={() => setImageData(null)} className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground hover:bg-destructive/90 transition-colors shadow-lg">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className={`relative rounded-2xl border bg-card/70 backdrop-blur-md shadow-lg transition-all duration-500 ${
        focused
          ? "border-primary/50 shadow-[0_0_30px_hsl(var(--primary)/0.12),0_0_60px_hsl(var(--primary)/0.04)]"
          : "border-border hover:border-border/80"
      }`}>
        <div className="flex items-end px-3 pt-3 pb-1">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Pregunta a AI Tor cualquier cosa..."
            disabled={isLoading}
            rows={1}
            className="flex-1 min-h-[32px] max-h-[200px] resize-none bg-transparent border-none p-0 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-0 disabled:opacity-50 leading-relaxed"
          />
        </div>

        <div className="flex items-center justify-between px-2 pb-2 pt-1">
          <div className="flex items-center gap-0.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" disabled={isLoading} className="flex items-center gap-1 h-8 px-2 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted/30 transition-all disabled:opacity-30">
                  <Plus className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 bg-popover/95 backdrop-blur-xl border-border">
                <DropdownMenuLabel className="text-[10px] font-heading tracking-widest text-muted-foreground/60 uppercase">
                  Herramientas AI Tor
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {TOOLS.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <DropdownMenuItem key={tool.label} onClick={() => handleToolClick(tool.prompt)} className="flex items-center gap-3 py-2.5 cursor-pointer focus:bg-muted/30">
                      <div className="w-8 h-8 rounded-lg bg-muted/20 border border-border/50 flex items-center justify-center text-muted-foreground">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col flex-1">
                        <span className="text-xs font-medium text-foreground">{tool.label}</span>
                      </div>
                      <span className="text-[9px] font-mono text-muted-foreground/40">{tool.shortcut}</span>
                    </DropdownMenuItem>
                  );
                })}
                {supportsVision && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="flex items-center gap-3 py-2.5 cursor-pointer focus:bg-muted/30">
                      <div className="w-8 h-8 rounded-lg bg-muted/20 border border-border/50 flex items-center justify-center text-muted-foreground">
                        <ImagePlus className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-medium text-foreground">Subir Imagen</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />

            <div className="hidden sm:flex items-center gap-0.5">
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" onClick={() => handleToolClick("Busca en la web: ")} disabled={isLoading} className="h-8 px-2 rounded-lg flex items-center gap-1.5 text-muted-foreground/50 hover:text-foreground hover:bg-muted/30 transition-all disabled:opacity-30">
                      <Globe className="h-3.5 w-3.5" />
                      <span className="text-[9px] font-mono text-muted-foreground/40">Web</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Búsqueda Web con Firecrawl</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" onClick={() => handleToolClick("Analiza este código: ")} disabled={isLoading} className="h-8 px-2 rounded-lg flex items-center gap-1.5 text-muted-foreground/50 hover:text-foreground hover:bg-muted/30 transition-all disabled:opacity-30">
                      <Code2 className="h-3.5 w-3.5" />
                      <span className="text-[9px] font-mono text-muted-foreground/40">Code</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Analizar Código</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" onClick={() => handleToolClick("Analiza el repositorio de GitHub: ")} disabled={isLoading} className="h-8 px-2 rounded-lg flex items-center gap-1.5 text-muted-foreground/50 hover:text-foreground hover:bg-muted/30 transition-all disabled:opacity-30">
                      <Github className="h-3.5 w-3.5" />
                      <span className="text-[9px] font-mono text-muted-foreground/40">Git</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">GitHub Repos</TooltipContent>
                </Tooltip>

                {supportsVision && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted/30 transition-all disabled:opacity-30">
                        <Paperclip className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">Adjuntar Imagen</TooltipContent>
                  </Tooltip>
                )}
              </TooltipProvider>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setDeepThink(!deepThink)}
                    disabled={isLoading}
                    className={`h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-all disabled:opacity-30 ${
                      deepThink
                        ? "bg-primary/15 text-primary border border-primary/30"
                        : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/30"
                    }`}
                  >
                    <Brain className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline text-[10px] font-heading tracking-wider">DEEP</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {deepThink ? "Modo Deep Think activado" : "Activar Deep Think"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <button
              type="submit"
              disabled={isLoading || (!input.trim() && !imageData)}
              className="h-8 w-8 rounded-xl flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-primary/20"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      <p className="text-center text-[9px] text-muted-foreground/30 mt-2">
        AI Tor puede generar inexactitudes · Verifica datos críticos · ΔlieπFlΦw DAO
      </p>
    </form>
  );
}
