import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** El eje unico: lo que antes cada pantalla elegia entre `accent` y `secondary`. */
export type Severity = "ok" | "info" | "warn" | "critical" | "unknown";

/** Estado del dato, ortogonal a la severidad: un dato viejo no es un fallo. */
export type DataState = "live" | "stale" | "fallback" | "unavailable";

/** Mapa literal: Tailwind no puede leer clases construidas con plantillas. */
export const SEVERITY_CLASS: Record<Severity, string> = {
  ok: "border-severity-ok/40 bg-severity-ok/10 text-severity-ok",
  info: "border-severity-info/40 bg-severity-info/10 text-severity-info",
  warn: "border-severity-warn/50 bg-severity-warn/10 text-severity-warn",
  critical: "border-severity-critical/50 bg-severity-critical/10 text-severity-critical",
  unknown: "border-severity-unknown/40 bg-severity-unknown/10 text-severity-unknown",
};

const DATA_CLASS: Record<DataState, string> = {
  live: "text-data-live",
  stale: "text-data-stale",
  fallback: "text-data-fallback",
  unavailable: "text-data-unavailable",
};

/**
 * Una etiqueta de estado. El `data-severity` deja el tono en el DOM para poder
 * comprobarlo en una prueba sin mirar clases, y para poder recolorearlo desde
 * CSS sin tocar el componente.
 */
export function SeverityBadge({
  severity,
  dataState,
  icon,
  children,
  title,
}: {
  severity: Severity;
  dataState?: DataState;
  icon?: ReactNode;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      data-severity={severity}
      data-state={dataState}
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider",
        SEVERITY_CLASS[severity],
      )}
    >
      {icon}
      {children}
      {dataState && (
        <span className={cn("ml-0.5 text-[8px] normal-case tracking-normal opacity-80", DATA_CLASS[dataState])}>
          {dataState}
        </span>
      )}
    </span>
  );
}
