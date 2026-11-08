import { describe, expect, it } from "vitest";

import {
  FLIGHT_NO_CLUSTER_MARKER,
  SCALE_MARKER,
  SHIP_NO_CLUSTER_MARKER,
  patchTransportWiring,
  tidyPatchedTransport,
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

/**
 * Restos que dejó la primera pasada del flujo, tal como se ven en el diff:
 * import en una línea, huecos con espacios y una línea vacía dentro del bloque
 * del modelo, y el comentario del agrupador desalineado con su argumento.
 *
 * El comentario del barco no empieza por la misma palabra que el del vuelo a
 * propósito: la limpieza tiene que depender de dónde está el comentario, no de
 * lo que diga.
 */
const MESSY = `import {
  flightModelKind,
  modelHeadingRadians,  modelScale,

  normalizedTrack,
  shipModelKind,
} from "@/lib/transport-models";

const flightGroups = clusterGeoMarkers(
  flights,
// Sin agrupador: cada vuelo conserva su marca y su etiqueta a cualquier
        // zoom: agruparlo dejaba el indicativo detrás de un «40 aeronaves».
        0,
);

viewer.entities.add({
  model: {
    // ${SCALE_MARKER}: Cesium evalúa este callback en cada fotograma
    scale: new CallbackProperty(
      () =>
        modelScale(
          flightModelKind(flight),
          viewer.camera.positionCartographic?.height ?? 0,
          viewer.scene.canvas.clientHeight,
        ),
      false,
    ),
  

    distanceDisplayCondition: new DistanceDisplayCondition(0, FLIGHT_MODEL_RANGE_M),
  },
});

const shipGroups = clusterGeoMarkers(
  ships,
// Sin agrupador: cada barco conserva su nombre y su marca a cualquier zoom:
        // en un puerto, agruparlos escondía qué barco era cada uno.
        0,
);
`;

describe("parche de cableado de transporte", () => {
  it("cablea la escala adaptativa de los dos modelos", () => {
    const { source, changed } = patchTransportWiring(SOURCE);

    expect(changed).toBe(true);
    expect(source).toContain(SCALE_MARKER);
    expect(source.match(/new CallbackProperty\(/g)).toHaveLength(2);
    expect(source).toMatch(/modelScale\(\s*flightModelKind\(flight\),/);
    expect(source).toMatch(/modelScale\(\s*shipModelKind\(ship\),/);
    expect(source.match(/viewer\.camera\.positionCartographic\?\.height \?\? 0/g)).toHaveLength(2);
    expect(source.match(/viewer\.scene\.canvas\.clientHeight/g)).toHaveLength(2);
    expect(source).not.toContain("scale: 1,");
  });

  it("importa modelScale una sola vez y en su línea", () => {
    const { source } = patchTransportWiring(SOURCE);

    expect(source.match(/modelHeadingRadians,\n[ \t]*modelScale,\n/g)).toHaveLength(1);
    expect(source).toContain("  modelHeadingRadians,\n  modelScale,\n  normalizedTrack,");
    expect(source).not.toContain("modelScale,\n\n");
  });

  it("saca vuelos y barcos del agrupador sin tocar el resto", () => {
    const { source } = patchTransportWiring(SOURCE);

    expect(source).toContain(FLIGHT_NO_CLUSTER_MARKER);
    expect(source).toContain(SHIP_NO_CLUSTER_MARKER);
    expect(source.match(/\blodCell\b/g)).toHaveLength(1);
    expect(source).toContain("clusterGeoMarkers(cameras, lodCell)");
  });

  it("deja la llamada bien cerrada y con su coma", () => {
    const { source } = patchTransportWiring(SOURCE);

    expect(source).toMatch(/Number\.isFinite\(entry\.lon\)\),\s*\/\/ Sin agrupador: cada vuelo/);
    expect(source).toMatch(/\/\/ Sin agrupador: cada vuelo[\s\S]*?\n\s*0,\n\);\n\nconst shipGroups/);
  });

  it("es idempotente sobre un fichero ya limpio", () => {
    const first = patchTransportWiring(SOURCE);
    const second = patchTransportWiring(first.source);

    expect(second.changed).toBe(false);
    expect(second.source).toBe(first.source);
  });

  it("limpia los restos de la primera aplicación", () => {
    const tidy = tidyPatchedTransport(MESSY);

    // El import vuelve a una línea por identificador, sin el hueco detrás.
    expect(tidy).toContain("  modelHeadingRadians,\n  modelScale,\n");
    expect(tidy).not.toContain("modelHeadingRadians,  modelScale");

    // Ni una línea con sólo espacios, ni dentro del bloque del modelo ni en
    // el hueco que quedó entre el cierre y la condición de distancia.
    expect(tidy.split("\n").filter((line) => line.trim() === "" && line !== "")).toHaveLength(0);
    expect(tidy).toMatch(/\),\n {4}distanceDisplayCondition: new DistanceDisplayCondition\(0, FLIGHT_MODEL_RANGE_M\),/);

    // Comentario y `0` alineados con la sangría que ya tenía el argumento,
    // en los dos bloques y diga lo que diga el comentario.
    expect(tidy).toContain("        // Sin agrupador: cada vuelo");
    expect(tidy).toMatch(/\n {8}\/\/ zoom: agruparlo[^\n]*\n {8}0,/);
    expect(tidy).toContain("        // Sin agrupador: cada barco");
    expect(tidy).toMatch(/\n {8}\/\/ en un puerto[^\n]*\n {8}0,/);
  });

  it("reconoce el fichero ya parcheado y lo deja limpio", () => {
    const { source, changed } = patchTransportWiring(MESSY);

    expect(changed).toBe(true);
    expect(source).not.toContain("modelHeadingRadians,  modelScale");
    expect(source.split("\n").filter((line) => line.trim() === "" && line !== "")).toHaveLength(0);
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
