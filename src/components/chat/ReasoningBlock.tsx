import { useEffect, useRef, useState } from "react";
import { Brain, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReasoningBlockProps {
  /** Razonamiento tal cual lo publicó el modelo, por trozos concatenados. */
  text: string;
  /** El modelo sigue pensando (aún no ha empezado la respuesta). */
  active: boolean;
}

/**
 * Panel del razonamiento del modelo, plegable.
 *
 * Mismo comportamiento que Freebuff, Gemini o Grok: mientras el modelo piensa
 * el panel está abierto y se ve el monólogo llegar palabra a palabra; en cuanto
 * empieza la respuesta se pliega solo a una línea con lo que tardó, y un clic lo
 * vuelve a abrir para quien quiera leer el porqué.
 *
 * El texto es deliberadamente plano (`whitespace-pre-wrap`), no markdown: el
 * razonamiento a medio escribir rompe tablas y bloques de código, y aquí no
 * aporta nada que no diga la respuesta.
 */
export function ReasoningBlock({ text, active }: ReasoningBlockProps) {
  // Arranca abierto sólo si el modelo está pensando ahora: un mensaje
  // recuperado del historial no debe abrirse y cerrarse de golpe al montarse.
  const [open, setOpen] = useState(active);
  const [seconds, setSeconds] = useState<number | null>(null);
  const startedAt = useRef<number | null>(active ? Date.now() : null);

  useEffect(() => {
    if (active) {
      startedAt.current ??= Date.now();
      setOpen(true);
      return;
    }
    // Deja de pensar: se guarda la duración y se pliega. Si el usuario lo
    // reabre después, este efecto ya no vuelve a cerrarlo.
    if (startedAt.current !== null) {
      setSeconds(Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)));
      startedAt.current = null;
    }
    setOpen(false);
  }, [active]);

  if (!text.trim()) return null;

  // Sin duración medida (mensaje recuperado del almacenamiento) se queda en el
  // nombre a secas: inventar «N palabras» a partir de los caracteres sería un
  // dato falso en la interfaz.
  const label = seconds !== null ? `Razonamiento · ${seconds} s` : "Razonamiento";

  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-border/60 bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-muted/30"
      >
        <Brain className={cn("h-3 w-3 shrink-0", active ? "text-secondary animate-pulse" : "text-muted-foreground/60")} />
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
          {active ? "Razonamiento" : label}
        </span>
        {active ? (
          <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground/50" aria-label="Pensando" />
        ) : (
          <span className="text-[9px] font-mono text-muted-foreground/40">ver</span>
        )}
        <ChevronDown
          className={cn("ml-auto h-3 w-3 shrink-0 text-muted-foreground/50 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="max-h-64 overflow-y-auto border-t border-border/40 px-3 py-2">
          <p className="whitespace-pre-wrap text-[11px] leading-relaxed font-mono text-muted-foreground/70">
            {text}
            {active && <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 animate-pulse bg-secondary/70" aria-hidden="true" />}
          </p>
        </div>
      )}
    </div>
  );
}
