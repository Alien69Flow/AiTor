import { describe, expect, it } from "vitest";
import { planRasterBulk } from "./raster-quota";

const CATALOG = ["clouds", "temperature", "precipitation", "humidity", "satellite", "aqi", "dust", "sst"] as const;

const plan = (active: readonly string[], requested: readonly string[], max = 6) =>
  planRasterBulk({ max, catalogOrder: CATALOG, active, requested });

describe("cupo de teselas al encender en bloque", () => {
  it("llena el cupo con las primeras del catálogo, no con las últimas", () => {
    // Encender todo el catálogo: el usuario espera ver las de arriba (nubes,
    // temperatura, lluvia), no las exóticas del final.
    const { keep, evicted } = plan([], CATALOG);
    expect(keep).toEqual(["clouds", "temperature", "precipitation", "humidity", "satellite", "aqi"]);
    expect(evicted).toEqual(["dust", "sst"]);
  });

  it("no apaga lo que ya estaba encendido al pulsar «Todas»", () => {
    const { keep } = plan(["sst", "dust"], CATALOG);
    expect(keep.slice(0, 2)).toEqual(["sst", "dust"]);
    expect(keep).toHaveLength(6);
  });

  it("con el cupo lleno sólo conserva lo encendido y no enciende nada nuevo", () => {
    const { keep, evicted } = plan(CATALOG.slice(0, 6), CATALOG);
    expect(keep).toEqual(CATALOG.slice(0, 6));
    expect(evicted).toEqual(["dust", "sst"]);
  });

  it("nunca devuelve más capas que el cupo", () => {
    const { keep } = plan([], CATALOG, 3);
    expect(keep).toHaveLength(3);
  });

  it("respeta el orden real de encendido de lo que ya estaba puesto", () => {
    const { keep } = plan(["aqi", "clouds"], CATALOG, 2);
    expect(keep).toEqual(["aqi", "clouds"]);
  });

  it("con cupo cero no deja ninguna tesela", () => {
    const { keep, evicted } = plan(CATALOG.slice(0, 2), CATALOG, 0);
    expect(keep).toEqual([]);
    expect(evicted).toHaveLength(CATALOG.length);
  });
});
