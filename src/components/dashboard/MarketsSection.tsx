import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MarketsTab } from "./MarketsTab";
import { SignalsTab } from "./SignalsTab";
import { FeedTab } from "./FeedTab";
import { MoversTab } from "./MoversTab";
import { PortfolioTab } from "./PortfolioTab";
import { AlertsTab } from "./AlertsTab";
import { MonitorTab } from "./MonitorTab";

const SUB_TABS = [
  { id: "markets", label: "Markets" },
  { id: "signals", label: "Signals" },
  { id: "feed", label: "Feed" },
  { id: "movers", label: "Movers" },
  { id: "portfolio", label: "Portfolio" },
  { id: "alerts", label: "Alerts" },
  { id: "monitor", label: "Monitor" },
] as const;

export function MarketsSection() {
  return (
    <Tabs defaultValue="markets" className="flex flex-col h-full w-full">
      <div className="shrink-0 border-b border-border/30 bg-card/60 backdrop-blur-sm px-2 md:px-4">
        <TabsList className="bg-transparent h-9 gap-0 p-0 overflow-x-auto no-scrollbar">
          {SUB_TABS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="text-[10px] font-heading tracking-wider uppercase px-3 py-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none text-muted-foreground/60"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <TabsContent value="markets" className="mt-0 h-full"><MarketsTab /></TabsContent>
        <TabsContent value="signals" className="mt-0 h-full"><SignalsTab /></TabsContent>
        <TabsContent value="feed" className="mt-0 h-full"><FeedTab /></TabsContent>
        <TabsContent value="movers" className="mt-0 h-full"><MoversTab /></TabsContent>
        <TabsContent value="portfolio" className="mt-0 h-full"><PortfolioTab /></TabsContent>
        <TabsContent value="alerts" className="mt-0 h-full"><AlertsTab /></TabsContent>
        <TabsContent value="monitor" className="mt-0 h-full"><MonitorTab /></TabsContent>
      </div>
    </Tabs>
  );
}
