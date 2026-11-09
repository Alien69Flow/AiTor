import { useState } from "react";
import { ExternalLink, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BROADCAST_HUBS } from "@/lib/broadcast-hubs";

const CATEGORIES = ["Noticias", "Finanzas", "Deportes", "Gaming / Esports"] as const;
export function BroadcastDirectory() {
  const [category, setCategory] = useState<string>("Noticias");
  return <section aria-label="Emisiones oficiales" className="space-y-3">
    <h3 className="flex items-center gap-2 font-heading text-xs text-primary"><Radio className="h-4 w-4" /> Emisiones oficiales</h3>
    <div className="flex flex-wrap gap-1" role="group" aria-label="Categorías de emisión">
      {CATEGORIES.map(item => <Button key={item} variant="ghost" size="sm" onClick={() => setCategory(item)} aria-pressed={category === item} className={`h-8 text-[10px] ${category === item ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>{item}</Button>)}
    </div>
    <div className="grid gap-2 sm:grid-cols-2">
      {BROADCAST_HUBS.filter(hub => hub.category === category).map(hub => <Button key={hub.id} asChild variant="outline" className="h-auto min-h-16 justify-between rounded-sm px-3 py-2 text-left">
        <a href={hub.url} target="_blank" rel="noopener noreferrer"><span className="min-w-0 whitespace-normal"><span className="block text-xs">{hub.name}</span><span className="mt-1 block text-[9px] text-muted-foreground">{hub.availability}</span></span><ExternalLink className="h-3.5 w-3.5 shrink-0" /></a>
      </Button>)}
    </div>
  </section>;
}