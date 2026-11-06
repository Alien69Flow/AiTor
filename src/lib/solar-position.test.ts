import { describe, expect, it } from "vitest";
import { normalizeLongitude, subsolarPoint } from "./solar-position";

/**
 * El punto subsolar es lo que sitúa la llegada del viento solar en el globo. No
 * se compara contra otra librería sino contra hechos comprobables del Sol: su
 * declinación en los solsticios y equinoccios, y que el punto se desplaza hacia
 * el oeste a 15° por hora.
 */
describe("punto subsolar", () => {
  it("en el equinoccio de marzo el Sol está sobre el ecuador y sobre el meridiano 0 a las 12:00 UTC", () => {
    const point = subsolarPoint(new Date("2026-03-20T12:00:00Z"));
    expect(Math.abs(point.lat)).toBeLessThan(1.5);
    expect(Math.abs(point.lon)).toBeLessThan(3);
  });

  it("en los solsticios la declinación es la inclinación del eje, con su signo", () => {
    const june = subsolarPoint(new Date("2026-06-21T12:00:00Z"));
    const december = subsolarPoint(new Date("2026-12-21T12:00:00Z"));
    expect(june.lat).toBeGreaterThan(22.9);
    expect(june.lat).toBeLessThan(23.6);
    expect(december.lat).toBeLessThan(-22.9);
    expect(december.lat).toBeGreaterThan(-23.6);
    expect(june.declination).toBe(june.lat);
  });

  it("el punto avanza hacia el oeste unos 15° por hora", () => {
    const t0 = new Date("2026-10-27T06:00:00Z").getTime();
    for (let hour = 0; hour < 12; hour++) {
      const a = subsolarPoint(new Date(t0 + hour * 3_600_000));
      const b = subsolarPoint(new Date(t0 + (hour + 1) * 3_600_000));
      const drift = normalizeLongitude(a.lon - b.lon);
      expect(drift, `hora ${hour}`).toBeGreaterThan(14.9);
      expect(drift, `hora ${hour}`).toBeLessThan(15.1);
    }
  });

  it("la longitud se queda siempre dentro de (-180, 180]", () => {
    for (let hour = 0; hour < 48; hour++) {
      const point = subsolarPoint(new Date(Date.parse("2026-10-27T00:00:00Z") + hour * 3_600_000));
      expect(point.lon).toBeGreaterThan(-180.0001);
      expect(point.lon).toBeLessThanOrEqual(180);
    }
  });
});

describe("normalizeLongitude", () => {
  it("envuelve el rango con el signo correcto", () => {
    expect(normalizeLongitude(0)).toBe(0);
    expect(normalizeLongitude(190)).toBeCloseTo(-170, 6);
    expect(normalizeLongitude(-190)).toBeCloseTo(170, 6);
    // El meridiano 180 y el -180 son el mismo; la convención devuelve 180.
    expect(normalizeLongitude(180)).toBe(180);
    expect(normalizeLongitude(-180)).toBe(180);
    expect(normalizeLongitude(540)).toBe(180);
    expect(normalizeLongitude(-540)).toBe(180);
  });
});
