import { describe, expect, it } from "vitest";
import {
  LOCAL_GROUP,
  LOCAL_STARS,
  MPC_IN_MLY,
  STAGE_FACTS,
  SUPERCLUSTER_NODES,
  VIRGO_CENTER,
  VIRGO_MEMBERS,
  equatorialToCartesian,
} from "./cosmic-objects";

const distanceOf = ([x, y, z]: [number, number, number]) => Math.hypot(x, y, z);

/**
 * Los catálogos alimentan lo que se dibuja en el zoom cósmico: si una distancia
 * o una coordenada se va, el peldaño entero miente. Estas pruebas fijan los
 * valores publicados que usa la escena.
 */
describe("catálogo del vecindario solar", () => {
  it("Próxima Centauri está a 4,246 años luz del origen", () => {
    const proxima = LOCAL_STARS.find((star) => star.name === "Próxima Centauri")!;
    expect(distanceOf(equatorialToCartesian(proxima.ra, proxima.dec, proxima.ly))).toBeCloseTo(4.246, 3);
  });

  it("todas las estrellas del catálogo están a menos de 17 al", () => {
    expect(LOCAL_STARS.length).toBeGreaterThanOrEqual(20);
    for (const star of LOCAL_STARS) {
      expect(star.ly).toBeGreaterThan(4);
      expect(star.ly).toBeLessThan(17);
    }
  });

  it("las coordenadas separan las dos Alfa Centauri lo que toca", () => {
    const [a, b] = ["Alfa Centauri A/B", "Próxima Centauri"].map((name) => {
      const star = LOCAL_STARS.find((entry) => entry.name === name)!;
      return equatorialToCartesian(star.ra, star.dec, star.ly);
    });
    // Comparten dirección a ~2°, así que la separación real ronda 0,2 al.
    expect(distanceOf([a[0] - b[0], a[1] - b[1], a[2] - b[2]])).toBeLessThan(1);
  });
});

describe("catálogo del Grupo Local", () => {
  it("Andrómeda está a 2,54 Mal del origen", () => {
    const andromeda = LOCAL_GROUP.find((galaxy) => galaxy.name.includes("Andrómeda"))!;
    expect(
      distanceOf(equatorialToCartesian(andromeda.ra, andromeda.dec, andromeda.mly)),
    ).toBeCloseTo(2.537, 3);
  });

  it("la Vía Láctea es el origen y hay miembros cercanos", () => {
    const milkyWay = LOCAL_GROUP.find((galaxy) => galaxy.name === "Vía Láctea")!;
    expect(milkyWay.mly).toBe(0);
    const lmc = LOCAL_GROUP.find((galaxy) => galaxy.name.includes("Mayor"))!;
    expect(lmc.mly).toBeLessThan(0.2);
  });
});

describe("catálogo del supercúmulo", () => {
  it("Virgo está a 16,5 Mpc, que son 53,8 millones de años luz", () => {
    expect(VIRGO_CENTER.mpc * MPC_IN_MLY).toBeCloseTo(53.8, 0);
  });

  it("los nodos están ordenados por distancia y Coma es el más lejano", () => {
    const distances = SUPERCLUSTER_NODES.map((node) => node.mly);
    expect([...distances].sort((a, b) => a - b)).toEqual(distances);
    expect(distances[distances.length - 1]).toBe(321);
  });

  it("los miembros de Virgo caen en un cúmulo aparente (menos de 10°)", () => {
    for (const member of VIRGO_MEMBERS) {
      const dRa = Math.abs(member.ra - VIRGO_CENTER.ra) * 15;
      const dDec = Math.abs(member.dec - VIRGO_CENTER.dec);
      expect(dRa).toBeLessThan(10);
      expect(dDec).toBeLessThan(10);
    }
  });
});

describe("panel de datos por escalón", () => {
  it("cubre los peldaños nuevos", () => {
    for (const id of ["oort", "neighborhood", "localgroup", "virgo", "supercluster", "universe"]) {
      expect(STAGE_FACTS[id]).toBeDefined();
      expect(STAGE_FACTS[id].rows.length).toBeGreaterThan(3);
    }
  });
});
