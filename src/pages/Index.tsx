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

  const TAB_HEADINGS: Record<TabId, string> = {
    agents: "Agentes AI Tor — chat multi-oráculo y workflows",
    alien: "Monitor UAP — anomalías y cámaras en directo",
    cosmos: "Cosmos — sistema solar y objetos cercanos",
    globe: "Globo táctico — capas OSINT y meteorología en tiempo real",
    markets: "Mercados — cripto, predicción y señales",
    system: "Sistema — perfil, gobernanza y ajustes",
  };

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
        <title>Ai Tor — Real-Time Intelligence Terminal</title>
        <meta name="description" content="Multi-oracle AI intelligence hub for real-time OSINT, global monitoring, blockchain analytics, and decentralized research. Powered by ΔlieπFlΦw DAO." />
        <link rel="canonical" href="https://aitor.lovable.app/" />
        <meta property="og:title" content="Ai Tor — Real-Time Intelligence Terminal" />
        <meta property="og:description" content="Multi-oracle AI intelligence hub for real-time OSINT, global monitoring, blockchain analytics, and decentralized research. Powered by ΔlieπFlΦw DAO." />
        <meta property="og:url" content="https://aitor.lovable.app/" />
        <meta name="twitter:title" content="Ai Tor — Real-Time Intelligence Terminal" />
        <meta name="twitter:description" content="Multi-oracle AI intelligence hub for real-time OSINT, global monitoring, blockchain analytics, and decentralized research. Powered by ΔlieπFlΦw DAO." />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Ai Tor",
            url: "https://aitor.lovable.app/",
            description:
              "Multi-oracle AI intelligence hub for real-time OSINT, global monitoring, blockchain analytics, and decentralized research.",
          })}
        </script>
      </Helmet>

      <SpaceBackground />

      <div className="fixed inset-0 flex flex-col w-full max-w-[100vw] overflow-hidden z-10">
        <TopNavBar activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="flex-1 flex flex-col min-h-0 pb-14 md:pb-0 overflow-hidden">
          {activeTab !== "agents" && (
            <h1 className="sr-only">{TAB_HEADINGS[activeTab]}</h1>
          )}
          {renderTab()}
        </main>
      </div>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </>
  );
};

export default Index;
