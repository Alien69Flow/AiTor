import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { TILES_MARKER, patchGlobeTiles } from "./globe-tiles-patch";

/**
 * El catálogo real. La ruta sale del directorio de trabajo y no de
 * `import.meta.url`: en el runner del CI esa URL no lleva el esquema `file:` y
 * `readFileSync` la rechaza con `ERR_INVALID_URL_SCHEME`.
 */
function catalog(): string {
  return readFileSync(resolve(process.cwd(), "src/lib/globe-layers.ts"), "utf8");
}

/** El catálogo ya parcheado, sin depender de si el workflow ya pasó. */
function patched(): string {
  const source = catalog();
  return source.includes(TILES_MARKER) ? source : patchGlobeTiles(source).source;
}

/** Recorte mínimo: sirve para comprobar que un ancla que falta aborta todo. */
const FIXTURE = [
  "const LAYER_CATALOG: globeLayerDef[] = [",
  '  { key: "seaIce", gibs: { layer: "GHRSST_L4_MUR25_Sea_Ice_Concentration", level: 6, alpha: 0.85, dateOffsetHours: 60 } },',
  "]",
].join("\n");

describe("patchGlobeTiles", () => {
  it("cambia las capas casi vacías por productos de malla densa", () => {
    const source = patched();

    // El hielo salió de MUR primero y ahora es la rejilla polar de AMSR2: lo que
    // esta prueba defiende es que no vuelva a pedirse el barrido que no pintaba.
    expect(source).toContain('layer: "AMSRU2_Sea_Ice_Concentration_25km"');
    expect(source).toContain('layer: "MERRA2_Total_Precipitable_Water_Vapor_Monthly"');
    expect(source).toContain('layer: "MERRA2_Air_Temperature_250hPa_Monthly"');
    expect(source).toContain('label: "Temperatura a 250 hPa"');

    // Los barridos orbitales que dejaban la tesela vacía ya no están.
    expect(source).not.toContain("GHRSST_L4_MUR25_Sea_Ice_Concentration");
    expect(source).not.toContain("AMSRU2_Columnar_Water_Vapor_Day");
    expect(source).not.toContain("MLS_Temperature_46hPa_Day");
  });

  it("descongela las corrientes y dice que el CO₂ es orbital", () => {
    const source = patched();

    expect(source).toContain('layer: "OSCAR_Sea_Surface_Currents_Zonal"');
    expect(source).not.toContain('date: "2024-07-17"');
    expect(source).toContain("timeless: true");
    expect(source).toContain('freshness: "Último compuesto disponible"');
    expect(source).toContain("OCO-2 (muestreo orbital)");
  });

  it("es idempotente: la segunda pasada no cambia ni un byte", () => {
    const once = patchGlobeTiles(catalog());
    const twice = patchGlobeTiles(once.source);

    expect(twice.changed).toBe(false);
    expect(twice.source).toBe(once.source);
  });

  it("falla en claro si falta un ancla, sin dejar el catálogo a medias", () => {
    expect(() => patchGlobeTiles(FIXTURE)).toThrow(/coincidencia/);
  });
});
