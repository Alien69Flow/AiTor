/**
 * Ajustes de UI para pantallas pequeñas que no conviene escribir a mano.
 *
 * `ChatMessage` y `TopNavBar` son ficheros largos: reescribirlos completos con
 * el contenido que devuelve la API de GitHub perdía indentación y formato. Aquí
 * cada cambio es una sustitución exacta y única sobre el fichero real, de modo
 * que la aplicación es todo-o-nada: si un ancla desapareció o se repitió, no se
 * escribe nada y el flujo falla en vez de dejar el árbol a medias.
 */

export interface MobileUiSwap {
  /** Ruta relativa a la raíz del repositorio. */
  file: string;
  /** Texto exacto que se sustituye. Debe aparecer una sola vez. */
  find: string;
  /** Texto que lo reemplaza. */
  replace: string;
  /** Nombre corto para mensajes de error y pruebas. */
  label: string;
}

export const MOBILE_UI_SWAPS: MobileUiSwap[] = [
  // --- Chat: la conversación se lee en una columna estrecha -----------------
  {
    file: "src/components/chat/ChatMessage.tsx",
    label: "fila del mensaje",
    find: '"group w-full py-5 px-4 md:px-6 transition-colors"',
    replace: '"group w-full py-3.5 px-3 sm:py-5 sm:px-6 transition-colors"',
  },
  {
    file: "src/components/chat/ChatMessage.tsx",
    label: "columna del mensaje",
    find: '"max-w-3xl mx-auto flex gap-4"',
    replace: '"max-w-3xl mx-auto flex gap-2.5 sm:gap-4"',
  },
  {
    file: "src/components/chat/ChatMessage.tsx",
    label: "avatar del usuario",
    find: "w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center",
    replace:
      "w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center",
  },
  {
    file: "src/components/chat/ChatMessage.tsx",
    label: "avatar de AI Tor",
    find: "w-7 h-7 rounded-lg border border-secondary/30 overflow-hidden bg-card/60 flex items-center justify-center",
    replace:
      "w-6 h-6 sm:w-7 sm:h-7 rounded-lg border border-secondary/30 overflow-hidden bg-card/60 flex items-center justify-center",
  },
  {
    file: "src/components/chat/ChatMessage.tsx",
    label: "icono del usuario",
    find: '<User className="w-4 h-4 text-primary" />',
    replace: '<User className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />',
  },
  {
    file: "src/components/chat/ChatMessage.tsx",
    label: "icono de AI Tor",
    find: '<Cpu className="h-4 w-4 text-secondary" aria-label="AI Tor" />',
    replace: '<Cpu className="h-3.5 w-3.5 text-secondary sm:h-4 sm:w-4" aria-label="AI Tor" />',
  },
  {
    // En táctil no hay hover: la hora se quedaba invisible en el teléfono.
    file: "src/components/chat/ChatMessage.tsx",
    label: "hora del mensaje",
    find: "text-[9px] font-mono text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity",
    replace:
      "text-[9px] font-mono text-muted-foreground/40 transition-opacity sm:opacity-0 sm:group-hover:opacity-100",
  },
  {
    file: "src/components/chat/ChatMessage.tsx",
    label: "cuerpo del mensaje",
    find: '"text-sm leading-7 font-mono",',
    replace: '"text-[13.5px] leading-6 sm:text-sm sm:leading-7 font-mono",',
  },
  {
    // El texto del usuario pasa a ser una burbuja: sin caja, en móvil se
    // confundía con el markdown de AI Tor de la fila siguiente.
    file: "src/components/chat/ChatMessage.tsx",
    label: "burbuja del usuario",
    find: '"text-foreground/90 whitespace-pre-wrap"',
    replace:
      '"whitespace-pre-wrap break-words rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-foreground/90"',
  },
  {
    file: "src/components/chat/ChatMessage.tsx",
    label: "acciones del mensaje",
    find: '"mt-2 opacity-0 group-hover:opacity-100 transition-opacity"',
    replace: '"mt-2 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"',
  },
  // --- Barra superior: siete pestañas en anchos de tablet -------------------
  {
    file: "src/components/dashboard/TopNavBar.tsx",
    label: "lista de pestañas de escritorio",
    find: "hidden md:flex items-center gap-0.5",
    replace: "hidden md:flex min-w-0 items-center gap-0.5 overflow-x-auto no-scrollbar",
  },
  {
    file: "src/components/dashboard/TopNavBar.tsx",
    label: "botón de pestaña",
    find: "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-heading tracking-wider uppercase transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
    replace:
      "flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2 py-1.5 rounded-md text-[10px] font-heading tracking-wider uppercase transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 lg:px-3 lg:text-[11px]",
  },
];

/** Ficheros que toca el parche, sin repetir. */
export const MOBILE_UI_FILES: string[] = Array.from(new Set(MOBILE_UI_SWAPS.map((swap) => swap.file)));

function swapsFor(file: string): MobileUiSwap[] {
  return MOBILE_UI_SWAPS.filter((swap) => swap.file === file);
}

/**
 * Aplica los cambios de un fichero. Lanza si un ancla no aparece exactamente
 * una vez, que es lo que impide escribir un fichero a medio parchear.
 */
export function patchMobileUi(source: string, file: string): string {
  const swaps = swapsFor(file);
  if (swaps.length === 0) throw new Error(`No hay cambios declarados para ${file}.`);

  let output = source;
  for (const swap of swaps) {
    const occurrences = output.split(swap.find).length - 1;
    if (occurrences !== 1) {
      throw new Error(
        `${file}: «${swap.label}» aparece ${occurrences} veces y se esperaba exactamente una.`,
      );
    }
    output = output.split(swap.find).join(swap.replace);
  }
  return output;
}

/** Cierto cuando ninguno de los anclas del fichero sigue en el texto. */
export function isMobileUiPatched(source: string, file: string): boolean {
  return swapsFor(file).every((swap) => !source.includes(swap.find));
}
