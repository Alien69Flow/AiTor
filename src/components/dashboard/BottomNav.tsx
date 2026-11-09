import { Bot, Radio, Orbit, Globe, BarChart3, Gamepad2, Settings } from "lucide-react";
import type { TabId } from "@/pages/Index";

/**
 * En móvil esta barra es la única navegación: `TopNavBar` esconde sus pestañas
 * con `hidden md:flex`. Por eso tiene que listar las mismas secciones que la de
 * escritorio; sin `games` aquí el arcade solo se abría con un `?tab=games`
 * escrito a mano y parecía que la pestaña no existía.
 */
const SECTIONS: { id: TabId; label: string; icon: typeof Bot }[] = [
  { id: "agents", label: "Agents", icon: Bot },
  { id: "alien", label: "Alien", icon: Radio },
  { id: "cosmos", label: "Cosmos", icon: Orbit },
  { id: "globe", label: "Globe", icon: Globe },
  { id: "markets", label: "Markets", icon: BarChart3 },
  { id: "games", label: "Games", icon: Gamepad2 },
  { id: "system", label: "System", icon: Settings },
];

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav
      aria-label="Secciones del terminal"
      className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border/40 safe-area-bottom"
    >
      {/*
       * Siete secciones en el ancho de un teléfono: cada una se queda una
       * séptima parte con un mínimo de 2.75rem, que es lo que cabe en 320px.
       * Con desplazamiento horizontal la última sección quedaba escondida
       * fuera del borde y volvía el problema que esta barra debía resolver.
       */}
      <div className="flex h-14 items-stretch overflow-x-auto overscroll-x-contain no-scrollbar">
        {SECTIONS.map((section) => {
          const isActive = activeTab === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onTabChange(section.id)}
              aria-current={isActive ? "page" : undefined}
              aria-label={section.label}
              className={`relative flex min-w-[2.75rem] flex-1 flex-col items-center justify-center gap-1 px-0.5 pt-1.5 pb-1 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                isActive ? "text-primary" : "text-muted-foreground/55 active:text-foreground"
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute inset-x-2 top-0 h-[2px] rounded-full bg-primary transition-opacity duration-200 ${
                  isActive ? "opacity-100 shadow-[0_0_8px_hsl(var(--primary))]" : "opacity-0"
                }`}
              />
              <section.icon
                aria-hidden="true"
                className={`h-[18px] w-[18px] ${isActive ? "drop-shadow-[0_0_6px_hsl(var(--primary))]" : ""}`}
              />
              <span className="font-heading text-[8px] uppercase leading-none tracking-wide sm:text-[9px] sm:tracking-wider">
                {section.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
