import { describe, expect, it } from "vitest";

import { PANEL_MARKER, patchSignalsPanel } from "./signals-panel-patch";

/** Cabecera y cuerpo mínimos con las mismas anclas que el componente real. */
const FIXTURE = `import { useState } from "react";
import { toast } from "sonner";

interface TrendingCoin {
  id: string;
}

export function SignalsTab() {
  const [trending] = useState<TrendingCoin[]>([]);

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4">
      <h2 className="text-sm">Live Signals</h2>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0"></div>
    </div>
  );
}
`;

describe("patchSignalsPanel", () => {
  it("añade el import y monta el panel encima del contenido", () => {
    const result = patchSignalsPanel(FIXTURE);

    expect(result.changed).toBe(true);
    expect(result.source).toContain('import { MarketSignalsPanel } from "./MarketSignalsPanel";');
    expect(result.source).toContain(PANEL_MARKER);
    expect(result.source).toContain("<MarketSignalsPanel />");

    // El panel va antes del contenido y después de la cabecera.
    const panel = result.source.indexOf("<MarketSignalsPanel />");
    const content = result.source.indexOf("{/* Content */}");
    expect(panel).toBeGreaterThan(-1);
    expect(panel).toBeLessThan(content);

    // El import entra una sola vez y en la cabecera.
    expect(result.source.match(/from "\.\/MarketSignalsPanel";/g)).toHaveLength(1);
    expect(result.source.indexOf('from "./MarketSignalsPanel"')).toBeLessThan(
      result.source.indexOf("export function SignalsTab"),
    );

    // El resto del componente sigue intacto.
    expect(result.source.startsWith('import { useState } from "react";')).toBe(true);
    expect(result.source).toContain('className="flex-1 overflow-y-auto min-h-0"');
  });

  it("es idempotente: la segunda pasada no cambia ni un byte", () => {
    const once = patchSignalsPanel(FIXTURE);
    const twice = patchSignalsPanel(once.source);

    expect(twice.changed).toBe(false);
    expect(twice.source).toBe(once.source);
  });

  it("falla en claro si el componente ya no tiene las anclas", () => {
    expect(() => patchSignalsPanel("export const OTRA_COSA = 1;\n")).toThrow(
      /ancla no encontrada/,
    );
  });

  it("no toca nada si falta el marcador de contenido", () => {
    const sinContenido = FIXTURE.replace("{/* Content */}", "{/* Cuerpo */}");
    expect(() => patchSignalsPanel(sinContenido)).toThrow(/ancla no encontrada/);
  });
});
