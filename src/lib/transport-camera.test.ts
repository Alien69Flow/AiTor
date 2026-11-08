/**
 * Escala de los modelos 3D por altura de cámara y clasificación de buques.
 *
 * Dos cosas se comprueban aquí sin Cesium delante:
 *
 * 1. Que la escala crece con la altura y no se sale nunca de su rango. Antes
 *    era un número fijo por tipo, y por eso de cerca el avión medía kilómetros
 *    y de lejos desaparecía.
 * 2. Que cada tipo de buque cae en la clase que le toca, y que ningún barco
 *    pide un modelo que no exista: un GLB que falta no se ve como un error,
 *    se ve como un barco que se borra al acercarse.
 */
import { describe, expect, it } from "vitest";
import {
  CESIUM_DEFAULT_FOV_Y,
  FLIGHT_MODEL_MAX_SCALE,
  FLIGHT_MODEL_RANGE_M,
  SHIP_MODEL_MAX_SCALE,
  SHIP_MODEL_RANGE_M,
  TRANSPORT_MODELS,
  isTransportModelKind,
  modelScale,
  modelScaleForCamera,
  shipClassOf,
  shipModelKind,
} from "./transport-models";

const VIEWPORT = 900;
const HEIGHTS = [2_000, 5_000, 20_000, 100_000, 400_000, 900_000, 1_800_000, 2_600_000];

describe("escala de los modelos por altura de cámara", () => {
  it("de cerca el modelo está a escala real", () => {
    // A 2 km un avión de 45 m ocupa en pantalla más de lo que mide el objetivo:
    // la escala baja a 1 y no se encoge por debajo de su tamaño real.
    expect(modelScale("airliner", 2_000, VIEWPORT)).toBe(1);
    expect(modelScale("ship", 3_000, VIEWPORT)).toBe(1);
  });

  it("crece con la altura, sin saltos ni retrocesos", () => {
    let previous = 0;
    for (const height of HEIGHTS) {
      const scale = modelScale("airliner", height, VIEWPORT);
      expect(scale).toBeGreaterThanOrEqual(previous);
      previous = scale;
    }
    expect(previous).toBeGreaterThan(100);
  });

  it("a su distancia máxima el modelo se ve y aún no está topado", () => {
    // Si llegara ya topado, el avión sería una pieza gigante con perspectiva
    // imposible justo al entrar en escena.
    const flight = modelScale("airliner", FLIGHT_MODEL_RANGE_M, VIEWPORT);
    expect(flight).toBeGreaterThan(200);
    expect(flight).toBeLessThan(FLIGHT_MODEL_MAX_SCALE);

    const ship = modelScale("ship", SHIP_MODEL_RANGE_M, VIEWPORT);
    expect(ship).toBeGreaterThan(100);
    expect(ship).toBeLessThan(SHIP_MODEL_MAX_SCALE);
  });

  it("nunca devuelve NaN ni se sale del rango [1, tope]", () => {
    const absurdHeights = [1, 1e9, Number.NaN, Number.POSITIVE_INFINITY, 0, -5];
    const viewports = [1, 240, VIEWPORT, 4_320, 0, Number.NaN];
    for (const height of absurdHeights) {
      for (const viewport of viewports) {
        for (const kind of ["airliner", "helicopter", "ship"] as const) {
          const scale = modelScale(kind, height, viewport);
          const cap = kind === "ship" ? SHIP_MODEL_MAX_SCALE : FLIGHT_MODEL_MAX_SCALE;
          expect(Number.isFinite(scale)).toBe(true);
          expect(scale).toBeGreaterThanOrEqual(1);
          expect(scale).toBeLessThanOrEqual(cap);
        }
      }
    }
  });

  it("un canvas más bajo necesita más escala para el mismo tamaño aparente", () => {
    // El móvil en vertical tiene menos píxeles de alto: si no se compensa, el
    // avión se ve la mitad de grande que en el portátil.
    const small = modelScale("airliner", 400_000, 400);
    const large = modelScale("airliner", 400_000, 1_200);
    expect(small).toBeGreaterThan(large);
    expect(small / large).toBeCloseTo(3, 1);
  });

  it("el objetivo en píxeles se cumple a mano", () => {
    // metrosPorPíxel a 400 km con fov 60° y 900 px de alto.
    const metersPerPixel = (2 * 400_000 * Math.tan(CESIUM_DEFAULT_FOV_Y / 2)) / VIEWPORT;
    const expected = (26 * metersPerPixel) / TRANSPORT_MODELS.airliner.lengthM;
    expect(modelScaleForCamera({
      cameraHeightM: 400_000,
      viewportHeightPx: VIEWPORT,
      lengthM: TRANSPORT_MODELS.airliner.lengthM,
      targetPx: 26,
    })).toBeCloseTo(expected, 3);
  });
});

describe("clasificación de buques por tipo AIS", () => {
  it("lee los códigos numéricos de AIS", () => {
    expect(shipClassOf("80")).toBe("tanker");
    expect(shipClassOf(89)).toBe("tanker");
    expect(shipClassOf("70")).toBe("cargo");
    expect(shipClassOf("79")).toBe("cargo");
    expect(shipClassOf("60")).toBe("ferry");
    expect(shipClassOf("69")).toBe("ferry");
    expect(shipClassOf("30")).toBe("other");
    expect(shipClassOf("511")).toBe("other");
  });

  it("lee los nombres que publican los agregadores", () => {
    expect(shipClassOf("Tanker")).toBe("tanker");
    expect(shipClassOf("Oil Products Tanker")).toBe("tanker");
    expect(shipClassOf("LNG Carrier")).toBe("tanker");
    expect(shipClassOf("Container Ship")).toBe("container");
    expect(shipClassOf("Portacontenedores")).toBe("container");
    expect(shipClassOf("Ro-Ro")).toBe("ferry");
    expect(shipClassOf("Passenger")).toBe("ferry");
    expect(shipClassOf("Cruise")).toBe("ferry");
    expect(shipClassOf("Bulk Carrier")).toBe("cargo");
    expect(shipClassOf("Cargo")).toBe("cargo");
  });

  it("lo desconocido no se inventa", () => {
    expect(shipClassOf("")).toBe("other");
    expect(shipClassOf(null)).toBe("other");
    expect(shipClassOf(undefined)).toBe("other");
    expect(shipClassOf("Pilot vessel")).toBe("other");
    expect(shipClassOf("Tug")).toBe("other");
  });

  it("ningún barco pide un GLB que no exista", () => {
    // Hoy sólo hay carguero: petrolero, portacontenedores y ferry caen en él
    // hasta que el generador cree sus modelos. La comprobación es la garantía
    // de que este módulo no puede provocar un 404 de modelo.
    const types = ["Tanker", "Container Ship", "Ro-Ro", "Cargo", "Tug", "80", "70", "60", ""];
    for (const type of types) {
      const kind = shipModelKind({ type });
      expect(isTransportModelKind(kind)).toBe(true);
      expect(TRANSPORT_MODELS[kind].url.startsWith("/models/")).toBe(true);
    }
    expect(shipModelKind({ type: "Tanker" })).toBe("ship");
    expect(shipModelKind({ type: "Container Ship" })).toBe("ship");
    expect(shipModelKind({ type: "Ro-Ro" })).toBe("ship");
    expect(shipModelKind(null)).toBe("ship");
  });

  it("los umbrales dejan ver los modelos desde más lejos que antes", () => {
    // Antes 900 km y 700 km: el modelo desaparecía al alejar a vista de
    // continente. Y deben seguir por debajo de la vista completa del globo.
    expect(FLIGHT_MODEL_RANGE_M).toBeGreaterThan(900_000);
    expect(SHIP_MODEL_RANGE_M).toBeGreaterThan(700_000);
    expect(FLIGHT_MODEL_RANGE_M).toBeLessThan(6_000_000);
    expect(SHIP_MODEL_RANGE_M).toBeLessThan(6_000_000);
  });
});
