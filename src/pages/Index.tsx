import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { TopNavBar } from "@/components/dashboard/TopNavBar";
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

      <div className="fixed inset-0 flex flex-col w-full max-w-[100vw] overflow-hidden z-10">
        <TopNavBar activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="flex-1 flex flex-col min-h-0 pb-14 md:pb-0 overflow-hidden">
          {renderTab()}
        </main>
      </div>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </>
  );
};

export default Index;
