import { useState } from "react";
import { type LucideIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface MobileBarItem {
  id: string;
  icon: LucideIcon;
  label: string;
  content: React.ReactNode;
}

interface MobileGlobeBarProps {
  items: MobileBarItem[];
}

/**
 * Mobile-only bottom bar. Each icon opens a bottom sheet hosting the panel.
 * Hidden on md+.
 */
export function MobileGlobeBar({ items }: MobileGlobeBarProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = items.find((i) => i.id === openId) ?? null;

  return (
    <>
      <div className="md:hidden absolute bottom-2 left-2 right-2 z-40 pointer-events-auto">
        <div className="flex items-center justify-around gap-1 px-2 py-2 rounded-2xl bg-slate-950/80 backdrop-blur-2xl border border-slate-700/40 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          {items.map((item) => {
            const Icon = item.icon;
            const active = openId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                onClick={() => setOpenId(active ? null : item.id)}
                className={cn(
                  "flex-1 min-h-11 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors",
                  active
                    ? "bg-cyan-500/15 text-cyan-300"
                    : "text-slate-400 active:bg-slate-800/60",
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[9px] uppercase tracking-wider font-medium">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpenId(null)}>
        <SheetContent
          side="bottom"
          className="md:hidden h-[80vh] p-0 bg-slate-950/95 backdrop-blur-2xl border-slate-700/40 overflow-hidden flex flex-col"
        >
          <SheetHeader className="px-4 py-3 border-b border-slate-700/40 shrink-0">
            <SheetTitle className="text-slate-200 text-sm uppercase tracking-wider">
              {open?.label}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-3">{open?.content}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}