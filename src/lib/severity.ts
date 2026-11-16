/**
 * Severidad: un solo eje para decir "esto salio bien", "esto avisa" o "esto
 * fallo", en vez de que cada pantalla elija entre `accent` y `secondary` (que
 * valen lo mismo). Los colores viven en `tailwind.config.ts`.
 *
 * Sin React a proposito: lo importan el registro de herramientas (el tipo) y el
 * componente que las pinta (el mapa), y una prueba puede leerlo sin montar nada.
 */

export type Severity = "ok" | "info" | "warn" | "critical" | "unknown";

/** Mapa literal: Tailwind no puede leer clases construidas con plantillas. */
export const SEVERITY_CLASS: Record<Severity, string> = {
  ok: "border-severity-ok/40 bg-severity-ok/10 text-severity-ok",
  info: "border-severity-info/40 bg-severity-info/10 text-severity-info",
  warn: "border-severity-warn/50 bg-severity-warn/10 text-severity-warn",
  critical: "border-severity-critical/50 bg-severity-critical/10 text-severity-critical",
  unknown: "border-severity-unknown/40 bg-severity-unknown/10 text-severity-unknown",
};
