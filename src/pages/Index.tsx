import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { TopNavBar, TabId } from "@/components/dashboard/TopNavBar";
import { GlobeDashboard } from "@/components/dashboard/GlobeDashboard";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { ComingSoonTab } from "@/components/dashboard/ComingSoonTab";
import { SpaceBackground } from "@/components/SpaceBackground";

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
        return <ComingSoonTab title="Markets" />;
      case "feed":
        return <ComingSoonTab title="Feed" />;
      case "movers":
        return <ComingSoonTab title="Movers" />;
      case "portfolio":
        return <ComingSoonTab title="Portfolio" />;
      case "alerts":
        return <ComingSoonTab title="Alerts" />;
      case "monitor":
        return <ComingSoonTab title="Monitor" />;
      default:
        return <GlobeDashboard />;
    }
  };

  // Globe is default when no tab is "terminal"
  const showGlobe = activeTab !== "terminal";

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
          {activeTab === "terminal" ? (
            renderTab()
          ) : activeTab === "markets" || activeTab === "feed" || activeTab === "movers" || activeTab === "portfolio" || activeTab === "alerts" || activeTab === "monitor" ? (
            renderTab()
          ) : (
            <GlobeDashboard />
          )}
        </div>
      </div>
    </>
  );
};

export default Index;
