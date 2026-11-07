import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MarketsTab } from "./MarketsTab";
import { PredictionsTab } from "./PredictionsTab";
import { SignalsTab } from "./SignalsTab";
import { FeedTab } from "./FeedTab";
import { MoversTab } from "./MoversTab";
import { PortfolioTab } from "./PortfolioTab";
import { AlertsTab } from "./AlertsTab";
import { MonitorTab } from "./MonitorTab";

/** Orden alfabético por etiqueta (decisión del operador: Alerts, Signals…). */
const SUB_TABS = [
  { id: "alerts", label: "Alerts" },
  { id: "feed", label: "Feed" },
  { id: "markets", label: "Markets" },
  { id: "monitor", label: "Monitor" },
  { id: "movers", label: "Movers" },
  { id: "portfolio", label: "Portfolio" },
  { id: "predictions", label: "Predictions" },
  { id: "signals", label: "Signals" },
] as const;

export function MarketsSection() {
  return (
    <Tabs defaultValue="markets" className="flex h-full min-h-0 w-full flex-col">
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

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <TabsContent value="markets" className="mt-0 h-full"><MarketsTab /></TabsContent>
        <TabsContent value="predictions" className="mt-0 h-full"><PredictionsTab /></TabsContent>
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
