import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, ImagePlus, X, Loader2 } from "lucide-react";

interface ChatInputProps {
  onSend: (content: string, imageData?: string) => void;
  isLoading: boolean;
  supportsVision: boolean;
}

export function ChatInput({ onSend, isLoading, supportsVision }: ChatInputProps) {
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
    reader.onload = (event) => {
      setImageData(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-secondary/30 bg-card/60 backdrop-blur-sm p-3">
      {imageData && (
        <div className="relative mb-2 inline-block">
          <img 
            src={imageData} 
            alt="Preview" 
            className="h-16 rounded border border-secondary/30 object-contain"
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
      
      <div className="flex items-end gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageUpload}
          accept="image/*"
          className="hidden"
        />
        
        {supportsVision && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="shrink-0 h-8 w-8 text-muted-foreground hover:text-secondary"
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
        )}
        
        <div className="flex-1 flex items-center gap-2 bg-background/40 border border-secondary/30 rounded-md px-3 py-1 focus-within:border-secondary/60 transition-colors">
          <span className="text-secondary font-mono text-sm font-medium">λ&gt;</span>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ingresa comando..."
            disabled={isLoading}
            className="min-h-[32px] max-h-[120px] resize-none bg-transparent border-none p-0 focus-visible:ring-0 font-mono text-sm placeholder:text-muted-foreground/50"
            rows={1}
          />
          <span className="text-secondary animate-pulse font-mono">_</span>
        </div>
        
        <Button 
          type="submit" 
          disabled={isLoading || (!input.trim() && !imageData)}
          size="icon"
          variant="ghost"
          className="shrink-0 h-8 w-8 text-secondary hover:text-primary hover:bg-secondary/10"
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
