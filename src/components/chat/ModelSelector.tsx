import { useState, useCallback, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { AI_MODELS, type AIModel } from "@/lib/ai-models";
import { Eye, Zap, ChevronDown, Sparkles, Brain, Rocket, Check, Star, Gauge } from "lucide-react";
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

const SPEED_CONFIG: Record<string, { label: string; bars: number; className: string }> = {
  instant: { label: "~0.3s", bars: 4, className: "text-secondary" },
  fast: { label: "~1s", bars: 3, className: "text-secondary" },
  medium: { label: "~2s", bars: 2, className: "text-primary" },
  slow: { label: "~4s", bars: 1, className: "text-muted-foreground" },
};

const getIcon = (m: AIModel) => m.oracleIcon || "✦";

const SpeedIndicator = ({ speed }: { speed: string }) => {
  const config = SPEED_CONFIG[speed] || SPEED_CONFIG.medium;
  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-[2px]">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={cn("w-[3px] rounded-full transition-all", i <= config.bars ? "bg-secondary" : "bg-border/40")}
            style={{ height: `${4 + i * 2}px` }} />
        ))}
      </div>
      <span className={cn("text-[8px] font-mono", config.className)}>{config.label}</span>
    </div>
  );
};

const QualityBar = ({ level }: { level: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map(i => (
      <div key={i} className={cn("w-1 h-2.5 rounded-full transition-all", i <= level ? "bg-secondary" : "bg-border/50")} />
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

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 h-8 px-3 rounded-full border border-border/60 bg-card/40 hover:bg-card/70 hover:border-primary/30 transition-all duration-200 text-xs font-mono group hover:shadow-[0_0_20px_hsl(var(--primary)/0.1)]">
          <span className="text-sm">{selected ? getIcon(selected) : "🔮"}</span>
          <span className="text-foreground/80 truncate max-w-[100px] sm:max-w-[130px]">{selected?.name || "Modelo"}</span>
          {selected?.oracleType && ORACLE_TYPE_BADGES[selected.oracleType] && (
            <Badge variant="outline" className={cn("text-[7px] px-1.5 py-0 h-3.5 font-mono", ORACLE_TYPE_BADGES[selected.oracleType].className)}>
              {ORACLE_TYPE_BADGES[selected.oracleType].label}
            </Badge>
          )}
          {selected?.speed && (
            <SpeedIndicator speed={selected.speed} />
          )}
          <ChevronDown className={cn("w-3 h-3 text-muted-foreground/50 group-hover:text-foreground/60 transition-all duration-200", open && "rotate-180")} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[380px] p-0 bg-popover/95 backdrop-blur-xl border-border shadow-[0_0_60px_hsl(var(--primary)/0.1)] animate-in zoom-in-95 fade-in duration-200"
        align="center"
        sideOffset={8}
      >
        <Command className="bg-transparent">
          <div className="px-3 pt-3 pb-1">
            <CommandInput placeholder="Buscar oráculo..." className="text-xs h-9" />
            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-[8px] font-heading tracking-[0.2em] text-muted-foreground/40 uppercase">
                {AI_MODELS.filter(m => m.available).length} oracles online
              </span>
              <span className="text-[8px] font-mono text-muted-foreground/30">↑↓ navegar · ↵ seleccionar</span>
            </div>
          </div>
          <CommandList className="max-h-[420px] px-1.5 pb-1.5">
            <CommandEmpty className="text-xs text-muted-foreground/50 py-4">No encontrado</CommandEmpty>
            {ORACLE_CATEGORIES.map((cat, catIdx) => {
              const models = AI_MODELS.filter(cat.filter);
              if (models.length === 0) return null;
              const isSoon = cat.key === "soon";
              return (
                <div key={cat.key}>
                  {catIdx > 0 && <CommandSeparator className="my-1" />}
                  <CommandGroup heading={
                    <div className="flex items-center gap-2 text-[10px] font-heading tracking-[0.15em] uppercase">
                      <span className={isSoon ? "text-muted-foreground/40" : "text-secondary"}>{cat.icon}</span>
                      <span className={isSoon ? "text-muted-foreground/40" : "text-foreground/60"}>{cat.label}</span>
                    </div>
                  }>
                    {models.map(model => {
                      const isSelected = model.id === value;
                      return (
                        <CommandItem
                          key={model.id}
                          value={model.name + " " + model.provider + " " + model.description}
                          onSelect={() => { if (model.available) { onChange(model.id); setOpen(false); } }}
                          disabled={!model.available}
                          className={cn(
                            "flex items-center gap-3 py-3 px-2 rounded-lg cursor-pointer transition-all duration-150",
                            !model.available && "opacity-35 cursor-not-allowed",
                            isSelected && "bg-primary/10 border border-primary/25 shadow-[0_0_15px_hsl(var(--primary)/0.08)]",
                            !isSelected && model.available && "hover:bg-muted/15"
                          )}
                        >
                          <div className={cn(
                            "w-9 h-9 rounded-lg border flex items-center justify-center text-base shrink-0 transition-all duration-200",
                            isSelected ? "bg-primary/15 border-primary/30 shadow-[0_0_12px_hsl(var(--primary)/0.15)]" : "bg-muted/20 border-border/50"
                          )}>
                            {getIcon(model)}
                          </div>
                          <div className="flex flex-col flex-1 min-w-0 gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className={cn("text-xs font-mono font-medium truncate", isSelected ? "text-foreground" : "text-foreground/80")}>{model.name}</span>
                              {model.recommended && (
                                <Badge variant="outline" className="text-[7px] px-1 py-0 h-3.5 font-mono border-secondary/40 text-secondary bg-secondary/10 animate-pulse">
                                  <Star className="w-2 h-2 mr-0.5" />REC
                                </Badge>
                              )}
                              {model.supportsVision && <Eye className="w-3 h-3 text-secondary/50 shrink-0" />}
                              {isSelected && <Check className="w-3 h-3 text-primary shrink-0" />}
                            </div>
                            <span className="text-[9px] font-mono text-muted-foreground/50 truncate">{model.description}</span>
                            {/* Context + Speed row */}
                            {model.available && (
                              <div className="flex items-center gap-3 mt-0.5">
                                {model.contextWindow && (
                                  <span className="text-[8px] font-mono text-muted-foreground/40 flex items-center gap-0.5">
                                    <Gauge className="w-2.5 h-2.5" />{model.contextWindow} ctx
                                  </span>
                                )}
                                {model.speed && <SpeedIndicator speed={model.speed} />}
                              </div>
                            )}
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
                      );
                    })}
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
