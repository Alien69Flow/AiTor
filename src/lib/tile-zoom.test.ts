import { describe, expect, it } from "vitest";
import { GLOBE_LAYERS } from "./globe-layers";
import {
  OWM_MAX_LEVEL,
  layerMaxTileLevel,
  overscanLabel,
  tileOverscan,
  tileZoomLevel,
} from "./tile-zoom";

/**
 * El aviso de "estás viendo píxeles estirados" solo sirve si el número que
 * calcula coincide con el que pide Cesium. Estas pruebas fijan la escala en
 * valores conocidos (z0 = 156 543 m/px en el ecuador, cada nivel parte a la
 * mitad) para que un cambio de fórmula no pase inadvertido.
 */
describe("nivel de tesela de la vista", () => {
  it("el nivel 0 es el mundo entero y cada nivel divide la resolución por 2", () => {
    expect(tileZoomLevel(156_543.033_928, 0)).toBeCloseTo(0, 3);
    expect(tileZoomLevel(78_271.516_964, 0)).toBeCloseTo(1, 3);
    expect(tileZoomLevel(2_445.985_061, 0)).toBeCloseTo(6, 2);
  });

  it("a más latitud, la misma resolución corresponde a menos nivel", () => {
    // La resolución de una tesela Mercator es 156 543 · cos(lat) / 2^z: hacia
    // los polos la misma tesela cubre menos terreno, así que para la misma
    // resolución en metros se necesita un nivel menos.
    const equator = tileZoomLevel(1_222.99, 0) ?? 0;
    const north = tileZoomLevel(1_222.99, 60) ?? 0;
    expect(north).toBeLessThan(equator);
    // cos(60°) = 0,5 → exactamente un nivel menos.
    expect(equator - north).toBeCloseTo(1, 1);
  });

  it("no inventa niveles con datos imposibles", () => {
    expect(tileZoomLevel(0, 0)).toBeNull();
    expect(tileZoomLevel(Number.NaN, 0)).toBeNull();
    expect(tileZoomLevel(-5, 0)).toBeNull();
  });
});

describe("tope de teselas por capa", () => {
  it("usa el nivel del TileMatrixSet de GIBS", () => {
    const layer = GLOBE_LAYERS.find((l) => l.key === "clouds");
    expect(layerMaxTileLevel(layer!)).toBe(OWM_MAX_LEVEL);
    const gibs = GLOBE_LAYERS.find((l) => l.key === "ozone");
    expect(layerMaxTileLevel(gibs!)).toBe(6);
  });

  it("las capas que no son de teselas no tienen tope que avisar", () => {
    const points = GLOBE_LAYERS.find((l) => l.key === "gammaIrradiators");
    expect(points).toBeDefined();
    expect(layerMaxTileLevel(points!)).toBeNull();
  });
});

describe("aviso de ampliación por encima del máximo", () => {
  const ozone = GLOBE_LAYERS.find((l) => l.key === "ozone")!;

  it("no avisa mientras la cámara está dentro del rango de la fuente", () => {
    expect(tileOverscan(ozone, 2_445.985, 0)).toBeNull(); // z6
    expect(tileOverscan(ozone, 9_783.94, 0)).toBeNull(); // z4
  });

  it("avisa en cuanto la cámara pide un nivel que la fuente no tiene", () => {
    const overscan = tileOverscan(ozone, 611.496, 0); // z8
    expect(overscan).toEqual({ requested: 8, max: 6, levels: 2 });
    expect(overscanLabel(overscan!)).toBe("z8 > z6");
  });

  it("una capa de OpenWeather aguanta hasta su nivel 10", () => {
    const clouds = GLOBE_LAYERS.find((l) => l.key === "clouds")!;
    expect(tileOverscan(clouds, 2_445.985, 0)).toBeNull(); // z6
    const deep = tileOverscan(clouds, 76.437, 0); // z11
    expect(deep).toEqual({ requested: 11, max: OWM_MAX_LEVEL, levels: 1 });
  });

  it("una capa de puntos nunca avisa de interpolación", () => {
    const points = GLOBE_LAYERS.find((l) => l.key === "gammaIrradiators")!;
    expect(tileOverscan(points, 1, 0)).toBeNull();
  });
});
