import { Bot, Radio, Orbit, Globe, BarChart3, Settings } from "lucide-react";
import type { TabId } from "@/pages/Index";

const SECTIONS: { id: TabId; label: string; icon: typeof Bot }[] = [
  { id: "agents", label: "Agents", icon: Bot },
  { id: "alien", label: "Alien", icon: Radio },
  { id: "cosmos", label: "Cosmos", icon: Orbit },
  { id: "globe", label: "Globe", icon: Globe },
  { id: "markets", label: "Markets", icon: BarChart3 },
  { id: "system", label: "System", icon: Settings },
];

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border/40 safe-area-bottom">
      <div className="flex items-center justify-around h-14 px-1">
        {SECTIONS.map((section) => {
          const isActive = activeTab === section.id;
          return (
            <button
              key={section.id}
              onClick={() => onTabChange(section.id)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 transition-colors duration-200 ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground/50 active:text-foreground"
              }`}
            >
              <section.icon className={`h-5 w-5 ${isActive ? "drop-shadow-[0_0_6px_hsl(var(--primary))]" : ""}`} />
              <span className="text-[9px] font-heading tracking-wider uppercase leading-none">
                {section.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
