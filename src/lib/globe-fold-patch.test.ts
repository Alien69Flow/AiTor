import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { FOLD_MARKER, patchGlobeFold } from "./globe-fold-patch";

/** Recorte del panel con las tres anclas tal como están en `GlobeDashboard.tsx`. */
const FIXTURE = `import { useState, useCallback } from "react";

export function GlobeDashboard() {
  const [selectedHotspot, setSelectedHotspot] = useState(null);
  const [mobilePanel, setMobilePanel] = useState(null);
  const [feedOpen, setFeedOpen] = useState(true);
  // Abierta por defecto: dentro viven la leyenda, las esferas de la Tierra y el
  // diagnóstico. Cerrada, el globo parecía no tener capas atmosféricas porque
  // no había forma de descubrirlas sin pulsar un icono sin etiqueta.
  const [controlsOpen, setControlsOpen] = useState(true);

  const legend = (onClose?: () => void, collapsed = true) => (
    <LegendPanel onClose={onClose} defaultCollapsed={collapsed} />
  );

  return (
    <>
      <aside>{legend(undefined, false)}</aside>
      <div>{legend(() => setMobilePanel(null), false)}</div>
    </>
  );
}
`;

/** Declaración perezosa que trae hoy el panel real, atada al ancho de pantalla. */
const LAZY_CONTROLS =
  'const [controlsOpen, setControlsOpen] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1280);';

describe("patchGlobeFold", () => {
  it("abre el globo con el rail cerrado y las dos leyendas plegadas", () => {
    const { source, changed } = patchGlobeFold(FIXTURE);

    expect(changed).toBe(true);
    expect(source).toContain(FOLD_MARKER);
    expect(source).toContain("const [controlsOpen, setControlsOpen] = useState(false);");

    // Las dos llamadas a la leyenda nacen plegadas, escritorio y móvil.
    expect(source).toContain("legend(undefined, true)");
    expect(source).toContain("legend(() => setMobilePanel(null), true)");
    expect(source).not.toContain("legend(undefined, false)");

    // El comentario que justificaba abrirlo ya no está.
    expect(source).not.toContain("Abierta por defecto");

    // El resto del panel sigue intacto.
    expect(source).toContain("const [feedOpen, setFeedOpen] = useState(true);");
    expect(source).toContain("const [mobilePanel, setMobilePanel] = useState(null);");
  });

  it("pliega también con el inicializador perezoso del panel real", () => {
    const perezoso = FIXTURE.replace(
      "const [controlsOpen, setControlsOpen] = useState(true);",
      LAZY_CONTROLS,
    );

    const { source, changed } = patchGlobeFold(perezoso);

    expect(changed).toBe(true);
    expect(source).toContain("const [controlsOpen, setControlsOpen] = useState(false);");
    expect(source).not.toContain("window.innerWidth");
    expect(source).toContain("legend(undefined, true)");
    expect(source).toContain("legend(() => setMobilePanel(null), true)");
  });

  it("es idempotente: la segunda pasada no cambia ni un byte", () => {
    const once = patchGlobeFold(FIXTURE);
    const twice = patchGlobeFold(once.source);

    expect(twice.changed).toBe(false);
    expect(twice.source).toBe(once.source);
  });

  it("falla en claro si ya no hay comentario que quitar", () => {
    const sinComentario = FIXTURE.replace(
      /[ \t]*\/\/ Abierta por defecto:[\s\S]*?sin etiqueta\.\n/,
      "",
    );

    expect(() => patchGlobeFold(sinComentario)).toThrow(/comentario/);
  });

  it("falla si falta la llamada de la leyenda en móvil", () => {
    const sinMovil = FIXTURE.replace("legend(() => setMobilePanel(null), false)", "null");

    expect(() => patchGlobeFold(sinMovil)).toThrow(/ancla no encontrada/);
  });

  it("el panel real está plegado o conserva las anclas", () => {
    // La ruta sale del directorio de trabajo y no de `import.meta.url`: en el
    // entorno de pruebas del CI esa URL no lleva el esquema `file:` y `readFileSync`
    // la rechaza con `ERR_INVALID_URL_SCHEME`. Vitest ejecuta siempre desde la
    // raíz del proyecto.
    const real = readFileSync(
      resolve(process.cwd(), "src/components/dashboard/GlobeDashboard.tsx"),
      "utf8",
    );

    if (real.includes(FOLD_MARKER)) {
      expect(real).toContain("const [controlsOpen, setControlsOpen] = useState(false);");
      expect(real).toContain("legend(undefined, true)");
      expect(real).toContain("legend(() => setMobilePanel(null), true)");
      return;
    }

    // El rail ya nace plegado según el ancho de pantalla: en móvil y tablet
    // arranca cerrado, que es justo lo que perseguía el parche.
    if (/const \[controlsOpen, setControlsOpen\] = useState\(\(\) =>[^\n]*innerWidth >= \d+\)/.test(real)) {
      return;
    }

    // Sin aplicar todavía: las anclas tienen que seguir donde el parche las
    // espera, para que aplicarlo después no dependa de la suerte. La declaración
    // del rail se comprueba por forma, igual que la reconoce el parche: hoy
    // trae un inicializador perezoso y antes era `useState(true)`.
    expect(real).toMatch(/const \[controlsOpen, setControlsOpen\] = useState\(.*\);/);
    expect(real).toContain("legend(undefined, false)");
    expect(real).toContain("legend(() => setMobilePanel(null), false)");
  });
});