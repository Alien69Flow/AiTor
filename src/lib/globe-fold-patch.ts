/**
 * Parche que hace nacer el globo con el rail de controles y la leyenda
 * plegados.
 *
 * `GlobeDashboard.tsx` abre el rail al cargar (`controlsOpen` en `true`) y
 * llama a la leyenda con `defaultCollapsed` en `false`, así que el primer
 * render tapa media pantalla con paneles antes de que el usuario pida nada. Lo
 * que se quiere es lo contrario: el globo despejado y sólo los botones
 * genéricos del rail (abrir controles, capas, navegar) a la vista.
 *
 * Va como parche y no editando el fichero a mano porque `GlobeDashboard.tsx`
 * tiene más de cuatrocientas líneas con plantillas dentro de atributos `title`:
 * una comilla de más deja el TSX sin compilar y aquí no hay máquina para
 * comprobarlo. Las dos llamadas a la leyenda se buscan como literales; la
 * declaración del rail, por forma, porque su inicializador ha cambiado con el
 * tiempo (`useState(true)` y luego uno perezoso que mira el ancho de la
 * ventana). Cada ancla tiene que aparecer una sola vez, o el parche lanza y no
 * escribe nada.
 */

/** Marca de que el plegado inicial ya está aplicado. */
export const FOLD_MARKER = "Plegado al cargar";

/**
 * Línea que declara el estado del rail, con el inicializador que traiga.
 *
 * No se busca el texto exacto porque el componente lo ha ido estrechando y el
 * parche sólo necesita reconocer la declaración para dejarla en `false`.
 */
const CONTROLS_LINE = /^[ \t]*const \[controlsOpen, setControlsOpen\] = useState\(.*\);[ \t]*$/gm;
const DESKTOP_LEGEND_ANCHOR = "legend(undefined, false)";
const MOBILE_LEGEND_ANCHOR = "legend(() => setMobilePanel(null), false)";

/**
 * Comentario que justificaba abrir el rail y que deja de ser cierto. Se quita
 * por frases y no por líneas exactas: así no depende de cómo esté sangrado.
 */
const STALE_COMMENT =
  /[ \t]*\/\/ Abierta por defecto:[^\n]*\n[ \t]*\/\/ diagnóstico\.[^\n]*\n[ \t]*\/\/ no había forma de descubrirlas[^\n]*\n/;

/** Comentario nuevo del rail ya plegado. */
const FOLDED_COMMENT = [
  `  // ${FOLD_MARKER}: el globo arranca con sólo los botones genéricos del rail`,
  "  // (abrir controles, capas y navegar). La leyenda, la navegación y el",
  "  // diagnóstico se abren a petición: al entrar, el planeta se ve entero.",
].join("\n");

export interface GlobeFoldResult {
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

/** Deja el rail cerrado conservando el sangrado de la línea. */
function foldControls(source: string): string {
  const [first, second] = source.match(CONTROLS_LINE) ?? [];
  if (!first) {
    throw new Error("ancla no encontrada: declaración de controlsOpen");
  }
  if (second) {
    throw new Error("ancla repetida: declaración de controlsOpen");
  }

  const start = source.indexOf(first);
  const indent = /^[ \t]*/.exec(first)?.[0] ?? "";

  return (
    source.slice(0, start) +
    `${indent}const [controlsOpen, setControlsOpen] = useState(false);` +
    source.slice(start + first.length)
  );
}

/** Aplica los tres cambios: rail cerrado y las dos leyendas plegadas. */
export function patchGlobeFold(source: string): GlobeFoldResult {
  if (source.includes(FOLD_MARKER)) return { source, changed: false };

  const stale = source.match(STALE_COMMENT);
  if (!stale || stale.length !== 1) {
    throw new Error(
      "no se encontró el comentario que abría el rail por defecto: revisa GlobeDashboard.tsx antes de aplicar el parche",
    );
  }

  // Primero el comentario y después la declaración: la nueva ya nace en `false`,
  // así que el recuento de anclas sigue viendo una sola.
  let out = source.replace(STALE_COMMENT, `${FOLDED_COMMENT}\n`);
  out = foldControls(out);

  // La leyenda nace plegada en escritorio y en móvil.
  const desktop = uniqueIndexOf(out, DESKTOP_LEGEND_ANCHOR);
  out =
    out.slice(0, desktop) +
    "legend(undefined, true)" +
    out.slice(desktop + DESKTOP_LEGEND_ANCHOR.length);

  const mobile = uniqueIndexOf(out, MOBILE_LEGEND_ANCHOR);
  out =
    out.slice(0, mobile) +
    "legend(() => setMobilePanel(null), true)" +
    out.slice(mobile + MOBILE_LEGEND_ANCHOR.length);

  return { source: out, changed: out !== source };
}
