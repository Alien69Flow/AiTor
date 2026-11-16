import { AlertTriangle, Check, Cloud, Database, Github, Radar, Satellite, Wrench } from "lucide-react";
import { resolveToolCard, type ToolIcon } from "@/lib/chat-cards";
import { SEVERITY_CLASS, type Severity } from "@/lib/severity";
import { cn } from "@/lib/utils";

const ICONS: Record<ToolIcon, typeof Cloud> = {
  cloud: Cloud,
  satellite: Satellite,
  radar: Radar,
  github: Github,
  database: Database,
  wrench: Wrench,
};

/** Lo que hoy manda `useChat` en `message.skills`. */
export interface SkillReport {
  label: string;
  ok?: boolean;
  error?: string | null;
}

/**
 * Una fuente consultada en este turno.
 *
 * El icono dice de que herramienta viene y el color dice como le fue: el tono
 * de la tarjeta si llego, rojo si fallo. Lo desconocido cae en la generica gris
 * en vez de romper el mensaje.
 */
export function ToolCard({ skill }: { skill: SkillReport }) {
  const card = resolveToolCard(skill.label);
  const severity: Severity = skill.ok ? card.tone : "critical";
  const Icon = ICONS[card.icon];

  return (
    <span
      data-tool={card.id}
      title={skill.ok ? card.label : `${card.label}: ${skill.error ?? card.emptyHint}`}
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider",
        SEVERITY_CLASS[severity],
      )}
    >
      {skill.ok ? <Check className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
      <Icon className="h-2.5 w-2.5 opacity-70" aria-hidden="true" />
      {skill.label}
    </span>
  );
}
