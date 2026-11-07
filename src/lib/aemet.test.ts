import { describe, expect, it } from "vitest";
import {
  TOOLS,
  aemetKeyState,
  parseAemetEnvelope,
  summarizeAemetForecast,
  summarizeAemetObservation,
} from "../../api/mcp";

/**
 * AEMET no se puede probar de punta a punta sin clave, pero sí lo que decide si
 * la respuesta sirve: el sobre de dos pasos y los dos resúmenes. El JSON real
 * trae cientos de nodos por día; lo que se comprueba aquí es que se queda con
 * los cuatro datos útiles y que no inventa números cuando falta el campo.
 */

describe("sobre de AEMET", () => {
  it("acepta un 200 con URL de datos", () => {
    const parsed = parseAemetEnvelope({
      estado: 200,
      descripcion: "exito",
      datos: "https://opendata.aemet.es/opendata/sh/abc",
    });
    expect(parsed).toEqual({ state: "ok", dataUrl: "https://opendata.aemet.es/opendata/sh/abc" });
  });

  it("un 200 sin URL es un error, no un éxito vacío", () => {
    expect(parseAemetEnvelope({ estado: 200, descripcion: "exito" }).state).toBe("error");
    expect(parseAemetEnvelope({ estado: 200, datos: "no-es-una-url" }).state).toBe("error");
  });

  it("conserva el código y el mensaje del error", () => {
    expect(parseAemetEnvelope({ estado: 401, descripcion: "No autorizado" })).toEqual({
      state: "error",
      status: 401,
      message: "No autorizado",
    });
    const sinNada = parseAemetEnvelope({});
    expect(sinNada.state).toBe("error");
    expect(sinNada.state === "error" && sinNada.status).toBe(0);
  });

  it("una clave vacía o con espacios cuenta como ausente", () => {
    expect(aemetKeyState(undefined)).toBe("missing");
    expect(aemetKeyState("   ")).toBe("missing");
    expect(aemetKeyState("abc")).toBe("ok");
  });
});

describe("previsión municipal", () => {
  const payload = [
    {
      municipio: "Madrid",
      provincia: "Madrid",
      prediccion: {
        dia: [
          {
            fecha: "2026-11-08T00:00:00",
            temperatura: { maxima: 18, minima: 7 },
            probPrecipitacion: [{ value: "10" }, { value: "25" }],
          },
          {
            fecha: "2026-11-09T00:00:00",
            temperatura: { maxima: "16", minima: "6" },
            probPrecipitacion: [{ value: "70" }],
          },
        ],
      },
    },
  ];

  it("se queda con los días y el dato útil de cada uno", () => {
    const summary = summarizeAemetForecast(payload);
    expect(summary.municipio).toBe("Madrid");
    expect(summary.dias).toEqual([
      { fecha: "2026-11-08", maxima: 18, minima: 7, lluvia: 10 },
      { fecha: "2026-11-09", maxima: 16, minima: 6, lluvia: 70 },
    ]);
  });

  it("no inventa números cuando falta el campo", () => {
    const summary = summarizeAemetForecast([{ prediccion: { dia: [{ fecha: "2026-11-08T00:00:00" }] } }]);
    expect(summary.dias[0]).toEqual({ fecha: "2026-11-08", maxima: null, minima: null, lluvia: null });
  });

  it("un payload vacío no rompe: devuelve cero días", () => {
    expect(summarizeAemetForecast(null).dias).toEqual([]);
    expect(summarizeAemetForecast([]).municipio).toBe("");
  });

  it("corta a cuatro días aunque AEMET mande más", () => {
    const dia = { fecha: "2026-11-08T00:00:00", temperatura: { maxima: 1, minima: 1 } };
    const summary = summarizeAemetForecast([{ prediccion: { dia: Array(7).fill(dia) } }]);
    expect(summary.dias).toHaveLength(4);
  });
});

describe("observación de estación", () => {
  it("usa la última muestra, no la primera", () => {
    const summary = summarizeAemetObservation([
      { idema: "3195", ubi: "Madrid, Retiro", fint: "2026-11-07T20:00:00", ta: 9.1, hr: 70, vv: 3.4, pres: 1021.5 },
      { idema: "3195", ubi: "Madrid, Retiro", fint: "2026-11-07T21:00:00", ta: 8.4, hr: 74, vv: 2.1, pres: 1021.2 },
    ]);
    expect(summary.muestras).toBe(2);
    expect(summary.ultima).toEqual({
      hora: "2026-11-07T21:00:00",
      temperatura: 8.4,
      humedad: 74,
      viento: 2.1,
      presion: 1021.2,
    });
  });

  it("sin muestras no hay última lectura", () => {
    expect(summarizeAemetObservation([])).toMatchObject({ muestras: 0, ultima: null });
  });
});

describe("catálogo", () => {
  it("publica weather.aemet con acción y código", () => {
    const tool = TOOLS.find((entry) => entry.name === "weather.aemet");
    expect(tool?.minTier).toBe("free");
    const properties = Object.keys(
      (tool?.inputSchema as { properties?: Record<string, unknown> })?.properties ?? {},
    );
    expect(properties).toEqual(["action", "code"]);
  });
});
