import { describe, expect, it } from "vitest";
import {
  CAMERA_PLACES,
  UNPLACEABLE_LOCATIONS,
  cameraCoverage,
  cameraPlace,
  isUnplaceable,
  placedCameras,
} from "./live-camera-places";
import { LIVE_SIGNALS } from "./live-signals";

/**
 * La capa de cámaras del globo es tan buena como esta tabla: si una sede se
 * queda sin entrada, esa cámara desaparece del mapa sin que nada avise. Estas
 * pruebas convierten ese silencio en un fallo.
 */
describe("cámaras del Alien en el globo", () => {
  it("ninguna sede queda sin decidir: o tiene punto o está declarada no situable", () => {
    const undecided = [...new Set(LIVE_SIGNALS.map((s) => s.location))].filter(
      (location) => !CAMERA_PLACES[location] && !isUnplaceable(location),
    );
    expect(undecided).toEqual([]);
  });

  it("no hay entradas de la tabla que no use ninguna cámara", () => {
    const used = new Set(LIVE_SIGNALS.map((s) => s.location));
    const orphan = Object.keys(CAMERA_PLACES).filter((location) => !used.has(location));
    expect(orphan).toEqual([]);
  });

  it("las mismas coordenadas son válidas y no caen en el punto (0, 0)", () => {
    for (const [location, place] of Object.entries(CAMERA_PLACES)) {
      expect(Number.isFinite(place.lat), location).toBe(true);
      expect(Number.isFinite(place.lon), location).toBe(true);
      expect(Math.abs(place.lat), location).toBeLessThanOrEqual(90);
      expect(Math.abs(place.lon), location).toBeLessThanOrEqual(180);
      expect(
        Math.abs(place.lat) + Math.abs(place.lon) > 0.01,
        `${location} está en (0, 0)`,
      ).toBe(true);
    }
  });

  it("una sede no situable no devuelve punto, ni aunque se pida por lista", () => {
    for (const location of UNPLACEABLE_LOCATIONS) {
      expect(CAMERA_PLACES[location], location).toBeUndefined();
      expect(placeFor(location), location).toBeNull();
    }
  });

  it("situar no inventa cámaras: los ids salen de la lista curada y cuadran los totales", () => {
    const cameras = placedCameras();
    const known = new Set(LIVE_SIGNALS.map((s) => s.id));
    expect(cameras.every((camera) => known.has(camera.id))).toBe(true);
    expect(new Set(cameras.map((camera) => camera.id)).size).toBe(cameras.length);

    const coverage = cameraCoverage();
    expect(coverage.placed).toBe(cameras.length);
    expect(coverage.placed + coverage.unplaceable).toBe(coverage.total);
    expect(coverage.total).toBe(LIVE_SIGNALS.length);
  });

  it("mantiene la mayoría del catálogo sobre el mapa", () => {
    // Guarda contra una poda accidental: hoy son 259 de 322, y sólo quedan
    // fuera las sedes orbitales, Marte, «Global» y los canales multi-sede.
    const { placed, total } = cameraCoverage();
    expect(placed).toBeGreaterThan(240);
    expect(placed / total).toBeGreaterThan(0.75);
  });
});

function placeFor(location: string) {
  const signal = LIVE_SIGNALS.find((s) => s.location === location);
  return signal ? cameraPlace(signal) : null;
}
