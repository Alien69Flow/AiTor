import { describe, expect, it } from "vitest";
import {
  AU_PER_UNIT,
  PLANETS,
  displayRadius,
  julianDay,
  normaliseDegrees,
  orbitPath,
  planetState,
  scenePosition,
  solarSystemState,
  solveKepler,
} from "./solar-system";

/**
 * Lo que se comprueba aquí es que el zoom cósmico enseñe el sistema solar de
 * verdad: distancias coherentes con los elementos del JPL y longitudes que
 * cuadran con el calendario. Si alguien cambia un elemento, la prueba lo dice
 * antes de que la escena mienta.
 */

const date = new Date("2026-10-30T12:00:00Z");

describe("ecuación de Kepler", () => {
  it("resuelve la anomalía excéntrica", () => {
    for (const [mean, e] of [
      [0, 0.0167],
      [Math.PI / 2, 0.2056],
      [Math.PI, 0.2488],
      [(3 * Math.PI) / 2, 0.0934],
    ]) {
      const solved = solveKepler(mean, e);
      expect(Math.abs(solved - e * Math.sin(solved) - mean)).toBeLessThan(1e-9);
    }
  });

  it("con excentricidad 0 la anomalía es la media", () => {
    expect(solveKepler(1.1, 0)).toBeCloseTo(1.1, 10);
  });
});

describe("fechas", () => {
  it("el día juliano de J2000 es el de referencia", () => {
    expect(julianDay(new Date("2000-01-01T12:00:00Z"))).toBeCloseTo(2451545, 3);
  });

  it("normaliza ángulos al rango 0-360", () => {
    expect(normaliseDegrees(-10)).toBe(350);
    expect(normaliseDegrees(725)).toBe(5);
  });
});

describe("planetas", () => {
  it("declara los ocho planetas y Plutón, sin repetir", () => {
    expect(PLANETS).toHaveLength(9);
    expect(new Set(PLANETS.map((p) => p.id)).size).toBe(9);
    expect(PLANETS.at(-1)?.name).toBe("Plutón");
  });

  it("la distancia queda dentro del rango que permite su excentricidad", () => {
    for (const planet of PLANETS) {
      // Un año entero de muestras: el afelio y el perihelio tienen que aparecer.
      const distances = Array.from({ length: 120 }, (_, i) => {
        const sample = new Date(Date.UTC(2026, 0, 1) + i * 3 * 86_400_000);
        return planetState(planet, sample).au;
      });
      const perihelion = planet.semiMajorAu * (1 - planet.eccentricity);
      const aphelion = planet.semiMajorAu * (1 + planet.eccentricity);
      expect(Math.min(...distances)).toBeGreaterThanOrEqual(perihelion - 1e-6);
      expect(Math.max(...distances)).toBeLessThanOrEqual(aphelion + 1e-6);
      expect(Math.max(...distances) - Math.min(...distances)).toBeGreaterThan(0);
    }
  });

  it("la Tierra está a ~1 UA y Neptuno a ~30", () => {
    const states = solarSystemState(date);
    const earth = states.find((state) => state.id === "earth")!;
    const neptune = states.find((state) => state.id === "neptune")!;
    expect(earth.au).toBeGreaterThan(0.98);
    expect(earth.au).toBeLessThan(1.02);
    expect(neptune.au).toBeGreaterThan(29.8);
    expect(neptune.au).toBeLessThan(30.4);
  });

  it("en octubre la Tierra mira al otro lado del Sol que en abril", () => {
    // La longitud heliocéntrica de la Tierra avanza ~1°/día: en un semestre
    // tiene que estar casi opuesta. Es la comprobación de que el calendario
    // entra en la cuenta y no es una animación.
    const abril = solarSystemState(new Date("2026-04-30T12:00:00Z"));
    const octubre = solarSystemState(date);
    const diff = Math.abs(
      normaliseDegrees(
        (octubre.find((s) => s.id === "earth")!.longitudeRad * 180) / Math.PI -
          (abril.find((s) => s.id === "earth")!.longitudeRad * 180) / Math.PI,
      ),
    );
    expect(diff).toBeGreaterThan(150);
    expect(diff).toBeLessThan(210);

    // Y a finales de octubre la Tierra está hacia los 30-45° de longitud
    // heliocéntrica (el Sol se ve hacia Escorpio, ~216° geocéntrico).
    const earthDeg = (octubre.find((s) => s.id === "earth")!.longitudeRad * 180) / Math.PI;
    expect(earthDeg).toBeGreaterThan(25);
    expect(earthDeg).toBeLessThan(50);
  });

  it("los tamaños conservan el orden real, con Júpiter por delante", () => {
    const earth = displayRadius(6371);
    const jupiter = displayRadius(69_911);
    const mercury = displayRadius(2439.7);
    expect(jupiter).toBeGreaterThan(earth);
    expect(earth).toBeGreaterThan(mercury);
    expect(jupiter / earth).toBeLessThan(11.2); // se comprime, pero se nota
  });
});

describe("escena", () => {
  it("coloca a Neptuno dentro del encuadre y a Mercurio cerca del Sol", () => {
    const states = solarSystemState(date);
    const neptune = scenePosition(states.find((s) => s.id === "neptune")!);
    const mercury = scenePosition(states.find((s) => s.id === "mercury")!);
    expect(Math.hypot(neptune.x, neptune.z)).toBeCloseTo(30.07 / AU_PER_UNIT, 0);
    expect(Math.hypot(mercury.x, mercury.z)).toBeLessThan(0.5);
  });

  it("la órbita dibujada pasa por la posición real del planeta", () => {
    const earthDef = PLANETS.find((p) => p.id === "earth")!;
    const path = orbitPath(earthDef);
    const state = planetState(earthDef, date);
    const { x, z } = scenePosition(state);
    const nearest = Math.min(...path.map(([px, pz]) => Math.hypot(px - x, pz - z)));
    expect(nearest).toBeLessThan(0.02);
  });

  it("Mercurio dibuja una elipse más excéntrica que Venus", () => {
    const radii = (id: string) => {
      const planet = PLANETS.find((p) => p.id === id)!;
      const distances = orbitPath(planet).map(([x, z]) => Math.hypot(x, z));
      return Math.max(...distances) / Math.min(...distances);
    };
    expect(radii("mercury")).toBeGreaterThan(radii("venus"));
  });
});
