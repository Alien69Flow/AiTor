import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FLIGHT_MODEL_LIMIT,
  FLIGHT_MODEL_MAX_SCALE,
  SHIP_MODEL_LIMIT,
  SHIP_MODEL_MAX_SCALE,
  TRANSPORT_MODELS,
  flightModelKind,
  isHelicopterType,
  modelHeadingRadians,
  normalizedTrack,
  shipModelKind,
} from "./transport-models";

/**
 * Los GLB se generan con un script propio, así que un error de índices o un
 * chunk mal alineado no lo detecta TypeScript: Cesium simplemente no pinta el
 * modelo y el avión desaparece al acercarse. Estas comprobaciones leen el
 * contenedor y comprueban que la geometría declarada existe de verdad.
 */
interface GlbHeader {
  version: number;
  json: {
    meshes: { primitives: { attributes: Record<string, number>; indices: number }[] }[];
    accessors: { count: number; type: string; componentType: number; bufferView: number }[];
    bufferViews: { byteLength: number; byteOffset?: number }[];
    buffers: { byteLength: number }[];
  };
  binLength: number;
}

function readGlb(url: string): GlbHeader {
  const buffer = readFileSync(resolve(process.cwd(), `public${url}`));
  expect(buffer.readUInt32LE(0), `${url} no empieza por glTF`).toBe(0x46546c67);
  expect(buffer.readUInt32LE(4), `${url} no es glTF 2.0`).toBe(2);
  expect(buffer.readUInt32LE(8), `${url} declara otra longitud`).toBe(buffer.length);

  const jsonLength = buffer.readUInt32LE(12);
  const jsonType = buffer.readUInt32LE(16);
  expect(jsonType, `${url} sin chunk JSON`).toBe(0x4e4f534a);
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8"));

  const binOffset = 20 + jsonLength;
  const binLength = buffer.readUInt32LE(binOffset);
  const binType = buffer.readUInt32LE(binOffset + 4);
  expect(binType, `${url} sin chunk BIN`).toBe(0x004e4942);
  expect(json.buffers[0].byteLength, `${url}: BIN y buffer no cuadran`).toBe(binLength);
  expect(binOffset + 8 + binLength, `${url}: sobran o faltan bytes`).toBe(buffer.length);

  return { version: 2, json, binLength };
}

describe("modelos 3D de transporte", () => {
  for (const [kind, model] of Object.entries(TRANSPORT_MODELS)) {
    it(`${kind} es un GLB 2.0 con geometría completa`, () => {
      const glb = readGlb(model.url);
      const primitive = glb.json.meshes[0].primitives[0];
      expect(Object.keys(primitive.attributes)).toEqual(
        expect.arrayContaining(["POSITION", "NORMAL", "COLOR_0"]),
      );

      const positions = glb.json.accessors[primitive.attributes.POSITION];
      const indices = glb.json.accessors[primitive.indices];
      expect(positions.type).toBe("VEC3");
      expect(positions.count).toBeGreaterThan(20);
      expect(indices.type).toBe("SCALAR");
      // Triángulos completos y ningún índice fuera de la lista de vértices.
      expect(indices.count % 3).toBe(0);
      expect(indices.count).toBeGreaterThan(30);

      // Cada accessor apunta a un bufferView que cabe en el BIN.
      for (const accessor of glb.json.accessors) {
        const view = glb.json.bufferViews[accessor.bufferView];
        expect(view.byteLength).toBeGreaterThan(0);
        expect((view.byteOffset ?? 0) + view.byteLength).toBeLessThanOrEqual(glb.binLength);
      }
    });
  }

  it("reconoce helicópteros y no convierte aviones en helicópteros", () => {
    expect(isHelicopterType("EC35")).toBe(true);
    expect(isHelicopterType("b407")).toBe(true);
    expect(isHelicopterType("R44")).toBe(true);
    expect(isHelicopterType("B738")).toBe(false);
    expect(isHelicopterType("A320")).toBe(false);
    expect(isHelicopterType(undefined)).toBe(false);
    expect(isHelicopterType("")).toBe(false);
  });

  it("asigna modelo por tipo de contacto", () => {
    expect(flightModelKind({ aircraftType: "EC45" })).toBe("helicopter");
    expect(flightModelKind({ aircraftType: "A320" })).toBe("airliner");
    expect(flightModelKind({ aircraftType: null })).toBe("airliner");
    expect(shipModelKind({ type: "Cargo" })).toBe("ship");
  });

  it("convierte el rumbo desde el norte al convenio de Cesium", () => {
    const deg = (radians: number) => (radians * 180) / Math.PI;
    // Cesium: heading 0 = este. ADS-B: 90° = este.
    expect(deg(modelHeadingRadians(90))).toBeCloseTo(0, 6);
    expect(deg(modelHeadingRadians(0))).toBeCloseTo(270, 6);
    expect(deg(modelHeadingRadians(180))).toBeCloseTo(90, 6);
    expect(deg(modelHeadingRadians(270))).toBeCloseTo(180, 6);
    // Sin rumbo no se gira al azar: norte por defecto, y nunca NaN.
    expect(deg(modelHeadingRadians(null))).toBeCloseTo(270, 6);
    expect(Number.isFinite(modelHeadingRadians(Number.NaN))).toBe(true);
    expect(modelHeadingRadians(-90)).toBeGreaterThanOrEqual(0);
  });

  it("descarta el 511 de AIS y los rumbos fuera de rango", () => {
    // `HEADING = 511` es «no disponible» en AIS; con el valor crudo el barco
    // salía girado 61° (y el icono, 34°) sin que hubiera rumbo que enseñar.
    expect(normalizedTrack(511)).toBe(0);
    expect(normalizedTrack(-1)).toBe(0);
    expect(normalizedTrack(450)).toBe(0);
    expect(normalizedTrack(Number.NaN)).toBe(0);
    expect(normalizedTrack(null)).toBe(0);
    expect(normalizedTrack(0)).toBe(0);
    expect(normalizedTrack(359.9)).toBe(359.9);
    expect(modelHeadingRadians(511)).toBeCloseTo(modelHeadingRadians(0), 6);
  });

  it("la escala máxima deja ver el modelo justo cuando desaparece el icono", () => {
    // 44 m a 900 km son centésimas de píxel: sin margen de escala, entre el
    // icono y el modelo quedaría una franja sin nada.
    expect(FLIGHT_MODEL_MAX_SCALE).toBeGreaterThan(500);
    expect(SHIP_MODEL_MAX_SCALE).toBeGreaterThan(200);
  });

  it("los topes de modelos son razonables para no colgar la GPU", () => {
    expect(FLIGHT_MODEL_LIMIT).toBeGreaterThan(0);
    expect(FLIGHT_MODEL_LIMIT).toBeLessThanOrEqual(200);
    expect(SHIP_MODEL_LIMIT).toBeGreaterThan(0);
    expect(SHIP_MODEL_LIMIT).toBeLessThanOrEqual(200);
  });
});
