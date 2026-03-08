import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { TopNavBar, TabId } from "@/components/dashboard/TopNavBar";
import { GlobeDashboard } from "@/components/dashboard/GlobeDashboard";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { SpaceBackground } from "@/components/SpaceBackground";
import { SolarSystemTab } from "@/components/dashboard/SolarSystemTab";
import { UFOMonitorTab } from "@/components/dashboard/UFOMonitorTab";
import { FeedTab } from "@/components/dashboard/FeedTab";
import { MoversTab } from "@/components/dashboard/MoversTab";
import { PortfolioTab } from "@/components/dashboard/PortfolioTab";
import { AlertsTab } from "@/components/dashboard/AlertsTab";
import { MonitorTab } from "@/components/dashboard/MonitorTab";

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>("terminal");

  const renderTab = () => {
    switch (activeTab) {
      case "terminal":
        return (
          <div className="flex-1 flex items-center justify-center p-2 sm:p-4">
            <div className="w-full max-w-6xl h-[calc(100vh-100px)]">
              <ChatContainer />
            </div>
          </div>
        );
      case "markets":
        return <GlobeDashboard />;
      case "feed":
        return <FeedTab />;
      case "movers":
        return <MoversTab />;
      case "portfolio":
        return <PortfolioTab />;
      case "alerts":
        return <AlertsTab />;
      case "monitor":
        return <MonitorTab />;
      case "ufo":
        return <UFOMonitorTab />;
      case "solar":
        return <SolarSystemTab />;
      default:
        return null;
    }
  };

  return (
    <>
      <Helmet>
        <title>ΔlieπFlΦw — AI Terminal & Real-Time Intelligence</title>
        <meta name="description" content="Real-time AI intelligence terminal with multi-oracle chat, global monitoring, and blockchain analytics. Powered by ΔlieπFlΦw DAO." />
      </Helmet>
      
      <SpaceBackground />
      
      <div className="fixed inset-0 flex flex-col z-10">
        <TopNavBar activeTab={activeTab} onTabChange={setActiveTab} />
        
        <div className="flex-1 flex flex-col min-h-0 relative">
          {renderTab()}
        </div>
      </div>
    </>
  );
};

export default Index;
