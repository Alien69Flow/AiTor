import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Info, RefreshCw, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { buildSignalBoard, type MarketEventLike } from "@/lib/market-signal-board";
import type { SignalSeverity } from "@/lib/market-signals";

/**
 * Señales del motor en la pestaña de Markets.
 *
 * `crypto-signals` (acción `polymarket`) devuelve profundidad y volumen de
 * 24 h, que son dos entradas reales de `analyzeMarket`. Lo que no llega —funding,
 * interés abierto, precio CEX— no se rellena: el motor calla esas ramas y el
 * panel lo dice al pie, en vez de enseñar señales que nadie ha medido.
 *
 * El orden lo pone `buildSignalBoard` (puntuación, gravedad, nombre); aquí sólo
 * se pinta.
 */

const SEVERITY_LABEL: Record<SignalSeverity, string> = {
  alert: "Alerta",
  watch: "Vigilar",
  info: "Info",
};

const SEVERITY_CLASS: Record<SignalSeverity, string> = {
  alert: "border-destructive/50 text-destructive bg-destructive/10",
  watch: "border-primary/50 text-primary bg-primary/10",
  info: "border-muted-foreground/30 text-muted-foreground bg-muted/20",
};

const SEVERITY_ICON: Record<SignalSeverity, typeof Info> = {
  alert: ShieldAlert,
  watch: AlertTriangle,
  info: Info,
};

export function MarketSignalsPanel() {
  const [events, setEvents] = useState<MarketEventLike[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("crypto-signals", {
        body: { action: "polymarket" },
      });
      if (error) throw error;
      const rows = (data as { polymarket?: unknown } | null)?.polymarket;
      setEvents(Array.isArray(rows) ? (rows as MarketEventLike[]) : []);
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron calcular las señales de mercado");
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const board = buildSignalBoard(events);

  return (
    <section className="mb-4 rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm">
      <header className="flex items-center justify-between gap-2 border-b border-border/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-heading uppercase tracking-wider text-primary">
            Señales del motor
          </h3>
          <Badge
            variant="outline"
            className="text-[7px] font-mono border-secondary/30 text-secondary bg-secondary/5"
          >
            {board.length} {board.length === 1 ? "mercado" : "mercados"}
          </Badge>
          <span className="hidden text-[9px] font-mono text-muted-foreground/50 sm:inline">
            Por urgencia
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
          className="h-7 text-[10px]"
        >
          <RefreshCw className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : ""}`} />
          Recalcular
        </Button>
      </header>

      <div className="space-y-2 p-2">
        {board.map((entry) => (
          <article
            key={entry.id}
            className="rounded-lg border border-border/30 bg-background/30 p-2"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[11px] font-bold text-foreground/90">{entry.label}</p>
              <span className="shrink-0 font-mono text-[9px] text-muted-foreground/60">
                riesgo {entry.score}
              </span>
            </div>
            <ul className="mt-1 space-y-1">
              {entry.signals.map((signal) => {
                const Icon = SEVERITY_ICON[signal.severity];
                return (
                  <li key={`${entry.id}-${signal.id}`} className="flex items-start gap-2">
                    <Badge
                      variant="outline"
                      className={`mt-0.5 shrink-0 px-1.5 py-0 text-[7px] font-mono ${SEVERITY_CLASS[signal.severity]}`}
                    >
                      <Icon className="mr-1 h-2.5 w-2.5" />
                      {SEVERITY_LABEL[signal.severity]}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-foreground/85">
                        {signal.title}
                      </p>
                      <p className="text-[9px] leading-snug text-muted-foreground/60">
                        {signal.detail}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}

        {!loaded && (
          <p className="px-1 py-3 text-center text-[10px] text-muted-foreground/50">
            Calculando señales…
          </p>
        )}

        {loaded && board.length === 0 && (
          <p className="px-1 py-3 text-center text-[10px] text-muted-foreground/50">
            Ningún mercado tiene hoy liquidez fina ni rotación alta. El motor calla lo que no
            puede saber: sin funding ni interés abierto no hay señal de apalancamiento.
          </p>
        )}
      </div>
    </section>
  );
}
