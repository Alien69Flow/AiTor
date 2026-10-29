import { useCallback, useEffect, useRef, useState } from "react";
import { Wrench, X, Loader2, Lock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { callSessionTool, getSessionTier, listSessionTools } from "@/services/mcpClient";
import type { McpToolDefinition, McpTier } from "@/lib/mcp";

/**
 * Botón de herramientas del chat.
 *
 * Lista lo que el plan **real** de la cuenta puede ejecutar —el filtrado lo
 * hace el servidor MCP con `profiles.tier`, no esta interfaz— y ejecuta una con
 * sus argumentos por defecto. El resultado se enseña en crudo porque es
 * telemetría: el operador quiere ver la fuente y la hora, no un resumen.
 *
 * Nunca lleva clave del modelo: la conversación con Gemini va por el endpoint
 * del servidor (`askAgent`), no por aquí.
 */

const DEFAULT_ARGS: Record<string, Record<string, unknown>> = {
  "telemetry.satellites": { group: "stations", limit: 5 },
  "osint.events": { timespan: "24h", limit: 5 },
  "db.select": { table: "profiles", limit: 1 },
};

const TIER_LABEL: Record<McpTier, string> = { free: "Free", pro: "Pro", dao: "DAO" };

export function McpToolsButton() {
  const [open, setOpen] = useState(false);
  const [tools, setTools] = useState<McpToolDefinition[] | null>(null);
  const [tier, setTier] = useState<McpTier>("free");
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [output, setOutput] = useState<{ name: string; text: string; error: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [available, plan] = await Promise.all([listSessionTools(), getSessionTier()]);
      setTools(available);
      setTier(plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las herramientas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && tools === null && !loading) void load();
  }, [open, tools, loading, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const run = async (name: string) => {
    setRunning(name);
    setError(null);
    setOutput(null);
    try {
      const result = await callSessionTool(name, DEFAULT_ARGS[name] ?? {});
      const text = result.content.map((part) => part.text).join("\n");
      setOutput({ name, text, error: result.isError === true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "La herramienta falló");
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((value) => !value)}
        aria-label="Herramientas MCP"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Herramientas MCP"
        className={`h-8 w-8 ${open ? "text-primary" : "text-muted-foreground/40 hover:text-primary"}`}
      >
        <Wrench className="h-3.5 w-3.5" />
      </Button>

      {open && (
        <>
          {/* Cierra al tocar fuera sin robar el foco del panel. */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Herramientas MCP"
            className="absolute right-0 top-9 z-50 w-[min(380px,calc(100vw-16px))] rounded-sm border border-border/60 bg-card/95 p-3 shadow-lg backdrop-blur-md"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                  Herramientas MCP
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="border border-border/60 px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-muted-foreground">
                  {TIER_LABEL[tier]}
                </span>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Cerrar herramientas" className="h-6 w-6">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {loading && (
              <div className="flex items-center gap-2 py-3 text-[10px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Consultando tu plan…
              </div>
            )}

            {error && <p className="py-2 text-[10px] text-destructive">{error}</p>}

            {tools && (
              <ul className="space-y-1">
                {tools.map((tool) => (
                  <li key={tool.name} className="border border-border/40 bg-muted/10 p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[10px] font-semibold text-foreground">{tool.title}</div>
                        <div className="truncate text-[8px] font-mono text-muted-foreground">{tool.name}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void run(tool.name)}
                        disabled={running !== null}
                        aria-label={`Ejecutar ${tool.title}`}
                        title="Ejecutar con valores por defecto"
                        className="h-6 w-6 shrink-0 text-primary"
                      >
                        {running === tool.name ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                      </Button>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[9px] leading-relaxed text-muted-foreground/80">
                      {tool.description}
                    </p>
                    {tool.minTier && tool.minTier !== "free" && (
                      <div className="mt-1 flex items-center gap-1 text-[8px] uppercase tracking-wider text-amber-400/80">
                        <Lock className="h-2.5 w-2.5" /> {TIER_LABEL[tool.minTier]}
                      </div>
                    )}
                  </li>
                ))}
                {tools.length === 0 && (
                  <li className="py-2 text-[10px] text-muted-foreground">Tu plan no expone herramientas.</li>
                )}
              </ul>
            )}

            {output && (
              <div className={`mt-2 border p-2 ${output.error ? "border-destructive/40 bg-destructive/5" : "border-border/40 bg-muted/10"}`}>
                <div className="mb-1 text-[8px] uppercase tracking-wider text-muted-foreground">
                  {output.name} {output.error ? "· error" : "· resultado"}
                </div>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-[8px] leading-relaxed text-foreground/80">
                  {output.text.slice(0, 1200)}
                  {output.text.length > 1200 ? "\n…" : ""}
                </pre>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
