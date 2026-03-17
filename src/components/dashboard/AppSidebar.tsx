import { Bot, Radio, Orbit, Globe, BarChart3, Settings } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { TabId } from "@/pages/Index";

const SECTIONS: { id: TabId; label: string; icon: typeof Bot }[] = [
  { id: "agents", label: "Agents", icon: Bot },
  { id: "alien", label: "Alien", icon: Radio },
  { id: "cosmos", label: "Cosmos", icon: Orbit },
  { id: "globe", label: "Globe", icon: Globe },
  { id: "markets", label: "Markets", icon: BarChart3 },
  { id: "system", label: "System", icon: Settings },
];

interface AppSidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-border/30 bg-card/80 backdrop-blur-xl">
      <SidebarContent className="pt-2">
        <SidebarMenu>
          {SECTIONS.map((section) => {
            const isActive = activeTab === section.id;
            return (
              <SidebarMenuItem key={section.id}>
                <SidebarMenuButton
                  onClick={() => onTabChange(section.id)}
                  tooltip={section.label}
                  className={`cursor-pointer transition-all duration-200 ${
                    isActive
                      ? "bg-primary/15 text-primary border-l-2 border-primary"
                      : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/30"
                  }`}
                >
                  <section.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <span className="text-xs font-heading tracking-wider uppercase">
                      {section.label}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
