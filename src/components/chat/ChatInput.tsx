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
    <form onSubmit={handleSubmit} className="px-4 py-3">
      {imageData && (
        <div className="relative mb-3 inline-block">
          <img 
            src={imageData} 
            alt="Preview" 
            className="h-20 rounded-xl border border-secondary/30 object-contain bg-card/40"
          />
          <button
            type="button"
            onClick={() => setImageData(null)}
            className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground hover:bg-destructive/90 transition-colors"
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
            className="shrink-0 h-10 w-10 rounded-xl text-muted-foreground/60 hover:text-secondary hover:bg-secondary/10 transition-colors"
          >
            <ImagePlus className="h-5 w-5" />
          </Button>
        )}
        
        <div className="flex-1 bg-card/50 border border-secondary/20 rounded-2xl px-4 py-2 focus-within:border-secondary/40 focus-within:bg-card/70 transition-all">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pregunta al oráculo..."
            disabled={isLoading}
            className="min-h-[36px] max-h-[120px] resize-none bg-transparent border-none p-0 focus-visible:ring-0 text-sm placeholder:text-muted-foreground/40"
            rows={1}
          />
        </div>
        
        <Button 
          type="submit" 
          disabled={isLoading || (!input.trim() && !imageData)}
          size="icon"
          className="shrink-0 h-10 w-10 rounded-xl bg-secondary/20 border border-secondary/30 text-secondary hover:bg-secondary/30 hover:border-secondary/50 transition-all disabled:opacity-30"
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
