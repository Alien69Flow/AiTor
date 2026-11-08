import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { applyGlobeBasePatch } from "./globe-base-patch";

/** Copia reducida de la zona de arranque del visor, con las tres anclas. */
const FIXTURE = `    viewer.scene.backgroundColor = Color.BLACK;
    viewer.scene.globe.enableLighting = true;
    (async () => {
      try {
        const baseProvider = await ArcGisMapServerImageryProvider.fromUrl(
          "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer"
        );
        if (viewer.isDestroyed()) return;
        const baseLayer = viewer.imageryLayers.addImageryProvider(baseProvider);
        viewer.imageryLayers.lowerToBottom(baseLayer);
      } catch (e) {
        console.warn(e);
      }
    })();
`;

describe("parche de la base del globo", () => {
  it("quita el azul: relleno oscuro, sin luz solar y base síncrona", () => {
    const result = applyGlobeBasePatch(FIXTURE);
    expect(result.ok).toBe(true);
    expect(result.applied).toHaveLength(3);
    expect(result.source).toContain('viewer.scene.globe.baseColor = Color.fromCssColorString("#0b1220");');
    expect(result.source).toContain("viewer.scene.globe.enableLighting = false;");
    expect(result.source).toContain("World_Imagery/MapServer/tile/{z}/{y}/{x}");
    // La variante asíncrona del proveedor de World_Imagery ya no está: si
    // siguiera, la capa volvería a llegar después del primer fotograma.
    expect(result.source).not.toContain(
      '"https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer"',
    );
    expect(result.source).not.toContain("await ArcGisMapServerImageryProvider.fromUrl(\n");
  });

  it("es idempotente: la segunda pasada no toca nada", () => {
    const first = applyGlobeBasePatch(FIXTURE);
    const second = applyGlobeBasePatch(first.source);
    expect(second.ok).toBe(true);
    expect(second.applied).toHaveLength(0);
    expect(second.already).toHaveLength(3);
    expect(second.source).toBe(first.source);
  });

  it("no escribe nada si el archivo cambió: falla y dice qué falta", () => {
    const roto = FIXTURE.replace("viewer.scene.backgroundColor = Color.BLACK;", "");
    const result = applyGlobeBasePatch(roto);
    expect(result.ok).toBe(false);
    expect(result.source).toBe(roto);
    expect(result.problems.join(" ")).toContain("backgroundColor");
  });

  it("el fuente real del visor conserva las anclas del parche", () => {
    // El script se apoya en estas tres anclas: si alguien reescribe el arranque
    // del visor, esto falla aquí y no a mitad de un parche en local.
    const file = readFileSync(resolve(process.cwd(), "src/components/globe/CesiumGlobe.tsx"), "utf8");
    const result = applyGlobeBasePatch(file);
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
