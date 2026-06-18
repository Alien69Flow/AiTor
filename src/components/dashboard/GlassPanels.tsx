import { ReactNode, useState } from "react";
import { ChevronUp, ChevronDown, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// GLASS PANEL SYSTEM - Premium World-Class UI
// ============================================

// Premium glass with depth and subtle glow
const GLASS_BASE = "backdrop-blur-2xl rounded-2xl transition-all duration-300";
const GLASS_PRIMARY = "bg-slate-900/60 border border-slate-700/40 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]";
const GLASS_SECONDARY = "bg-slate-800/40 border border-slate-700/30 shadow-[0_4px_16px_rgba(0,0,0,0.3)]";

// Animated LED indicator with halo glow
export function LedIndicator({
  color,
  active = true,
  size = "md",
  pulse = true,
}: {
  color: string;
  active?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  pulse?: boolean;
}) {
  const sizeMap = {
    xs: "w-1.5 h-1.5",
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
    lg: "w-3 h-3",
  };

  return (
    <div
      className={cn(
        "rounded-full transition-all duration-500",
        sizeMap[size],
        active && pulse && "animate-pulse"
      )}
      style={{
        backgroundColor: active ? color : "rgba(71, 85, 105, 0.3)",
        boxShadow: active
          ? `0 0 8px ${color}90, 0 0 20px ${color}50, 0 0 32px ${color}25`
          : "none",
      }}
    />
  );
}

// Premium status badge with glow
export function StatusBadge({
  children,
  variant = "default",
  glow = false,
}: {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  glow?: boolean;
}) {
  const variantStyles = {
    default: "bg-slate-700/50 text-slate-300 border-slate-600/40",
    success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    warning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    danger: "bg-red-500/15 text-red-400 border-red-500/30",
    info: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  };

  const glowColors = {
    default: "rgba(148, 163, 184, 0.3)",
    success: "rgba(52, 211, 153, 0.4)",
    warning: "rgba(251, 191, 36, 0.4)",
    danger: "rgba(248, 113, 113, 0.4)",
    info: "rgba(56, 189, 248, 0.4)",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider rounded-md border transition-all duration-200",
        variantStyles[variant]
      )}
      style={
        glow
          ? { boxShadow: `0 0 12px ${glowColors[variant]}` }
          : undefined
      }
    >
      {children}
    </span>
  );
}

// Collapsible panel header
function PanelHeader({
  icon: Icon,
  title,
  collapsible = false,
  collapsed = false,
  onToggle,
  variant = "primary",
  children,
}: {
  icon?: LucideIcon;
  title: string;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  variant?: "primary" | "secondary";
  children?: ReactNode;
}) {
  const containerClass = variant === "primary" ? "border-b border-slate-700/30" : "";

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-3",
        collapsible && "cursor-pointer hover:bg-slate-800/20 transition-colors",
        containerClass
      )}
      onClick={collapsible ? onToggle : undefined}
    >
      <div className="flex items-center gap-2.5">
        {Icon && (
          <Icon
            className="w-4 h-4 text-slate-400"
            strokeWidth={1.5}
          />
        )}
        <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/85">
          {title}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {children}
        {collapsible && (
          collapsed ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
          )
        )}
      </div>
    </div>
  );
}

// Main GlassPanel component
export function GlassPanel({
  children,
  icon,
  title,
  collapsible = false,
  defaultCollapsed = false,
  className,
  headerRight,
  onClose,
  variant = "primary",
  glowBorder = false,
  glowColor,
}: {
  children: ReactNode;
  icon?: LucideIcon;
  title?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
  headerRight?: ReactNode;
  onClose?: () => void;
  variant?: "primary" | "secondary";
  glowBorder?: boolean;
  glowColor?: string;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const glassClass = variant === "primary" ? GLASS_PRIMARY : GLASS_SECONDARY;

  return (
    <div
      className={cn(
        GLASS_BASE,
        glassClass,
        "overflow-hidden",
        glowBorder && "border-opacity-60",
        className
      )}
      style={
        glowBorder && glowColor
          ? {
              borderColor: `${glowColor}40`,
              boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 24px ${glowColor}20, inset 0 1px 0 rgba(255,255,255,0.05)`,
            }
          : undefined
      }
    >
      {title && (
        <PanelHeader
          icon={icon}
          title={title}
          collapsible={collapsible}
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          variant={variant}
        >
          {headerRight}
          {onClose && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1 rounded-lg hover:bg-slate-700/40 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-slate-500" />
            </button>
          )}
        </PanelHeader>
      )}
      {(!collapsible || !collapsed) && (
        <div className="p-4 animate-in fade-in-0 duration-200">{children}</div>
      )}
    </div>
  );
}

// Category chip with glow effect
export function CategoryChip({
  label,
  color,
  active,
  count,
  icon: Icon,
  onClick,
}: {
  label: string;
  color: string;
  active: boolean;
  count?: number;
  icon?: LucideIcon;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-medium border transition-all duration-250",
        active
          ? "bg-slate-800/50 border-slate-600/50 text-white/90 shadow-[0_4px_16px_rgba(0,0,0,0.2)]"
          : "bg-slate-900/30 border-slate-700/25 text-slate-500 hover:bg-slate-800/30 hover:border-slate-600/35 hover:text-slate-400"
      )}
      style={
        active
          ? {
              boxShadow: `0 4px 16px rgba(0,0,0,0.2), 0 0 20px ${color}15`,
              borderColor: `${color}40`,
            }
          : undefined
      }
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {Icon && (
          <Icon
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: active ? color : "#64748b" }}
          />
        )}
        <span className="truncate">{label}</span>
      </div>
      <LedIndicator color={color} active={active} size="sm" />
      {count !== undefined && count > 0 && (
        <span className="text-[9px] text-slate-500 ml-1 font-mono">
          {count}
        </span>
      )}
    </button>
  );
}

// Toggle row with LED indicator
export function ToggleRow({
  icon: Icon,
  label,
  color,
  active,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  color: string;
  active: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[10px] font-medium uppercase tracking-wider border transition-all duration-200",
        active
          ? "bg-slate-800/40 border-slate-600/40 text-slate-200"
          : "bg-slate-900/20 border-slate-700/20 text-slate-500 hover:bg-slate-800/30 hover:border-slate-600/30"
      )}
    >
      <Icon
        className="w-4 h-4 shrink-0"
        style={{ color: active ? color : "#64748b" }}
      />
      <span className="flex-1 text-left">{label}</span>
      <LedIndicator color={color} active={active} size="xs" />
    </button>
  );
}

// Metric card for telemetry display
export function MetricCard({
  id,
  value,
  delta,
  status = "stable",
  variant = "default",
}: {
  id: string;
  value: string;
  delta?: string;
  status?: "stable" | "warn" | "alert";
  variant?: "default" | "compact";
}) {
  const statusColors = {
    stable: "#34d399",
    warn: "#fbbf24",
    alert: "#f87171",
  };

  const isCompact = variant === "compact";

  return (
    <div
      className={cn(
        "flex flex-col gap-1 bg-slate-800/30 border border-slate-700/25 rounded-xl",
        isCompact ? "p-2" : "p-3"
      )}
    >
      <span className="text-[8px] uppercase tracking-[0.12em] text-slate-500 font-mono truncate">
        {id}
      </span>
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "font-semibold font-mono text-white/90",
            isCompact ? "text-sm" : "text-base"
          )}
        >
          {value}
        </span>
        <LedIndicator color={statusColors[status]} active size="xs" />
      </div>
      {delta && (
        <span
          className={cn(
            "font-mono",
            isCompact ? "text-[8px]" : "text-[9px]",
            delta.startsWith("+")
              ? "text-emerald-400"
              : delta.startsWith("-")
              ? "text-red-400"
              : "text-slate-500"
          )}
        >
          {delta}
        </span>
      )}
    </div>
  );
}

// Section title with divider
export function SectionTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 mb-3", className)}>
      <div className="flex-1 h-px bg-gradient-to-r from-slate-700/40 via-slate-600/30 to-transparent" />
      <span className="text-[9px] uppercase tracking-[0.16em] text-slate-500 font-medium">
        {children}
      </span>
      <div className="flex-1 h-px bg-gradient-to-l from-slate-700/40 via-slate-600/30 to-transparent" />
    </div>
  );
}

// Premium feed item card
export function FeedItemCard({
  icon: Icon,
  iconColor,
  source,
  timestamp,
  title,
  badges,
  onClick,
}: {
  icon: LucideIcon;
  iconColor: string;
  source: string;
  timestamp: string;
  title: string;
  badges?: Array<{ label: string; color: string }>;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group px-4 py-3 border-b border-slate-700/15 transition-all duration-200",
        onClick && "cursor-pointer hover:bg-slate-800/30"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
          style={{
            background: `linear-gradient(135deg, ${iconColor}15 0%, ${iconColor}08 100%)`,
            boxShadow: `0 0 16px ${iconColor}15`,
          }}
        >
          <Icon className="w-4 h-4" style={{ color: iconColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[11px] font-semibold text-white/90">{source}</span>
            <span className="text-[9px] text-slate-500">{timestamp}</span>
          </div>
          {badges && badges.length > 0 && (
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              {badges.map((b, i) => (
                <StatusBadge key={i} variant="default" glow>
                  {b.label}
                </StatusBadge>
              ))}
            </div>
          )}
          <p className="text-[10px] text-slate-400 leading-relaxed">{title}</p>
        </div>
      </div>
    </div>
  );
}

// Navigation pill for bottom bar
export function NavPill({
  icon: Icon,
  label,
  active,
  onClick,
  highlight,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick?: () => void;
  highlight?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-medium transition-all duration-200 border border-transparent",
        active
          ? "text-white/90 bg-slate-800/50 border-slate-600/40"
          : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/30"
      )}
      style={
        highlight
          ? {
              boxShadow: `0 0 16px ${highlight}25`,
              borderColor: `${highlight}40`,
            }
          : undefined
      }
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  );
}
