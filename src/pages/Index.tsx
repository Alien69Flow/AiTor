import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TopNavBar } from "@/components/dashboard/TopNavBar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { BottomNav } from "@/components/dashboard/BottomNav";
import { SpaceBackground } from "@/components/SpaceBackground";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { UFOMonitorTab } from "@/components/dashboard/UFOMonitorTab";
import { SolarSystemTab } from "@/components/dashboard/SolarSystemTab";
import { GlobeDashboard } from "@/components/dashboard/GlobeDashboard";
import { MarketsSection } from "@/components/dashboard/MarketsSection";
import { SystemTab } from "@/components/dashboard/SystemTab";

export type TabId = "agents" | "alien" | "cosmos" | "globe" | "markets" | "system";

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>("agents");

  const renderTab = () => {
    switch (activeTab) {
      case "agents": return <ChatContainer />;
      case "alien": return <UFOMonitorTab />;
      case "cosmos": return <SolarSystemTab />;
      case "globe": return <GlobeDashboard />;
      case "markets": return <MarketsSection />;
      case "system": return <SystemTab />;
      default: return null;
    }
  };

  return (
    <>
      <Helmet>
        <title>ΔlieπFlΦw — AI Terminal & Real-Time Intelligence</title>
        <meta name="description" content="Real-time AI intelligence terminal with multi-oracle chat, global monitoring, and blockchain analytics. Powered by ΔlieπFlΦw DAO." />
      </Helmet>

      <SpaceBackground />

      <SidebarProvider defaultOpen={false}>
        <div className="fixed inset-0 flex w-full max-w-[100vw] overflow-hidden z-10">
          {/* Desktop sidebar */}
          <div className="hidden md:flex">
            <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />
          </div>

          {/* Main content area */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <TopNavBar />
            <main className="flex-1 flex flex-col min-h-0 pb-14 md:pb-0">
              {renderTab()}
            </main>
          </div>
        </div>
      </SidebarProvider>

      {/* Mobile bottom nav */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </>
  );
};

export default Index;
