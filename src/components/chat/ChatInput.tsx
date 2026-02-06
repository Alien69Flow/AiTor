import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send, ImagePlus, X, Loader2, Globe, Code2, Sparkles,
  Image as ImageIcon
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChatInputProps {
  onSend: (content: string, imageData?: string) => void;
  isLoading: boolean;
  supportsVision: boolean;
  supportsImageGen?: boolean;
  onToolAction?: (tool: string) => void;
}

export function ChatInput({ onSend, isLoading, supportsVision, supportsImageGen, onToolAction }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const tools = [
    { id: "search", icon: Globe, label: "Búsqueda Web", always: true },
    { id: "image", icon: ImageIcon, label: "Generar Imagen", always: true },
    { id: "code", icon: Code2, label: "Análisis de Código", always: true },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {imageData && (
        <div className="relative inline-block">
          <img
            src={imageData}
            alt="Preview"
            className="h-16 rounded border border-border/30 object-contain"
          />
          <button
            type="button"
            onClick={() => setImageData(null)}
            className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground hover:bg-destructive/90"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Tool bar */}
      <div className="flex items-center gap-1 px-1">
        {supportsVision && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="h-7 w-7 text-muted-foreground/60 hover:text-primary hover:bg-primary/10"
              >
                <ImagePlus className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Adjuntar imagen</TooltipContent>
          </Tooltip>
        )}

        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Tooltip key={tool.id}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (tool.id === "image") {
                      setInput(prev => prev ? prev + "\n[Genera una imagen: " : "[Genera una imagen: ");
                    } else if (tool.id === "search") {
                      setInput(prev => prev ? prev + "\n[Busca en la web: " : "[Busca en la web: ");
                    } else if (tool.id === "code") {
                      setInput(prev => prev ? prev + "\n[Analiza el código: " : "[Analiza el código: ");
                    }
                    onToolAction?.(tool.id);
                  }}
                  disabled={isLoading}
                  className="h-7 w-7 text-muted-foreground/60 hover:text-secondary hover:bg-secondary/10"
                >
                  <Icon className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">{tool.label}</TooltipContent>
            </Tooltip>
          );
        })}

        <div className="flex-1" />

        <div className="flex items-center gap-1 text-[8px] text-muted-foreground/40 font-mono">
          <Sparkles className="w-2.5 h-2.5 text-primary/40" />
          <span>TOOLS ACTIVE</span>
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Input area */}
      <div className="flex items-end gap-2">
        <div className="flex-1 flex items-center gap-2 bg-background/40 border border-border/30 rounded-lg px-3 py-1.5 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <span className="text-primary/60 font-mono text-sm font-medium">λ&gt;</span>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Consulta al Oráculo..."
            disabled={isLoading}
            className="min-h-[32px] max-h-[120px] resize-none bg-transparent border-none p-0 focus-visible:ring-0 font-mono text-sm placeholder:text-muted-foreground/40"
            rows={1}
          />
        </div>

        <Button
          type="submit"
          disabled={isLoading || (!input.trim() && !imageData)}
          size="icon"
          className="shrink-0 h-9 w-9 bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 hover:border-primary/50 transition-all"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </form>
  );
}
