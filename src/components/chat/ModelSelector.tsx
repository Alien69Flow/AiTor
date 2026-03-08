import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { AI_MODELS, type AIModel } from "@/lib/ai-models";
import { Eye, Zap, ChevronDown, Sparkles, Brain, Link2, Rocket, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const ORACLE_CATEGORIES: { key: string; label: string; icon: React.ReactNode; filter: (m: AIModel) => boolean }[] = [
  { key: "alienflow", label: "ΔlieπFlΦw Oracles", icon: <Zap className="w-3 h-3" />, filter: m => m.available && m.provider === "ΔlieπFlΦw" },
  { key: "openai", label: "OpenAI", icon: <Brain className="w-3 h-3" />, filter: m => m.available && m.provider === "Lovable AI" },
  { key: "external", label: "External Oracles", icon: <Rocket className="w-3 h-3" />, filter: m => m.available && m.oracleType === "external" },
  { key: "soon", label: "Próximamente", icon: <Sparkles className="w-3 h-3" />, filter: m => !m.available },
];

const ORACLE_TYPE_BADGES: Record<string, { label: string; className: string }> = {
  primary: { label: "Fast", className: "border-secondary/40 text-secondary bg-secondary/10" },
  advanced: { label: "Pro", className: "border-primary/40 text-primary bg-primary/10" },
  blockchain: { label: "Chain", className: "border-accent/40 text-accent bg-accent/10" },
  external: { label: "API", className: "border-muted-foreground/40 text-muted-foreground bg-muted/30" },
};

const getIcon = (m: AIModel) => m.oracleIcon || "✦";

const QualityBar = ({ level }: { level: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map(i => (
      <div key={i} className={cn("w-1 h-2.5 rounded-full", i <= level ? "bg-secondary" : "bg-border/50")} />
    ))}
  </div>
);

const getQuality = (id: string): number => {
  if (id.includes("pro") || id === "openai/gpt-5") return 5;
  if (id.includes("flash") && !id.includes("lite")) return 4;
  if (id.includes("mini")) return 3;
  if (id.includes("nano") || id.includes("lite")) return 2;
  return 3;
};

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const selected = AI_MODELS.find(m => m.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 h-8 px-3 rounded-full border border-border/60 bg-card/40 hover:bg-card/70 hover:border-primary/30 transition-all text-xs font-mono group">
          <span className="text-sm">{selected ? getIcon(selected) : "🔮"}</span>
          <span className="text-foreground/80 truncate max-w-[100px] sm:max-w-[130px]">{selected?.name || "Modelo"}</span>
          {selected?.oracleType && ORACLE_TYPE_BADGES[selected.oracleType] && (
            <Badge variant="outline" className={cn("text-[7px] px-1.5 py-0 h-3.5 font-mono", ORACLE_TYPE_BADGES[selected.oracleType].className)}>
              {ORACLE_TYPE_BADGES[selected.oracleType].label}
            </Badge>
          )}
          <ChevronDown className="w-3 h-3 text-muted-foreground/50 group-hover:text-foreground/60 transition-colors" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0 bg-popover/95 backdrop-blur-xl border-border shadow-[0_0_40px_hsl(var(--primary)/0.08)]" align="center" sideOffset={8}>
        <Command className="bg-transparent">
          <CommandInput placeholder="Buscar oráculo..." className="text-xs h-10" />
          <CommandList className="max-h-[400px]">
            <CommandEmpty className="text-xs text-muted-foreground/50 py-4">No encontrado</CommandEmpty>
            {ORACLE_CATEGORIES.map((cat, catIdx) => {
              const models = AI_MODELS.filter(cat.filter);
              if (models.length === 0) return null;
              const isSoon = cat.key === "soon";
              return (
                <div key={cat.key}>
                  {catIdx > 0 && <CommandSeparator />}
                  <CommandGroup heading={
                    <div className="flex items-center gap-2 text-[10px] font-heading tracking-[0.15em] uppercase">
                      <span className={isSoon ? "text-muted-foreground/40" : "text-secondary"}>{cat.icon}</span>
                      <span className={isSoon ? "text-muted-foreground/40" : "text-foreground/60"}>{cat.label}</span>
                    </div>
                  }>
                    {models.map(model => (
                      <CommandItem
                        key={model.id}
                        value={model.name + " " + model.provider + " " + model.description}
                        onSelect={() => { if (model.available) { onChange(model.id); setOpen(false); } }}
                        disabled={!model.available}
                        className={cn(
                          "flex items-center gap-3 py-2.5 px-2 rounded-lg cursor-pointer",
                          !model.available && "opacity-40 cursor-not-allowed",
                          model.id === value && "bg-primary/8 border border-primary/20"
                        )}
                      >
                        <div className="w-8 h-8 rounded-lg bg-muted/20 border border-border/50 flex items-center justify-center text-base shrink-0">
                          {getIcon(model)}
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono font-medium text-foreground truncate">{model.name}</span>
                            {model.supportsVision && <Eye className="w-3 h-3 text-secondary/60 shrink-0" />}
                            {model.id === value && <Check className="w-3 h-3 text-primary shrink-0" />}
                          </div>
                          <span className="text-[9px] font-mono text-muted-foreground/50 truncate">{model.description}</span>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {model.oracleType && ORACLE_TYPE_BADGES[model.oracleType] && (
                            <Badge variant="outline" className={cn("text-[7px] px-1 py-0 h-3 font-mono", ORACLE_TYPE_BADGES[model.oracleType].className)}>
                              {ORACLE_TYPE_BADGES[model.oracleType].label}
                            </Badge>
                          )}
                          {model.available && <QualityBar level={getQuality(model.id)} />}
                          {!model.available && (
                            <Badge variant="outline" className="text-[7px] px-1 py-0 h-3 font-mono border-border text-muted-foreground/40">Soon</Badge>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </div>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
