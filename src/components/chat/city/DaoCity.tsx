import { lazy, Suspense, useRef, useState } from "react";
import { Building2, Compass, Pause, Play, Send, X, Bot, ArrowUpRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CITY_DISTRICTS } from "./districts";
import type { Message } from "@/hooks/useChat";
import ReactMarkdown from "react-markdown";

const CityScene = lazy(() => import("./CityScene"));
interface DaoCityProps { messages: Message[]; isLoading: boolean; onSend: (prompt: string) => Promise<void>; onChat: () => void }

export function DaoCity({ messages, isLoading, onSend, onChat }: DaoCityProps) {
  const [selected, setSelected] = useState("nexus");
  const [moving, setMoving] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [reset, setReset] = useState(0);
  const [panelOpen, setPanelOpen] = useState(true);
  const [objective, setObjective] = useState("");
  const [mission, setMission] = useState<{ baseline: number; agent: string } | null>(null);
  const busy = useRef(false);
  const district = CITY_DISTRICTS.find(d => d.id === selected) ?? CITY_DISTRICTS[0];
  const results = mission ? messages.slice(mission.baseline).filter(m => m.role === "assistant") : [];
  const response = results[results.length - 1];
  const choose = (id: string) => { setSelected(id); setPanelOpen(true); };
  const submit = async () => {
    if (!objective.trim() || busy.current || isLoading) return;
    busy.current = true;
    setMission({ baseline: messages.length, agent: district.agent });
    try { await onSend(district.prompt + objective.trim()); } finally { busy.current = false; }
  };

  return <section className="dao-city relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground" aria-label="AlienFlow.Space DAO City">
    <div className="absolute inset-0">
      <Suspense fallback={<div className="flex h-full items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Materializando DAO City</div>}>
        <CityScene selected={selected} onSelect={choose} moving={moving} reset={reset} />
      </Suspense>
    </div>
    <div className="pointer-events-none relative z-10 flex items-start justify-between gap-2 p-3 sm:p-5">
      <div className="min-w-0">
        <p className="mb-1 font-mono text-[9px] text-secondary">ΔlieπFlΦw · SOVEREIGN INTELLIGENCE</p>
        <h1 className="text-base font-heading sm:text-xl">AlienFlow.Space <span className="text-secondary">DAO City</span></h1>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">6 distritos · AI Tor / coordinación</p>
      </div>
      <div className="pointer-events-auto flex shrink-0 gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8 bg-background/80" title="Restablecer cámara" aria-label="Restablecer cámara" onClick={() => setReset(v => v + 1)}><Compass className="h-4 w-4" /></Button>
        <Button variant="outline" size="icon" className="h-8 w-8 bg-background/80" title={moving ? "Pausar animación" : "Reanudar animación"} aria-label={moving ? "Pausar animación" : "Reanudar animación"} onClick={() => setMoving(v => !v)}>{moving ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}</Button>
      </div>
    </div>
    <div className="pointer-events-none relative z-10 flex min-h-0 flex-1 items-end justify-end px-3 pb-2 sm:px-5 lg:items-center">
      {panelOpen ? <aside className="pointer-events-auto flex max-h-[min(65%,600px)] w-full flex-col border border-border/70 bg-background/90 backdrop-blur-xl sm:w-[320px] lg:max-h-[80%]" aria-label="Centro de misiones">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
          <span className="flex items-center gap-2 font-mono text-[10px] text-secondary"><Bot className="h-4 w-4" /> AI TOR / MISSION CONTROL</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Cerrar centro de misiones" onClick={() => setPanelOpen(false)}><X className="h-3.5 w-3.5" /></Button>
        </div>
        <div className="min-h-0 overflow-y-auto p-3">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div><p className="font-mono text-[9px] text-muted-foreground">DISTRITO / {district.name}</p><h2 className="mt-1 text-base text-secondary">{district.agent}</h2><p className="mt-1 text-xs text-muted-foreground">{district.role}</p></div>
            <Building2 className="mt-1 h-6 w-6 text-primary" />
          </div>
          <form onSubmit={e => { e.preventDefault(); void submit(); }}>
            <label htmlFor="city-objective" className="font-mono text-[10px] text-muted-foreground">Objetivo de la misión</label>
            <textarea id="city-objective" value={objective} onChange={e => setObjective(e.target.value)} maxLength={6000} rows={3} placeholder={district.id === "academy" ? "Especialidad y conocimientos a evaluar…" : "¿Qué necesita la DAO?"} className="mt-2 w-full resize-none rounded-sm border border-border bg-card/60 p-2 text-xs leading-5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            <Button type="submit" disabled={!objective.trim() || isLoading} className="mt-2 h-8 w-full text-xs">{isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}{district.action}</Button>
          </form>
          {mission && <div className="mt-4 border-t border-border pt-3" aria-live="polite">
            <div className="mb-2 flex items-center justify-between font-mono text-[9px]"><span>{mission.agent} / AI Tor</span><span className="text-secondary">{isLoading ? "PROCESANDO" : response?.content ? "RESULTADO" : "SIN RESPUESTA"}</span></div>
            {response?.content ? <div className="space-y-2 break-words text-xs leading-5 text-foreground [&_p]:mb-2 [&_ul]:list-inside [&_ul]:list-disc [&_pre]:overflow-x-auto"><ReactMarkdown>{response.content}</ReactMarkdown></div> : <p className="text-xs text-muted-foreground">{isLoading ? "AI Tor está preparando el entregable…" : "No se recibió un resultado. Puedes volver a intentarlo."}</p>}
            <Button variant="ghost" size="sm" onClick={onChat} className="mt-2 h-7 w-full text-[10px] text-secondary">Abrir conversación completa <ArrowUpRight className="h-3 w-3" /></Button>
          </div>}
        </div>
      </aside> : <Button variant="outline" className="pointer-events-auto h-9 bg-background/90 text-xs" onClick={() => setPanelOpen(true)}><Bot className="h-4 w-4" /> AI Tor</Button>}
    </div>
    <nav className="relative z-10 flex shrink-0 gap-1 overflow-x-auto border-t border-border bg-background/85 px-3 py-2 backdrop-blur-xl" aria-label="Distritos DAO City">
      {CITY_DISTRICTS.map(d => <Button key={d.id} variant="ghost" size="sm" aria-pressed={selected === d.id} onClick={() => choose(d.id)} className={`h-8 shrink-0 rounded-sm px-2 font-mono text-[9px] ${selected === d.id ? "bg-secondary/10 text-secondary" : "text-muted-foreground"}`}>{d.name}</Button>)}
    </nav>
  </section>;
}