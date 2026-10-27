import { describe, expect, it } from "vitest";
import {
  BELT_RANGES,
  MAGNETIC_POLE,
  RING_RADII,
  beltForRadius,
  beltRing,
  beltRings,
  dipoleAxis,
  dipoleEquatorBasis,
} from "./van-allen-belts";

/**
 * La geometría de los cinturones se prueba aquí y no en el globo porque es lo
 * único comprobable sin abrir Cesium: que los anillos estén a la distancia
 * correcta y en el plano del ecuador magnético, no en el geográfico.
 */
describe("cinturones de Van Allen", () => {
  it("declara los dos cinturones con sus rangos reales", () => {
    expect(BELT_RANGES.map((belt) => belt.id)).toEqual(["inner", "outer"]);
    expect(BELT_RANGES[0].fromEarth).toBe(1.2);
    expect(BELT_RANGES[0].toEarth).toBe(2.5);
    expect(BELT_RANGES[1].fromEarth).toBe(3.0);
    expect(BELT_RANGES[1].toEarth).toBe(8.0);
  });

  it("dibuja anillos dentro del rango de cada cinturón", () => {
    for (const belt of BELT_RANGES) {
      for (const radius of RING_RADII[belt.id]) {
        expect(radius, belt.id).toBeGreaterThanOrEqual(belt.fromEarth);
        expect(radius, belt.id).toBeLessThanOrEqual(belt.toEarth);
      }
    }
  });

  it("un anillo tiene los puntos pedidos y todos a su radio", () => {
    const ring = beltRing(3.5, 60);
    expect(ring.points).toHaveLength(60);
    for (const point of ring.points) {
      expect(Math.hypot(point.x, point.y, point.z)).toBeCloseTo(3.5, 6);
    }
  });

  it("el plano del anillo es el del ecuador magnético, no el geográfico", () => {
    const axis = dipoleAxis();
    const ring = beltRing(5.5, 120);
    for (const point of ring.points) {
      const dot = point.x * axis.x + point.y * axis.y + point.z * axis.z;
      expect(Math.abs(dot)).toBeLessThan(1e-9);
    }
    // Un anillo en el ecuador geográfico tendría z = 0 en todos sus puntos. Este
    // sale del plano XY: su altura máxima es el radio por el seno de la
    // inclinación, que es la firma de estar en el ecuador magnético.
    const maxZ = Math.max(...ring.points.map((p) => Math.abs(p.z)));
    expect(maxZ).toBeCloseTo(5.5 * Math.sqrt(1 - axis.z ** 2), 6);
    expect(maxZ).toBeGreaterThan(0.8);
  });

  it("el polo declarado está a 9,4° del eje de rotación", () => {
    // De ahí sale la inclinación del plano de los cinturones: 90° menos la
    // latitud del polo geomagnético.
    expect(90 - MAGNETIC_POLE.lat).toBeCloseTo(9.35, 2);
  });

  it("el eje del dipolo es unitario y está junto al polo magnético declarado", () => {
    const axis = dipoleAxis();
    expect(Math.hypot(axis.x, axis.y, axis.z)).toBeCloseTo(1, 9);
    const lat = (Math.asin(axis.z) * 180) / Math.PI;
    const lon = (Math.atan2(axis.y, axis.x) * 180) / Math.PI;
    expect(lat).toBeCloseTo(MAGNETIC_POLE.lat, 6);
    expect(lon).toBeCloseTo(MAGNETIC_POLE.lon, 6);
  });

  it("la base del plano es ortonormal y perpendicular al eje", () => {
    const axis = dipoleAxis();
    const { u, v } = dipoleEquatorBasis(axis);
    for (const vector of [u, v]) {
      expect(Math.hypot(vector.x, vector.y, vector.z)).toBeCloseTo(1, 9);
      expect(vector.x * axis.x + vector.y * axis.y + vector.z * axis.z).toBeCloseTo(0, 9);
    }
    expect(u.x * v.x + u.y * v.y + u.z * v.z).toBeCloseTo(0, 9);
  });

  it("resuelve a qué cinturón pertenece un radio", () => {
    expect(beltForRadius(1.5)).toBe("inner");
    expect(beltForRadius(2.5)).toBe("inner");
    expect(beltForRadius(3)).toBe("outer");
    expect(beltForRadius(6.6)).toBe("outer");
    expect(beltForRadius(8)).toBe("outer");
    expect(beltForRadius(1)).toBeNull();
    expect(beltForRadius(9.5)).toBeNull();
  });

  it("la órbita geoestacionaria cae dentro del cinturón exterior", () => {
    // De ahí que GOES pueda medir el cinturón en el que está: 6,6 R⊕.
    expect(beltForRadius(6.6)).toBe("outer");
    expect(RING_RADII.outer).toContain(8.0);
    expect(beltRings("outer")).toHaveLength(3);
    expect(beltRings("inner")).toHaveLength(3);
  });
});
