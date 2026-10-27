import { describe, expect, it } from "vitest";
import { aircraftSilhouette } from "./aircraft-silhouette";

describe("silueta del avión según la categoría ADS-B", () => {
  it("las aeronaves con ala fija usan el avión, sea cual sea su peso", () => {
    for (const category of ["A1", "A2", "A3", "A4", "A5", "A6", "B1", "C1"]) {
      expect(aircraftSilhouette(category)).toBe("plane");
    }
  });

  it("A7 es un helicóptero y B2 un globo o dirigible", () => {
    expect(aircraftSilhouette("A7")).toBe("helicopter");
    expect(aircraftSilhouette("B2")).toBe("balloon");
  });

  it("B6 es una aeronave no tripulada", () => {
    expect(aircraftSilhouette("B6")).toBe("drone");
  });

  it("sin categoría o con basura se dibuja el avión por defecto", () => {
    // Un avión genérico es la suposición honesta: inventar un helicóptero
    // concreto que no es sería peor que no distinguir.
    expect(aircraftSilhouette(null)).toBe("plane");
    expect(aircraftSilhouette(undefined)).toBe("plane");
    expect(aircraftSilhouette("")).toBe("plane");
    expect(aircraftSilhouette("??")).toBe("plane");
  });

  it("tolera minúsculas y espacios, que es como llegan a veces del feed", () => {
    expect(aircraftSilhouette(" a7 ")).toBe("helicopter");
    expect(aircraftSilhouette("b6")).toBe("drone");
  });
});
