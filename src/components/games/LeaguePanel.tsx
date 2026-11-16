import type { ReactNode } from "react";
import { Trophy } from "lucide-react";
import { SEVERITY_CLASS, type Severity } from "@/lib/severity";
import { cn } from "@/lib/utils";

/** Las cinco salidas posibles de `GET /api/league` en `GamesTab`. */
export type LeagueStatus = "loading" | "ready" | "missing" | "anon" | "error";

/**
 * Estado del servidor → severidad.
 *
 * Se exporta para poder probarlo: es la regla que decide si la pantalla dice
 * "todo bien", "falta algo por aplicar" o "no se pudo leer". Antes cada estado
 * elegía su propio color entre `primary`, `accent` y `destructive`, y `accent`
 * valía lo mismo que `secondary`.
 */
export const LEAGUE_SEVERITY: Record<LeagueStatus, Severity> = {
  loading: "info",
  ready: "ok",
  missing: "warn",
  anon: "unknown",
  error: "critical",
};

/**
 * Marco del panel por tono. Mapa literal: Tailwind no puede leer clases
 * construidas con plantillas (`border-${tone}/30` no existe para el compilador).
 */
export const LEAGUE_FRAME: Record<Severity, string> = {
  ok: "border-severity-ok/30 bg-severity-ok/5",
  info: "border-severity-info/30 bg-severity-info/5",
  warn: "border-severity-warn/40 bg-severity-warn/5",
  critical: "border-severity-critical/40 bg-severity-critical/5",
  unknown: "border-border/40 bg-card/40",
};

/**
 * Marco comun a las dos tablas de la liga: cabecera con el estado a la derecha
 * y el mismo borde. La diferencia entre ellas es el tono, no la anatomia.
 */
export function LeaguePanel({
  title,
  meta,
  severity,
  children,
}: {
  title: ReactNode;
  meta: string;
  severity: Severity;
  children: ReactNode;
}) {
  return (
    <section data-severity={severity} className={cn("rounded-xl border", LEAGUE_FRAME[severity])}>
      <header className="flex items-center gap-2 border-b border-border/20 px-3 py-2">
        <Trophy className="h-3 w-3 shrink-0 text-muted-foreground/60" />
        <h3 className="font-heading text-[10px] uppercase tracking-widest text-foreground/85">{title}</h3>
        <span
          className={cn(
            "ml-auto inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider",
            SEVERITY_CLASS[severity],
          )}
        >
          {meta}
        </span>
      </header>
      <div className="py-1">{children}</div>
    </section>
  );
}

/**
 * Una linea de clasificacion. Las dos tablas comparten medidas: `w-5` para el
 * puesto, `flex-1` para el nombre, `w-14` a la derecha para los puntos.
 * `highlight` marca la fila del jugador, que antes no se distinguia.
 */
export function LeagueRow({
  leading,
  label,
  aside,
  value,
  highlight = false,
}: {
  leading: ReactNode;
  label: ReactNode;
  aside?: ReactNode;
  value: ReactNode;
  highlight?: boolean;
}) {
  return (
    <li
      data-highlight={highlight || undefined}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 font-mono text-[10px]",
        highlight && "bg-secondary/10",
      )}
    >
      <span className="w-5 shrink-0 text-muted-foreground/40">{leading}</span>
      <span className={cn("min-w-0 flex-1 truncate", highlight ? "text-secondary" : "text-foreground/85")}>
        {label}
      </span>
      {aside != null && <span className="shrink-0 text-muted-foreground/45">{aside}</span>}
      <span className={cn("w-14 shrink-0 text-right", highlight ? "text-secondary" : "text-primary")}>
        {value}
      </span>
    </li>
  );
}

/** Estado vacio, igual en las dos tablas. */
export function LeagueEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="mx-3 my-2 rounded-lg border border-dashed border-border/50 px-3 py-5 text-center">
      <Trophy className="mx-auto h-5 w-5 text-muted-foreground/40" />
      <p className="mt-2 font-mono text-[10px] text-muted-foreground/60">{children}</p>
    </div>
  );
}
