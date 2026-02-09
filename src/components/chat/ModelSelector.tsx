import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AI_MODELS, MODEL_CATEGORIES } from "@/lib/ai-models";
import { Eye, Sparkles, Image } from "lucide-react";

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const selectedModel = AI_MODELS.find(m => m.id === value);

  // Group models by category
  const grouped = AI_MODELS.reduce((acc, model) => {
    if (!acc[model.oracleType]) acc[model.oracleType] = [];
    acc[model.oracleType].push(model);
    return acc;
  }, {} as Record<string, typeof AI_MODELS>);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[140px] sm:w-[200px] h-7 text-[10px] border-border/30 bg-card/60 backdrop-blur-sm hover:border-primary/30 transition-colors">
        <div className="flex items-center gap-1.5 truncate">
          <span className="text-sm">{selectedModel?.oracleIcon || "🔮"}</span>
          <SelectValue placeholder="Oráculo" />
        </div>
      </SelectTrigger>
      <SelectContent className="max-h-[400px] bg-popover/95 backdrop-blur-xl border-border/30">
        {Object.entries(grouped).map(([type, models]) => {
          const category = MODEL_CATEGORIES[type as keyof typeof MODEL_CATEGORIES];
          return (
            <div key={type}>
              <div className="px-2 py-1.5 flex items-center gap-2 border-b border-border/10">
                <span className="text-xs">{category?.icon || "⚡"}</span>
                <span className="text-[9px] font-heading text-muted-foreground tracking-wider uppercase">
                  {category?.label || type}
                </span>
              </div>
              {models.map((model) => (
                <SelectItem
                  key={model.id}
                  value={model.id}
                  disabled={!model.available}
                  className="focus:bg-primary/10 cursor-pointer"
                >
                  <div className="flex items-center gap-2 py-0.5">
                    <span className="text-base">{model.oracleIcon}</span>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-medium text-xs ${model.available ? 'text-foreground' : 'text-muted-foreground/50'}`}>{model.name}</span>
                        {!model.available && (
                          <Badge variant="outline" className="text-[7px] px-1 py-0 h-3.5 border-muted-foreground/30 text-muted-foreground/50">SOON</Badge>
                        )}
                        {model.supportsVision && model.available && <Eye className="w-2.5 h-2.5 text-secondary/70" />}
                        {model.supportsImageGen && model.available && <Image className="w-2.5 h-2.5 text-primary/70" />}
                      </div>
                      <span className="text-[9px] text-muted-foreground">{model.description}</span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </div>
          );
        })}

        <div className="px-2 py-1 text-[8px] text-muted-foreground/40 border-t border-border/10 mt-1 text-center font-mono">
          11 Oráculos · Lovable AI Gateway
        </div>
      </SelectContent>
    </Select>
  );
}
