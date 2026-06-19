import { useState } from "react";
import { X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RailItem {
  id: string;
  icon: LucideIcon;
  label: string;
  content: React.ReactNode;
}

interface GlobePanelRailProps {
  items: RailItem[];
  side: "left" | "right";
  /** Approx width of the rendered panel (px) so the popover sits flush against the rail. */
  panelWidth?: number;
}

/**
 * Vertical icon rail (48px) with a single floating popover panel.
 * Only one panel is open at a time; click the active icon to close.
 */
export function GlobePanelRail({ items, side, panelWidth = 300 }: GlobePanelRailProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = items.find((i) => i.id === openId) ?? null;

  return (
    <div
      className={cn(
        "absolute top-2 bottom-2 z-40 flex pointer-events-none",
        side === "left" ? "left-2 flex-row" : "right-2 flex-row-reverse",
      )}
    >
      {/* Icon rail */}
      <div className="pointer-events-auto flex flex-col gap-1.5 p-1.5 rounded-2xl bg-slate-950/70 backdrop-blur-2xl border border-slate-700/40 shadow-[0_8px_32px_rgba(0,0,0,0.45)] h-fit">
        {items.map((item) => {
          const Icon = item.icon;
          const active = openId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              aria-pressed={active}
              onClick={() => setOpenId(active ? null : item.id)}
              className={cn(
                "w-9 h-9 grid place-items-center rounded-xl transition-all",
                active
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_12px_rgba(34,211,238,0.4)]"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent",
              )}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>

      {/* Floating panel */}
      {open && (
        <div
          className={cn(
            "pointer-events-auto ml-2 mr-2 overflow-y-auto max-h-full",
            "animate-in fade-in slide-in-from-left-2 duration-150",
          )}
          style={{ width: panelWidth }}
        >
          <div className="relative">
            <button
              type="button"
              aria-label={`Close ${open.label}`}
              onClick={() => setOpenId(null)}
              className="absolute top-2 right-2 z-10 w-6 h-6 grid place-items-center rounded-md bg-slate-900/70 border border-slate-700/40 text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            {open.content}
          </div>
        </div>
      )}
    </div>
  );
}