import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AI_MODELS } from "@/lib/ai-models";
import { Zap, Brain, Sparkles, Link2, Eye } from "lucide-react";

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const getOracleIcon = (id: string) => {
  if (id.includes('gemini')) return "🔮";
  if (id.includes('gpt')) return "⚡";
  if (id.includes('deepseek')) return "🌊";
  if (id.includes('grok')) return "🚀";
  if (id.includes('claude')) return "🎭";
  if (id.includes('chaingpt')) return "🔗";
  if (id.includes('chainlink')) return "⛓️";
  return "✦";
};

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const availableModels = AI_MODELS.filter(m => m.available);
  const unavailableModels = AI_MODELS.filter(m => !m.available);
  const selectedModel = AI_MODELS.find(m => m.id === value);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[140px] sm:w-[180px] h-7 text-[10px] border-secondary/40 bg-card/60 backdrop-blur-sm hover:border-secondary/60 transition-colors">
        <div className="flex items-center gap-1.5 truncate">
          <span className="text-sm">{selectedModel ? getOracleIcon(selectedModel.id) : "🔮"}</span>
          <SelectValue placeholder="Oráculo" />
        </div>
      </SelectTrigger>
      <SelectContent className="max-h-[350px] bg-popover/95 backdrop-blur-xl border-secondary/40">
        {/* Active Oracles */}
        <div className="px-2 py-1.5 flex items-center gap-2 border-b border-secondary/20">
          <Zap className="w-3 h-3 text-primary" />
          <span className="text-[10px] font-heading text-primary tracking-wider">
            ORÁCULOS ACTIVOS
          </span>
        </div>
        {availableModels.map((model) => (
          <SelectItem 
            key={model.id} 
            value={model.id}
            className="focus:bg-secondary/20 cursor-pointer"
          >
            <div className="flex items-center gap-2 py-0.5">
              <span className="text-base">{getOracleIcon(model.id)}</span>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground">{model.name}</span>
                  {model.supportsVision && (
                    <Eye className="w-3 h-3 text-secondary" />
                  )}
                </div>
                <span className="text-[9px] text-muted-foreground">{model.description}</span>
              </div>
            </div>
          </SelectItem>
        ))}

        {/* Coming Soon Oracles */}
        {unavailableModels.length > 0 && (
          <>
            <div className="px-2 py-1.5 flex items-center gap-2 border-t border-secondary/20 mt-1">
              <Sparkles className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-heading text-muted-foreground tracking-wider">
                PRÓXIMAMENTE
              </span>
            </div>
            {unavailableModels.map((model) => (
              <SelectItem 
                key={model.id} 
                value={model.id} 
                disabled
                className="opacity-50"
              >
                <div className="flex items-center gap-2 py-0.5">
                  <span className="text-base grayscale">{getOracleIcon(model.id)}</span>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">{model.name}</span>
                      <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-muted-foreground/30">
                        Soon
                      </Badge>
                    </div>
                    <span className="text-[9px] text-muted-foreground/60">{model.provider}</span>
                  </div>
                </div>
              </SelectItem>
            ))}
          </>
        )}

        {/* Footer */}
        <div className="px-2 py-1.5 text-[8px] text-muted-foreground/50 border-t border-secondary/20 mt-1 flex items-center gap-1">
          <Link2 className="w-2.5 h-2.5" />
          <span>ChainGPT & Chainlink próximamente</span>
        </div>
      </SelectContent>
    </Select>
  );
}
