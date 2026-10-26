import { useState, useCallback, useEffect, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { AI_MODELS, type AIModel } from "@/lib/ai-models";
import {
  AVAILABILITY_LABEL,
  availabilityHint,
  resolveOracles,
  useChatHealth,
  type ResolvedOracle,
} from "@/lib/ai-health";
import { Eye, Zap, ChevronDown, Brain, Rocket, Check, Star, Gauge, Lock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Categorías por proveedor. Solo agrupan oráculos que pueden contestar: los que
 * carecen de clave no se esconden, bajan al grupo "No disponibles" con el motivo.
 */
const ORACLE_CATEGORIES: { key: string; label: string; icon: React.ReactNode; filter: (o: ResolvedOracle) => boolean }[] = [
  { key: "alienflow", label: "ΔlieπFlΦw Oracles", icon: <Zap className="w-3 h-3" />, filter: o => o.model.provider === "ΔlieπFlΦw" },
  { key: "openai", label: "OpenAI", icon: <Brain className="w-3 h-3" />, filter: o => o.model.provider === "Lovable AI" },
  { key: "external", label: "External Oracles", icon: <Rocket className="w-3 h-3" />, filter: o => o.model.oracleType === "external" },
];

const ORACLE_TYPE_BADGES: Record<string, { label: string; className: string }> = {
  primary: { label: "Fast", className: "border-secondary/40 text-secondary bg-secondary/10" },
  advanced: { label: "Pro", className: "border-primary/40 text-primary bg-primary/10" },
  blockchain: { label: "Chain", className: "border-accent/40 text-accent bg-accent/10" },
  external: { label: "API", className: "border-muted-foreground/40 text-muted-foreground bg-muted/30" },
};

// Dynamic glow color per oracle type — used for trigger button & active item
const ORACLE_GLOW: Record<string, { glow: string; ring: string; iconBg: string }> = {
  primary:    { glow: "shadow-[0_0_20px_hsl(var(--primary)/0.22)]", ring: "ring-1 ring-primary/40", iconBg: "bg-primary/15" },
  advanced:   { glow: "shadow-[0_0_20px_hsl(var(--accent)/0.24)]", ring: "ring-1 ring-accent/45", iconBg: "bg-accent/15" },
  blockchain: { glow: "shadow-[0_0_18px_hsl(var(--glow-cyan)/0.25)]", ring: "ring-1 ring-primary/30", iconBg: "bg-primary/10" },
  external:   { glow: "shadow-[0_0_18px_hsl(var(--secondary)/0.22)]", ring: "ring-1 ring-secondary/40", iconBg: "bg-secondary/10" },
};
const getGlow = (type?: string) => ORACLE_GLOW[type || "primary"] || ORACLE_GLOW.primary;

/** Badge for an oracle that cannot be selected, with the reason on hover. */
const availabilityBadge = (oracle: ResolvedOracle) => (
  <Badge
    variant="outline"
    title={availabilityHint(oracle)}
    className={cn(
      "text-[7px] px-1 py-0 h-3 font-mono",
      oracle.availability === "no-route"
        ? "border-border text-muted-foreground/40"
        : "border-destructive/40 text-destructive/80 bg-destructive/5",
    )}
  >
    {AVAILABILITY_LABEL[oracle.availability]}
  </Badge>
);

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
  const { health, checked, loading, refresh } = useChatHealth();

  // The catalogue is the same list as before; the report only decides which
  // rows can be picked. Without a report every row keeps its static state.
  const oracles = useMemo(() => resolveOracles(AI_MODELS, health), [health]);
  const ready = useMemo(() => oracles.filter(o => o.available), [oracles]);
  const blocked = useMemo(() => oracles.filter(o => !o.available), [oracles]);

  const selected = oracles.find(o => o.model.id === value);
  const selGlow = getGlow(selected?.model.oracleType);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const select = useCallback((oracle: ResolvedOracle) => {
    if (!oracle.available) return;
    onChange(oracle.model.id);
    setOpen(false);
  }, [onChange]);

  const renderOracle = (oracle: ResolvedOracle) => {
    const { model } = oracle;
    const isSelected = model.id === value;
    const glow = getGlow(model.oracleType);
    return (
      <CommandItem
        key={model.id}
        value={model.name + " " + model.provider + " " + model.description}
        onSelect={() => select(oracle)}
        disabled={!oracle.available}
        title={oracle.available ? `${model.name} · ${oracle.providerLabel}` : availabilityHint(oracle)}
        className={cn(
          "flex items-center gap-3 py-3 px-2 rounded-lg cursor-pointer transition-all duration-150",
          !oracle.available && "opacity-40 cursor-not-allowed",
          isSelected && cn("bg-primary/5 border border-primary/20", glow.glow),
          !isSelected && oracle.available && "hover:bg-muted/30 border border-transparent"
        )}
      >
        <div className={cn(
          "w-9 h-9 rounded-lg border flex items-center justify-center text-base shrink-0 transition-all duration-300",
          isSelected ? cn(glow.iconBg, glow.ring, "border-transparent") : "bg-muted/20 border-border/60"
        )}>
          {oracle.available ? getIcon(model) : <Lock className="w-3.5 h-3.5 text-muted-foreground/50" />}
        </div>
        <div className="flex flex-col flex-1 min-w-0 gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className={cn("text-xs font-mono font-medium truncate", isSelected ? "text-foreground" : "text-foreground/80")}>{model.name}</span>
            {model.recommended && (
              <Badge variant="outline" className="text-[7px] px-1 py-0 h-3.5 font-mono border-secondary/40 text-secondary bg-secondary/10">
                <Star className="w-2 h-2 mr-0.5" />REC
              </Badge>
            )}
            {model.supportsVision && <Eye className="w-3 h-3 text-secondary/50 shrink-0" />}
            {isSelected && <Check className="w-3 h-3 text-primary shrink-0" />}
          </div>
          <span className="text-[9px] font-mono text-muted-foreground/50 truncate">{model.description}</span>
          {/* Context + Speed row */}
          {oracle.available && (
            <div className="flex items-center gap-3 mt-0.5">
              {model.contextWindow && (
                <span className="text-[8px] font-mono text-muted-foreground/40 flex items-center gap-0.5">
                  <Gauge className="w-2.5 h-2.5" />{model.contextWindow} ctx
                </span>
              )}
              {model.speed && <SpeedIndicator speed={model.speed} />}
            </div>
          )}
          {!oracle.available && oracle.envVar && (
            <span className="text-[8px] font-mono text-destructive/60 truncate">falta {oracle.envVar}</span>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {model.oracleType && ORACLE_TYPE_BADGES[model.oracleType] && (
            <Badge variant="outline" className={cn("text-[7px] px-1 py-0 h-3 font-mono", ORACLE_TYPE_BADGES[model.oracleType].className)}>
              {ORACLE_TYPE_BADGES[model.oracleType].label}
            </Badge>
          )}
          {oracle.available ? <QualityBar level={getQuality(model.id)} /> : availabilityBadge(oracle)}
        </div>
      </CommandItem>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          title={selected && !selected.available ? availabilityHint(selected) : undefined}
          className={cn(
            "group flex h-8 items-center gap-1.5 border border-border/70 bg-card/80 px-2 font-mono text-[10px] backdrop-blur-xl",
            "hover:border-primary/40 hover:bg-card transition-all duration-300",
            selGlow.glow, selGlow.ring,
            selected && !selected.available && "border-destructive/40",
          )}>
          <span className={cn(
            "flex h-5 w-5 items-center justify-center text-xs transition-transform duration-300 group-hover:scale-110",
            selGlow.iconBg
          )}>{selected ? getIcon(selected.model) : "🔮"}</span>
          <span className="max-w-[72px] truncate text-foreground/80 sm:max-w-[120px]">{selected?.model.name || "Oráculo"}</span>
          {selected && !selected.available ? (
            <Badge variant="outline" className="text-[7px] px-1.5 py-0 h-3.5 font-mono border-destructive/40 text-destructive/80 bg-destructive/5">
              {AVAILABILITY_LABEL[selected.availability]}
            </Badge>
          ) : selected?.model.oracleType && ORACLE_TYPE_BADGES[selected.model.oracleType] && (
            <Badge variant="outline" className={cn("text-[7px] px-1.5 py-0 h-3.5 font-mono", ORACLE_TYPE_BADGES[selected.model.oracleType].className)}>
              {ORACLE_TYPE_BADGES[selected.model.oracleType].label}
            </Badge>
          )}
          {selected?.model.speed && (
            <div className="hidden lg:block">
              <SpeedIndicator speed={selected.model.speed} />
            </div>
          )}
          <ChevronDown className={cn("w-3 h-3 text-muted-foreground/50 group-hover:text-foreground/60 transition-all duration-200", open && "rotate-180")} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(380px,calc(100vw-16px))] border border-border bg-popover/95 p-0 text-popover-foreground shadow-2xl backdrop-blur-2xl animate-in zoom-in-95 fade-in duration-200"
        align="center"
        sideOffset={8}
      >
        <Command className="bg-transparent">
          <div className="px-3 pt-3 pb-1">
            <CommandInput placeholder="Buscar oráculo..." className="text-xs h-9" />
            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-[8px] font-heading tracking-[0.2em] text-muted-foreground/40 uppercase">
                {health
                  ? `${ready.length} de ${oracles.length} oráculos con clave`
                  : checked
                    ? `${ready.length} oráculos · claves sin verificar`
                    : "Comprobando claves…"}
              </span>
              <span className="text-[8px] font-mono text-muted-foreground/30">↑↓ navegar · ↵ seleccionar</span>
            </div>
          </div>
          <CommandList className="max-h-[420px] px-1.5 pb-1.5">
            <CommandEmpty className="text-xs text-muted-foreground/50 py-4">No encontrado</CommandEmpty>
            {checked && ready.length === 0 && (
              <div className="mx-1 mb-1 border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-[9px] font-mono leading-relaxed text-destructive/80">
                Ningún proveedor con clave válida. El chat responderá 500 hasta que configures
                {health ? ` ${health.providers.map(p => p.envVar).join(" · ")}` : " los secrets del proyecto"}.
              </div>
            )}
            {ORACLE_CATEGORIES.map((cat, catIdx) => {
              const models = ready.filter(cat.filter);
              if (models.length === 0) return null;
              return (
                <div key={cat.key}>
                  {catIdx > 0 && <CommandSeparator className="my-1" />}
                  <CommandGroup heading={
                    <div className="flex items-center gap-2 text-[10px] font-heading tracking-[0.15em] uppercase">
                      <span className="text-secondary">{cat.icon}</span>
                      <span className="text-foreground/60">{cat.label}</span>
                    </div>
                  }>
                    {models.map(renderOracle)}
                  </CommandGroup>
                </div>
              );
            })}
            {blocked.length > 0 && (
              <>
                <CommandSeparator className="my-1" />
                <CommandGroup heading={
                  <div className="flex items-center gap-2 text-[10px] font-heading tracking-[0.15em] uppercase">
                    <Lock className="w-3 h-3 text-muted-foreground/40" />
                    <span className="text-muted-foreground/50">No disponibles</span>
                    <span className="text-[8px] font-mono normal-case tracking-normal text-muted-foreground/30">
                      visibles a propósito
                    </span>
                  </div>
                }>
                  {blocked.map(renderOracle)}
                </CommandGroup>
              </>
            )}
          </CommandList>
          {/* Which providers actually hold a key, straight from `chat?health=1`. */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-border/60 px-3 py-2">
            {health ? health.providers.map(provider => (
              <span
                key={provider.id}
                title={`${provider.label} · ${provider.envVar} · ${provider.configured
                  ? "clave configurada"
                  : provider.keyState === "placeholder"
                    ? "valor presente pero no parece una clave"
                    : "sin clave"}`}
                className="flex items-center gap-1 text-[8px] font-mono"
              >
                <span className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  provider.configured ? "bg-secondary" : provider.keyState === "placeholder" ? "bg-yellow-500" : "bg-destructive/70",
                )} />
                <span className={provider.configured ? "text-foreground/60" : "text-muted-foreground/40"}>{provider.label}</span>
              </span>
            )) : (
              <span className="text-[8px] font-mono text-muted-foreground/40">
                {checked ? "Claves sin verificar" : "Comprobando claves…"}
              </span>
            )}
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              title="Preguntar otra vez al servidor por las claves"
              className="ml-auto flex items-center gap-1 text-[8px] font-mono text-muted-foreground/40 transition-colors hover:text-foreground/70 disabled:opacity-40"
            >
              <RefreshCw className={cn("h-2.5 w-2.5", loading && "animate-spin")} /> reintentar
            </button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
