import { describe, expect, it } from "vitest";

import {
  FLIGHT_NO_CLUSTER_MARKER,
  SCALE_MARKER,
  SHIP_NO_CLUSTER_MARKER,
  patchTransportWiring,
} from "./transport-wiring-patch";

/** Copia reducida del visor con las anclas reales, tal como están en main. */
const SOURCE = `import {
  FLIGHT_MODEL_MAX_SCALE,
  FLIGHT_MODEL_RANGE_M,
  SHIP_MODEL_MAX_SCALE,
  SHIP_MODEL_RANGE_M,
  TRANSPORT_MODELS,
  flightModelKind,
  modelHeadingRadians,
  normalizedTrack,
  shipModelKind,
} from "@/lib/transport-models";

const flightGroups = clusterGeoMarkers(
  flights
    .map((flight, index) => ({
      id: \`flight-\${index}\`,
      index,
      lat: flight.latitude,
      lon: flight.longitude,
      flight,
    }))
    .filter((entry) =>
      Number.isFinite(entry.lat) && Number.isFinite(entry.lon)),
  lodCell,
);

const shipGroups = clusterGeoMarkers(
  ships
    .map((ship, index) => ({
      id: \`ship-\${index}\`,
      index,
      lat: ship.latitude,
      lon: ship.longitude,
      ship,
    }))
    .filter((entry) => Number.isFinite(entry.lat) && Number.isFinite(entry.lon)),
  lodCell,
);

const cameraGroups = clusterGeoMarkers(cameras, lodCell);

viewer.entities.add({
  model: {
    uri: TRANSPORT_MODELS[flightModelKind(flight)].url,
    minimumPixelSize: 20,
    maximumScale: FLIGHT_MODEL_MAX_SCALE,
    scale: 1,
    distanceDisplayCondition: new DistanceDisplayCondition(0, FLIGHT_MODEL_RANGE_M),
  },
});

viewer.entities.add({
  model: {
    uri: TRANSPORT_MODELS[shipModelKind(ship)].url,
    minimumPixelSize: 18,
    maximumScale: SHIP_MODEL_MAX_SCALE,
    scale: 1,
    distanceDisplayCondition: new DistanceDisplayCondition(0, SHIP_MODEL_RANGE_M),
  },
});
`;

describe("parche de cableado de transporte", () => {
  it("cablea la escala adaptativa de los dos modelos", () => {
    const { source, changed } = patchTransportWiring(SOURCE);
    expect(changed).toBe(true);
    expect(source).toContain(SCALE_MARKER);
    expect(source.match(/new CallbackProperty\(/g)).toHaveLength(2);
    expect(source).toMatch(/modelScale\(\s*flightModelKind\(flight\),/);
    expect(source).toMatch(/modelScale\(\s*shipModelKind\(ship\),/);
    // La altura y el alto del lienzo son lo que convierte «26 px» en escala.
    expect(source.match(/viewer\.camera\.positionCartographic\?\.height \?\? 0/g)).toHaveLength(2);
    expect(source.match(/viewer\.scene\.canvas\.clientHeight/g)).toHaveLength(2);
    expect(source).not.toContain("scale: 1,");
  });

  it("importa modelScale una sola vez y en orden alfabético", () => {
    const { source } = patchTransportWiring(SOURCE);
    expect(source.match(/^[ \t]*modelScale,[ \t]*$/gm)).toHaveLength(1);
    expect(source).toContain("  modelHeadingRadians,\n  modelScale,\n  normalizedTrack,");
    // Sin línea en blanco de más al insertar.
    expect(source).not.toContain("modelScale,\n\n");
  });

  it("saca vuelos y barcos del agrupador sin tocar el resto", () => {
    const { source } = patchTransportWiring(SOURCE);
    expect(source).toContain(FLIGHT_NO_CLUSTER_MARKER);
    expect(source).toContain(SHIP_NO_CLUSTER_MARKER);
    // Sólo queda una celda: la de cámaras, que sí debe seguir agrupándose.
    expect(source.match(/\blodCell\b/g)).toHaveLength(1);
    expect(source).toContain("clusterGeoMarkers(cameras, lodCell)");
  });

  it("deja la llamada bien cerrada y con su coma", () => {
    const { source } = patchTransportWiring(SOURCE);
    // La sangría del argumento se reutiliza: sólo se cambia el valor.
    expect(source).toMatch(/Number\.isFinite\(entry\.lon\)\),\s*\/\/ Sin agrupador: cada vuelo/);
    expect(source).toMatch(/\/\/ Sin agrupador: cada vuelo[\s\S]*?\n\s*0,\n\);\n\nconst shipGroups/);
  });

  it("es idempotente", () => {
    const first = patchTransportWiring(SOURCE);
    const second = patchTransportWiring(first.source);
    expect(second.changed).toBe(false);
    expect(second.source).toBe(first.source);
  });

  it("se niega a aplicar si falta un bloque de escala", () => {
    const withoutShip = SOURCE.replace(
      /distanceDisplayCondition: new DistanceDisplayCondition\(0, SHIP_MODEL_RANGE_M\),\n/,
      "",
    );
    expect(() => patchTransportWiring(withoutShip)).toThrow(/SHIP_MODEL_RANGE_M/);
  });

  it("se niega si el parche está a medias", () => {
    const half = SOURCE.replace(
      "    scale: 1,\n    distanceDisplayCondition: new DistanceDisplayCondition(0, FLIGHT_MODEL_RANGE_M),",
      `    // ${SCALE_MARKER}`,
    );
    expect(() => patchTransportWiring(half)).toThrow(/a medias/);
  });

  it("no toca nada si las anclas no son las esperadas", () => {
    expect(() => patchTransportWiring("export const nada = 1;\n")).toThrow();
  });
});
