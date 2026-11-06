import { describe, expect, it } from "vitest";
import { countFabricatedIds, isFabricatedId } from "./live-traffic";

/**
 * La capa de tráfico estuvo pintando barcos y aviones inventados porque la
 * función desplegada no los marcaba. El identificador es la única señal fiable:
 * ningún ICAO24 ni MMSI real empieza por «mock».
 */
describe("detección de tráfico simulado", () => {
  it("reconoce las filas inventadas de los despliegues antiguos", () => {
    expect(isFabricatedId("mock0000")).toBe(true);
    expect(isFabricatedId("mock000000000")).toBe(true);
    expect(isFabricatedId("  MOCK123  ")).toBe(true);
  });

  it("no confunde identificadores reales", () => {
    expect(isFabricatedId("4d00f3")).toBe(false);
    expect(isFabricatedId("39de58")).toBe(false);
    // MMSI real de nueve cifras.
    expect(isFabricatedId("230987654")).toBe(false);
    expect(isFabricatedId("")).toBe(false);
    expect(isFabricatedId(null)).toBe(false);
    expect(isFabricatedId(undefined)).toBe(false);
  });

  it("cuenta cuántas filas hay que descartar", () => {
    expect(countFabricatedIds(["mock0000", "4d00f3", "mock0001", null])).toBe(2);
    expect(countFabricatedIds(["4d00f3", "39de58"])).toBe(0);
  });
});
