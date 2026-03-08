import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AI_MODELS } from "@/lib/ai-models";
import { Eye, Zap, Sparkles } from "lucide-react";

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const getIcon = (id: string) => {
  if (id === 'google/gemini-2.5-pro') return "👽";
  if (id.includes('gemini')) return "⚡";
  if (id.includes('gpt')) return "🧠";
  if (id.includes('grok')) return "🚀";
  if (id.includes('claude')) return "🎭";
  if (id.includes('chaingpt')) return "🔗";
  if (id.includes('chainlink')) return "⛓️";
  if (id.includes('deepseek')) return "🌊";
  return "✦";
};

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const available = AI_MODELS.filter(m => m.available);
  const unavailable = AI_MODELS.filter(m => !m.available);
  const selected = AI_MODELS.find(m => m.id === value);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[140px] sm:w-[170px] h-8 text-[10px] font-mono border-border bg-card/40 hover:bg-card/60 transition-colors">
        <div className="flex items-center gap-1.5 truncate">
          <span className="text-sm">{selected ? getIcon(selected.id) : "🔮"}</span>
          <SelectValue placeholder="Modelo" />
        </div>
      </SelectTrigger>
      <SelectContent className="max-h-[350px] bg-popover/95 backdrop-blur-xl border-border">
        <div className="px-2 py-1.5 flex items-center gap-2 border-b border-border">
          <Zap className="w-3 h-3 text-secondary" />
          <span className="text-[10px] font-mono font-bold text-foreground/70 tracking-wider">ACTIVOS</span>
        </div>
        {available.map((model) => (
          <SelectItem key={model.id} value={model.id} className="focus:bg-muted/30 cursor-pointer">
            <div className="flex items-center gap-2 py-0.5">
              <span className="text-sm">{getIcon(model.id)}</span>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-medium text-foreground">{model.name}</span>
                  {model.supportsVision && <Eye className="w-3 h-3 text-secondary/70" />}
                </div>
                <span className="text-[9px] font-mono text-muted-foreground/50">{model.description}</span>
              </div>
            </div>
          </SelectItem>
        ))}

        {unavailable.length > 0 && (
          <>
            <div className="px-2 py-1.5 flex items-center gap-2 border-t border-border mt-1">
              <Sparkles className="w-3 h-3 text-muted-foreground/50" />
              <span className="text-[10px] font-mono text-muted-foreground/50 tracking-wider">PRÓXIMAMENTE</span>
            </div>
            {unavailable.map((model) => (
              <SelectItem key={model.id} value={model.id} disabled className="opacity-40">
                <div className="flex items-center gap-2 py-0.5">
                  <span className="text-sm grayscale">{getIcon(model.id)}</span>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-muted-foreground">{model.name}</span>
                      <Badge variant="outline" className="text-[7px] px-1 py-0 h-3 border-border font-mono">Soon</Badge>
                    </div>
                    <span className="text-[9px] font-mono text-muted-foreground/40">{model.provider}</span>
                  </div>
                </div>
              </SelectItem>
            ))}
          </>
        )}
      </SelectContent>
    </Select>
  );
}
