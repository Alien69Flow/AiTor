/**
 * Parche que monta el panel de señales en la pestaña de Markets.
 *
 * `SignalsTab.tsx` ya pinta las tendencias de CoinGecko; lo que falta es el
 * tablero del motor. El cambio son dos líneas —el import y el componente— pero
 * el fichero se edita desde la CI, no a mano: si el componente cambia y las
 * anclas no están, esto lanza y no se escribe nada.
 *
 * Todo o nada e idempotente: con el marcador presente devuelve `changed:
 * false`, así el workflow puede ejecutarse en cada push sin acumular commits.
 */

/** Marca de que el panel ya está montado. */
export const PANEL_MARKER = "Panel de señales del motor";

const IMPORT_ANCHOR = 'import { toast } from "sonner";';
const CONTENT_ANCHOR = "{/* Content */}";
const IMPORT_LINE = 'import { MarketSignalsPanel } from "./MarketSignalsPanel";';

export interface SignalsPanelPatchResult {
  source: string;
  changed: boolean;
}

/** Índice de la única aparición de un ancla, o lanza con el motivo. */
function uniqueIndexOf(source: string, anchor: string): number {
  const index = source.indexOf(anchor);
  if (index < 0) throw new Error(`ancla no encontrada: ${anchor}`);
  if (source.indexOf(anchor, index + anchor.length) >= 0) {
    throw new Error(`ancla repetida: ${anchor}`);
  }
  return index;
}

/** Añade el import del panel detrás del último import de la cabecera. */
function addImport(source: string): string {
  const index = uniqueIndexOf(source, IMPORT_ANCHOR);
  const after = index + IMPORT_ANCHOR.length;
  return `${source.slice(0, after)}\n${IMPORT_LINE}${source.slice(after)}`;
}

/** Monta el panel encima del contenido de la pestaña. */
function addPanel(source: string): string {
  const index = uniqueIndexOf(source, CONTENT_ANCHOR);
  const lineStart = source.lastIndexOf("\n", index) + 1;
  const indent = /^[ \t]*/.exec(source.slice(lineStart))?.[0] ?? "";
  const block = [
    `${indent}{/* ${PANEL_MARKER}: el motor puro ordena por urgencia y aquí sólo`,
    `${indent}    se pinta. */}`,
    `${indent}<MarketSignalsPanel />`,
    "",
    "",
  ].join("\n");
  return source.slice(0, lineStart) + block + source.slice(lineStart);
}

/** Aplica las dos inserciones. */
export function patchSignalsPanel(source: string): SignalsPanelPatchResult {
  if (source.includes(PANEL_MARKER)) return { source, changed: false };

  const withImport = addImport(source);
  const patched = addPanel(withImport);
  return { source: patched, changed: patched !== source };
}
