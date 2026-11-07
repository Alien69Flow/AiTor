import { useCallback, useEffect, useRef, useState } from "react";
import { Cable, CheckCircle2, Circle, Loader2, RefreshCw, XCircle } from "lucide-react";
import { SKILLS, type SkillId } from "@/lib/ai-skills";
import {
  mcpSummary,
  mcpToolRows,
  modelKeyRow,
  SKILL_PROBE_TEXT,
  summarize,
  type ConnectionRow,
  type ConnectionState,
} from "@/lib/connections";
import { MCP_TOOLS } from "@/lib/mcp";
import { runSkills } from "@/services/skills-runner";
import { cn } from "@/lib/utils";

/**
 * Panel de conexiones.
 *
 * Enseña lo que AI Tor puede consultar **ahora**: las herramientas MCP que el
 * despliegue publica y las skills que responden, con la latencia de la última
 * llamada real. No hay interruptores que finjan estado: una fila verde es una
 * respuesta que se acaba de recibir.
 *
 * Las skills se prueban a petición porque cada sonda gasta cuota de las Edge
 * Functions; el estado de `/api/mcp` sí se consulta al abrir.
 */

const MCP_URL = (import.meta.env.VITE_MCP_ENDPOINT as string) || "/api/mcp";

interface McpState {
  payload: { tools?: number; toolNames?: string[]; geminiKeyState?: string } | null;
  ms: number | null;
  error: string | null;
  loading: boolean;
}

interface SkillProbe {
  state: ConnectionState;
  ms?: number;
  error?: string;
}

const ESTADO_ESTILO: Record<ConnectionState, string> = {
  ok: "text-emerald-400",
  fail: "text-rose-400",
  idle: "text-muted-foreground/50",
};

function EstadoIcon({ state, loading }: { state: ConnectionState; loading?: boolean }) {
  if (loading) return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/70" aria-hidden="true" />;
  if (state === "ok") return <CheckCircle2 className={cn("h-3 w-3", ESTADO_ESTILO.ok)} aria-hidden="true" />;
  if (state === "fail") return <XCircle className={cn("h-3 w-3", ESTADO_ESTILO.fail)} aria-hidden="true" />;
  return <Circle className={cn("h-3 w-3", ESTADO_ESTILO.idle)} aria-hidden="true" />;
}

function Row({
  title,
  detail,
  state,
  ms,
  error,
  loading,
}: ConnectionRow & { loading?: boolean }) {
  return (
    <li className="flex items-start gap-2 border-t border-border/40 px-3 py-2 first:border-t-0">
      <span className="mt-1 shrink-0">
        <EstadoIcon state={state} loading={loading} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-mono text-[11px] text-foreground/90">{title}</span>
          {ms !== undefined && (
            <span className="ml-auto shrink-0 font-mono text-[9px] tabular-nums text-muted-foreground/60">
              {ms} ms
            </span>
          )}
        </div>
        <p className="truncate font-mono text-[9px] leading-relaxed text-muted-foreground/60" title={detail}>
          {error ?? detail}
        </p>
      </div>
    </li>
  );
}

export function ConnectionsPanel() {
  const [mcp, setMcp] = useState<McpState>({
    payload: null,
    ms: null,
    error: null,
    loading: true,
  });
  const [skills, setSkills] = useState<Partial<Record<SkillId, SkillProbe>>>({});
  const [probing, setProbing] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const checkMcp = useCallback(async () => {
    setMcp((current) => ({ ...current, loading: true }));
    const started = performance.now();
    try {
      const response = await fetch(MCP_URL, { headers: { accept: "application/json" } });
      const ms = Math.round(performance.now() - started);
      if (!response.ok) throw new Error(`/api/mcp respondió ${response.status}`);
      // En `vite dev` no hay funciones: el SPA devuelve el index y `json()`
      // reventaría con un error de parseo que no explica nada.
      if (!/json/i.test(response.headers.get("content-type") || "")) {
        throw new Error("este entorno no sirve /api/mcp (mira el despliegue)");
      }
      const payload = (await response.json()) as McpState["payload"];
      if (mounted.current) setMcp({ payload, ms, error: null, loading: false });
    } catch (error) {
      if (!mounted.current) return;
      setMcp({
        payload: null,
        ms: null,
        error: error instanceof Error ? error.message : "no se pudo comprobar",
        loading: false,
      });
    }
  }, []);

  useEffect(() => {
    void checkMcp();
  }, [checkMcp]);

  /**
   * Prueba cada skill con su texto de sonda. Se hace en serie a propósito: en
   * paralelo, seis funciones a la vez falsean la latencia que se enseña.
   */
  const probeSkills = useCallback(async () => {
    setProbing(true);
    for (const skill of SKILLS) {
      const started = performance.now();
      try {
        const [result] = await runSkills([skill.id], SKILL_PROBE_TEXT[skill.id]);
        const ms = Math.round(performance.now() - started);
        if (!mounted.current) return;
        setSkills((current) => ({
          ...current,
          [skill.id]: result?.ok
            ? { state: "ok", ms }
            : { state: "fail", ms, error: result?.error ?? "sin respuesta" },
        }));
      } catch (error) {
        if (!mounted.current) return;
        setSkills((current) => ({
          ...current,
          [skill.id]: {
            state: "fail",
            error: error instanceof Error ? error.message : "falló la llamada",
          },
        }));
      }
    }
    if (mounted.current) setProbing(false);
  }, []);

  // `McpTool` envuelve la definición: el panel trabaja con ella, no con `run`.
  // La clave del modelo entra en la decisión: `media.*` está publicada pero no
  // puede ejecutarse sin ella, y eso es lo que el panel tiene que decir.
  const tools = mcpToolRows(
    MCP_TOOLS.map((tool) => tool.definition),
    mcp.payload?.toolNames ?? null,
    mcp.payload?.geminiKeyState ?? "unknown",
  ).map((row) => ({
    ...row,
    loading: mcp.loading,
    state: mcp.loading ? ("idle" as const) : row.state,
    error: mcp.error && !mcp.loading ? mcp.error : row.error,
  }));

  const skillRows: ConnectionRow[] = SKILLS.map((skill) => {
    const probe = skills[skill.id];
    return {
      id: skill.id,
      title: skill.label,
      detail: skill.gives,
      state: probe?.state ?? "idle",
      ms: probe?.ms,
      error: probe?.error,
    };
  });

  const resumen = mcpSummary(mcp.loading ? null : mcp.payload, mcp.ms);
  // La clave va como fila propia: es la razón por la que la imagen y el audio
  // no aparecen, y estaba escondida en el resumen de la cabecera.
  const keyRow = modelKeyRow(mcp.loading ? null : mcp.payload, mcp.ms);
  const conteo = summarize([keyRow, ...tools, ...skillRows]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/60 px-3 py-2">
        <Cable className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-foreground/90">Conexiones</h2>
        <span className="font-mono text-[9px] text-muted-foreground/70">
          {conteo.ok} responden · {conteo.fail} con fallo · {conteo.idle} sin probar
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void checkMcp()}
            disabled={mcp.loading}
            className="flex items-center gap-1 rounded border border-border/60 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={cn("h-2.5 w-2.5", mcp.loading && "animate-spin")} aria-hidden="true" />
            MCP
          </button>
          <button
            type="button"
            onClick={() => void probeSkills()}
            disabled={probing}
            className="flex items-center gap-1 rounded border border-secondary/40 bg-secondary/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-secondary transition-colors hover:bg-secondary/20 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-2.5 w-2.5", probing && "animate-spin")} aria-hidden="true" />
            Probar skills
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <section aria-label="Herramientas MCP">
          <div className="flex items-baseline gap-2 bg-muted/20 px-3 py-1.5">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
              Herramientas MCP
            </h3>
            <span className={cn("font-mono text-[9px]", ESTADO_ESTILO[resumen.state])}>{resumen.detail}</span>
          </div>
          <ul>
            <Row key={keyRow.id} {...keyRow} loading={mcp.loading} />
            {tools.map((row) => (
              <Row key={row.id} {...row} />
            ))}
          </ul>
        </section>

        <section aria-label="Skills" className="mt-2">
          <div className="flex items-baseline gap-2 bg-muted/20 px-3 py-1.5">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">Skills</h3>
            <span className="font-mono text-[9px] text-muted-foreground/60">
              {probing ? "probando…" : "pulsa «Probar skills» para medirlas"}
            </span>
          </div>
          <ul>
            {skillRows.map((row) => (
              <Row key={row.id} {...row} loading={probing && row.state === "idle"} />
            ))}
          </ul>
        </section>

        <p className="px-3 py-3 font-mono text-[9px] leading-relaxed text-muted-foreground/50">
          Cada fila es una llamada real: las skills se prueban contra su Edge Function con el texto de sonda
          de <span className="text-muted-foreground/70">connections.ts</span>, y las herramientas MCP contra lo
          que publica <span className="text-muted-foreground/70">/api/mcp</span> en este despliegue.
        </p>
      </div>
    </div>
  );
}
