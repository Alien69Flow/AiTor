import { describe, expect, it } from "vitest";
import {
  TERRAIN_GRID,
  TERRAIN_MAX_LEVEL,
  decodeTerrarium,
  resolveTerrainTile,
  terrariumTileUrl,
} from "./terrarium-terrain";

/**
 * La codificación Terrarium es el único sitio donde un error aritmético pasa
 * desapercibido: el globo se vería con montañas donde no las hay y nadie sabría
 * por qué. Estas pruebas fijan los tres puntos que importan —nivel del mar,
 * altura conocida y profundidad— con píxeles escritos a mano.
 */
function pixel(heightMetres: number): [number, number, number, number] {
  const value = Math.round((heightMetres + 32768) * 256);
  const r = Math.floor(value / 65536) % 256;
  const g = Math.floor(value / 256) % 256;
  const b = value % 256;
  return [r, g, b, 255];
}

function rgba(...pixels: [number, number, number, number][]): Uint8ClampedArray {
  return new Uint8ClampedArray(pixels.flat());
}

describe("decodificación de teselas Terrarium", () => {
  it("el nivel del mar cae en 0 m", () => {
    expect(Array.from(decodeTerrarium(rgba(pixel(0)), 1))).toEqual([0]);
  });

  it("una altura positiva se lee en metros", () => {
    expect(decodeTerrarium(rgba(pixel(3404)), 1)[0]).toBeCloseTo(3404, 0);
  });

  it("la batimetría negativa se respeta, no se recorta", () => {
    expect(decodeTerrarium(rgba(pixel(-4100)), 1)[0]).toBeCloseTo(-4100, 0);
  });

  it("decodifica la rejilla completa en orden", () => {
    const samples = 4;
    const grid = decodeTerrarium(rgba(pixel(0), pixel(100), pixel(2000), pixel(-50)), samples);
    expect(grid).toHaveLength(samples);
    expect(Array.from(grid).map((h) => Math.round(h))).toEqual([0, 100, 2000, -50]);
  });

  it("la rejilla que se le entrega a Cesium es 65×65 y el tope es el último nivel real de la fuente", () => {
    expect(TERRAIN_GRID).toBe(65);
    // La fuente publica hasta z15; por encima de eso se remuestrea el antecesor.
    expect(TERRAIN_MAX_LEVEL).toBe(15);
  });

  it("la URL es la del proyecto abierto, sin clave", () => {
    expect(terrariumTileUrl(32, 24, 6)).toBe(
      "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/6/32/24.png",
    );
  });
});

describe("tesela de la que se lee el relieve", () => {
  it("por encima del último nivel usa la misma tesela y sin recorte", () => {
    const tile = resolveTerrainTile(100, 200, 9);
    expect(tile).toEqual({
      sourceLevel: 9,
      sourceX: 100,
      sourceY: 200,
      span: 1,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it("al ampliar por encima del tope sube al antecesor y recorta su sub-región", () => {
    // Nivel 15 = tope + 2: cuatro descendientes por lado dentro del antecesor
    // del nivel 13, así que (103, 206) cae en el offset (3, 2).
    const tile = resolveTerrainTile(103, 206, TERRAIN_MAX_LEVEL + 2);
    expect(tile.sourceLevel).toBe(TERRAIN_MAX_LEVEL);
    expect(tile.sourceX).toBe(25);
    expect(tile.sourceY).toBe(51);
    expect(tile.span).toBe(4);
    expect(tile.offsetX).toBe(3);
    expect(tile.offsetY).toBe(2);
  });

  it("el offset nunca sale de la tesela del antecesor", () => {
    for (let x = 0; x < 16; x++) {
      const tile = resolveTerrainTile(x, 0, TERRAIN_MAX_LEVEL + 2);
      expect(tile.offsetX).toBeGreaterThanOrEqual(0);
      expect(tile.offsetX).toBeLessThan(tile.span);
    }
  });

  it("se puede forzar un antecesor más somero para las teselas que no existen", () => {
    const tile = resolveTerrainTile(103, 206, TERRAIN_MAX_LEVEL + 2, TERRAIN_MAX_LEVEL - 1);
    expect(tile.sourceLevel).toBe(TERRAIN_MAX_LEVEL - 1);
    expect(tile.sourceX).toBe(12);
    expect(tile.span).toBe(8);
    expect(tile.offsetX).toBe(7);
  });
});
