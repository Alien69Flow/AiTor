import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Copy,
  History,
  Send,
  Terminal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DAOS, PRODUCTS, REPO, buildIssueUrl } from "@/lib/ecosystem";

/**
 * Sovereign dispatch: an order typed here becomes a real, addressable agent task
 * in the repository — no backend secret, no third-party builder. The console
 * also keeps the last orders locally so the operator can replay them.
 */

const HISTORY_KEY = "aitor.commands.v1";
const MAX_HISTORY = 8;

type Priority = "normal" | "alta" | "critica";

interface Dispatch {
  id: string;
  order: string;
  targetId: string;
  targetName: string;
  priority: Priority;
  createdAt: number;
}

const PRIORITIES: { id: Priority; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "alta", label: "Alta" },
  { id: "critica", label: "Crítica" },
];

function readHistory(): Dispatch[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Dispatch => {
      const value = item as Partial<Dispatch>;
      return typeof value?.order === "string" && typeof value?.targetId === "string";
    });
  } catch {
    return [];
  }
}

function writeHistory(items: Dispatch[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
  } catch {
    /* private mode / quota — the dispatch still works, history is best effort */
  }
}

function buildDispatchBody(order: string, targetName: string, targetUrl: string, priority: Priority) {
  return [
    `## Orden soberana · ΔlieπFlΦw $pac€ DAO`,
    "",
    `**Objetivo:** ${targetName}`,
    `**Endpoint:** ${targetUrl}`,
    `**Prioridad:** ${priority}`,
    `**Emitida desde:** Ai Tor · Centro de Control`,
    `**Fecha:** ${new Date().toISOString()}`,
    "",
    "### Instrucción",
    "",
    order.trim(),
    "",
    "### Criterios de aceptación",
    "",
    "- [ ] El cambio está implementado y desplegado en el objetivo indicado.",
    "- [ ] `tsc`, `eslint` y `build` pasan sin errores nuevos.",
    "- [ ] La interfaz se ha verificado en el navegador, no solo en el build.",
    "",
    "---",
    `Repositorio del operador: ${REPO.url}`,
  ].join("\n");
}

export function CommandConsole() {
  const targets = useMemo(
    () => [
      ...PRODUCTS.map((product) => ({ id: product.id, name: product.name, url: product.url })),
      ...DAOS.map((dao) => ({ id: dao.id, name: `${dao.name} · Aragon`, url: dao.aragonUrl })),
    ],
    [],
  );

  const [targetId, setTargetId] = useState(targets[0]?.id ?? "aitor");
  const [priority, setPriority] = useState<Priority>("normal");
  const [order, setOrder] = useState("");
  const [history, setHistory] = useState<Dispatch[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setHistory(readHistory());
  }, []);

  const target = targets.find((item) => item.id === targetId) ?? targets[0];
  const canDispatch = order.trim().length >= 8;

  const remember = () => {
    const entry: Dispatch = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      order: order.trim(),
      targetId: target.id,
      targetName: target.name,
      priority,
      createdAt: Date.now(),
    };
    const next = [entry, ...history].slice(0, MAX_HISTORY);
    setHistory(next);
    writeHistory(next);
  };

  const dispatch = () => {
    if (!canDispatch) {
      toast.error("Describe la orden con al menos 8 caracteres.");
      return;
    }
    const body = buildDispatchBody(order, target.name, target.url, priority);
    const title = `[Agente] ${target.name}: ${order.trim().split("\n")[0].slice(0, 80)}`;
    remember();
    window.open(buildIssueUrl(title, body), "_blank", "noopener,noreferrer");
    toast.success("Tarea abierta en GitHub. Envía el issue para encolarla.");
  };

  const copy = async () => {
    if (!canDispatch) return;
    const body = buildDispatchBody(order, target.name, target.url, priority);
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      toast.success("Despacho copiado: pégalo en el agente que elijas.");
    } catch {
      toast.error("El navegador bloqueó el portapapeles.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/35 bg-card/45 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" />
          <p className="font-heading text-[11px] uppercase tracking-widest text-foreground/85">
            Consola de mando
          </p>
          <span className="ml-auto font-mono text-[9px] text-muted-foreground/50">
            sin claves · ruta GitHub
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
              Objetivo
            </span>
            <select
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              className="h-9 w-full rounded-md border border-border/40 bg-muted/20 px-2 text-[11px] text-foreground outline-none focus:border-primary/50"
            >
              {targets.map((item) => (
                <option key={item.id} value={item.id} className="bg-background">
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
              Prioridad
            </span>
            <div className="flex gap-1">
              {PRIORITIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPriority(item.id)}
                  className={`h-9 flex-1 rounded-md border text-[10px] uppercase tracking-wider transition-colors ${
                    priority === item.id
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border/40 bg-muted/10 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </label>
        </div>

        <Textarea
          value={order}
          onChange={(event) => setOrder(event.target.value)}
          rows={3}
          placeholder="Ej: añade a la tesorería DAO el saldo de ACE y enlaza la propuesta de Aragon…"
          className="mt-2 resize-none border-border/40 bg-muted/15 text-[11px] leading-relaxed"
        />

        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={dispatch}
            disabled={!canDispatch}
            className="h-8 bg-primary/90 text-[10px] uppercase tracking-wider text-primary-foreground hover:bg-primary"
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Abrir tarea de agente
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={copy}
            disabled={!canDispatch}
            className="h-8 border-border/50 text-[10px] uppercase tracking-wider"
          >
            {copied ? <Check className="mr-1.5 h-3.5 w-3.5 text-primary" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
            Copiar despacho
          </Button>
          <a
            href={`${REPO.url}/issues?q=is%3Aissue+label%3Aagent-task`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/50 px-3 text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-primary"
          >
            Cola de agentes
            <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>

        <p className="mt-2 font-mono text-[9px] leading-relaxed text-muted-foreground/45">
          La orden se empaqueta como issue etiquetado <span className="text-primary/70">agent-task</span> en{" "}
          {REPO.owner}/{REPO.name}. Envía el issue con tu sesión de GitHub: cualquier agente de código puede
          tomarlo desde ahí.
        </p>
      </div>

      {history.length > 0 && (
        <div className="rounded-xl border border-border/30 bg-card/30 p-3">
          <div className="mb-2 flex items-center gap-2">
            <History className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="font-heading text-[10px] uppercase tracking-widest text-muted-foreground/60">
              Despachos recientes
            </span>
            <button
              type="button"
              onClick={() => {
                setHistory([]);
                writeHistory([]);
              }}
              className="ml-auto inline-flex items-center gap-1 font-mono text-[9px] text-muted-foreground/45 transition-colors hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" /> limpiar
            </button>
          </div>
          <ul className="space-y-1">
            {history.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOrder(entry.order);
                    setTargetId(entry.targetId);
                    setPriority(entry.priority);
                  }}
                  className="flex w-full items-baseline gap-2 rounded-md border border-transparent px-1.5 py-1 text-left transition-colors hover:border-border/40 hover:bg-muted/15"
                >
                  <span className="shrink-0 font-mono text-[8px] uppercase text-muted-foreground/40">
                    {new Date(entry.createdAt).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[10px] text-foreground/70">{entry.order}</span>
                  <span className="shrink-0 font-mono text-[8px] text-primary/50">{entry.targetName}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
