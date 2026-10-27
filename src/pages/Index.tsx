import { lazy, Suspense, useState } from "react";
import { Helmet } from "react-helmet-async";
import { TopNavBar } from "@/components/dashboard/TopNavBar";
import { BottomNav } from "@/components/dashboard/BottomNav";
import { SpaceBackground } from "@/components/SpaceBackground";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { ChatDock } from "@/components/chat/ChatDock";
import { CommandPalette } from "@/components/dashboard/CommandPalette";
import { OfflineNotice } from "@/components/dashboard/OfflineNotice";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useCameraTarget, useWorkspaceTab, type TabId } from "@/hooks/useWorkspaceTab";

// Every workspace except the default chat is loaded on first visit, so the
// globe (three.js) and the markets connectors stay out of the initial bundle.
const UFOMonitorTab = lazy(() =>
  import("@/components/dashboard/UFOMonitorTab").then((m) => ({ default: m.UFOMonitorTab })),
);
const SolarSystemTab = lazy(() =>
  import("@/components/dashboard/SolarSystemTab").then((m) => ({ default: m.SolarSystemTab })),
);
const GlobeDashboard = lazy(() =>
  import("@/components/dashboard/GlobeDashboard").then((m) => ({ default: m.GlobeDashboard })),
);
const MarketsSection = lazy(() =>
  import("@/components/dashboard/MarketsSection").then((m) => ({ default: m.MarketsSection })),
);
const SystemTab = lazy(() =>
  import("@/components/dashboard/SystemTab").then((m) => ({ default: m.SystemTab })),
);

function WorkspaceFallback() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center gap-2 text-muted-foreground">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/70 border-t-transparent" />
      <span className="font-mono text-[10px] uppercase tracking-widest">Cargando módulo…</span>
    </div>
  );
}

// Re-exported so the navigation components keep importing the type from here.
export type { TabId };

const TAB_LABELS: Record<TabId, string> = {
  agents: "Agentes",
  alien: "UAP",
  cosmos: "Cosmos",
  globe: "Globo",
  markets: "Mercados",
  system: "Sistema",
};

const Index = () => {
  // Mirrored into ?tab= so refresh, deep links and back/forward keep the module.
  const [activeTab, setActiveTab, openCamera] = useWorkspaceTab();
  // Cámara apuntada desde el globo, si la hay: se pasa al monitor UAP, que la
  // abre con su categoría en vez de arrancar sin selección.
  const cameraTarget = useCameraTarget();
  const [paletteOpen, setPaletteOpen] = useState(false);

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
      case "agents": return <ChatContainer onOpenTab={setActiveTab} />;
      case "alien": return <UFOMonitorTab cameraRequest={cameraTarget} />;
      case "cosmos": return <SolarSystemTab />;
      case "globe": return <GlobeDashboard onOpenCamera={openCamera} />;
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
        <link rel="canonical" href="https://aitor.alienflow.space/" />
        <meta property="og:title" content="Ai Tor — Real-Time Intelligence Terminal" />
        <meta property="og:description" content="Multi-oracle AI intelligence hub for real-time OSINT, global monitoring, blockchain analytics, and decentralized research. Powered by ΔlieπFlΦw DAO." />
        <meta property="og:url" content="https://aitor.alienflow.space/" />
        <meta name="twitter:title" content="Ai Tor — Real-Time Intelligence Terminal" />
        <meta name="twitter:description" content="Multi-oracle AI intelligence hub for real-time OSINT, global monitoring, blockchain analytics, and decentralized research. Powered by ΔlieπFlΦw DAO." />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Ai Tor",
            url: "https://aitor.alienflow.space/",
            description:
              "Multi-oracle AI intelligence hub for real-time OSINT, global monitoring, blockchain analytics, and decentralized research.",
          })}
        </script>
      </Helmet>

      <SpaceBackground />

      <a
        href="#workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[70] focus:rounded-md focus:border focus:border-primary/50 focus:bg-card focus:px-3 focus:py-2 focus:font-mono focus:text-[11px] focus:text-primary"
      >
        Saltar al contenido
      </a>

      <div className="fixed inset-0 flex flex-col w-full max-w-[100vw] overflow-hidden z-10">
        <TopNavBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onOpenPalette={() => setPaletteOpen(true)}
        />
        <main
          id="workspace"
          className="flex min-h-0 flex-1 flex-col overflow-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0"
        >
          {activeTab !== "agents" && (
            <h1 className="sr-only">{TAB_HEADINGS[activeTab]}</h1>
          )}
          <ErrorBoundary variant="inline" label={TAB_LABELS[activeTab]} resetKey={activeTab}>
            <Suspense fallback={<WorkspaceFallback />}>{renderTab()}</Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {/* The full workspace owns the conversation on its own tab; everywhere else
          the floating dock keeps the same thread one tap away. */}
      {activeTab !== "agents" && <ChatDock onOpenAgents={() => setActiveTab("agents")} />}

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <OfflineNotice />

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </>
  );
};

export default Index;
