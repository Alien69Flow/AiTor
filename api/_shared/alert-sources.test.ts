/**
 * Lectura de las fuentes de alertas, sin red.
 *
 * Cada carga de aquí es la forma real que devuelve el servidor, no una
 * inventada: la de GDELT es literalmente la FeatureCollection de error que
 * contesta cuando limita la IP o no le encaja la consulta, y la de USGS es una
 * fila del feed `all_day` con `time` en milisegundos.
 */
import { describe, expect, it } from "vitest";
import {
  emptySnapshot,
  neededSources,
  parseGdeltTime,
  readGdeltEvents,
  readPrices,
  readQuakes,
} from "./alert-sources";
import type { Alert } from "./alerts";

const coingecko = {
  bitcoin: { usd: 63_891, usd_24h_change: 1.0264 },
  ethereum: { usd: 1_805.56 },
};

const usgs = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "us7000abcd",
      properties: { mag: 2.4, place: "90 km NNW of Aleneva, Alaska", time: 1_795_099_123_952 },
      geometry: { type: "Point", coordinates: [-153.2, 59.9, 41] },
    },
    {
      // Sin magnitud: no sirve para comparar con un umbral.
      type: "Feature",
      id: "sin-magnitud",
      properties: { place: "en algún sitio", time: 1_795_099_123_952 },
      geometry: { type: "Point", coordinates: [0, 0, 10] },
    },
    { type: "Feature", properties: null },
    "basura",
  ],
};

/** Respuesta real de GDELT cuando limita o no entiende la consulta. */
const gdeltError = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [0, 0] },
      properties: {
        name: "ERROR: An unknown error occurred - please try your query again in a few minutes.",
      },
    },
  ],
};

const gdeltOk = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [37.6, 55.7] },
      properties: {
        url: "https://ejemplo.com/nota",
        name: "Moscú, Moscú, Rusia",
        domain: "ejemplo.com",
        urlpubtimedate: "20261119140000",
      },
    },
    {
      // Sin url no es un evento.
      type: "Feature",
      properties: { name: "sin enlace", urlpubtimedate: "20261119140000" },
    },
    {
      // Con url pero sin fecha legible: se conserva con `atIso: null`.
      type: "Feature",
      properties: { url: "https://ejemplo.com/sin-fecha", name: "sin fecha", domain: "ejemplo.com" },
    },
  ],
};

const alert = (overrides: Partial<Alert> = {}): Alert => ({
  kind: "price",
  chatId: 7,
  symbol: "BTC",
  direction: "above",
  price: 100_000,
  createdAt: "2026-11-19T10:00:00.000Z",
  ...(overrides as object),
});

describe("readPrices", () => {
  it("traduce id de CoinGecko a símbolo y deja en null lo que no vino", () => {
    const { prices, changes } = readPrices(coingecko);
    expect(prices.BTC).toBe(63_891);
    expect(changes.BTC).toBeCloseTo(1.0264);
    expect(prices.ETH).toBe(1_805.56);
    // Sin `usd_24h_change` no se inventa un cero: es «sin dato».
    expect(changes.ETH).toBeNull();
    expect(prices.SOL).toBeNull();
  });

  it("un cuerpo que no es objeto deja todo sin dato, sin lanzar", () => {
    for (const payload of [null, "texto", [], 42]) {
      const { prices, changes } = readPrices(payload);
      expect(prices.BTC).toBeNull();
      expect(changes.BTC).toBeNull();
    }
  });
});

describe("readQuakes", () => {
  it("normaliza el feed de USGS y descarta lo que no trae magnitud", () => {
    const quakes = readQuakes(usgs);
    expect(quakes).toHaveLength(1);
    expect(quakes[0]).toMatchObject({ id: "us7000abcd", magnitude: 2.4 });
    expect(quakes[0].place).toContain("Aleneva");
    expect(quakes[0].atIso).toBe(new Date(1_795_099_123_952).toISOString());
  });

  it("sin features devuelve lista vacía", () => {
    expect(readQuakes(gdeltError)).toEqual([]);
    expect(readQuakes({ features: [] })).toEqual([]);
  });
});

describe("parseGdeltTime", () => {
  it("entiende la forma compacta de GKG y la ISO", () => {
    expect(parseGdeltTime("20261119140000")).toBe("2026-11-19T14:00:00.000Z");
    expect(parseGdeltTime("2026-11-19T14:00:00Z")).toBe("2026-11-19T14:00:00.000Z");
    expect(parseGdeltTime("2026-11-19 14:00:00")).toBe("2026-11-19T14:00:00.000Z");
  });

  it("cualquier otra cosa es null: una alerta no se dispara con una fecha que no se entiende", () => {
    expect(parseGdeltTime("ayer")).toBeNull();
    expect(parseGdeltTime("")).toBeNull();
    expect(parseGdeltTime(undefined)).toBeNull();
    expect(parseGdeltTime(20261119)).toBeNull();
    expect(parseGdeltTime("20261342140000")).toBeNull();
  });
});

describe("readGdeltEvents", () => {
  it("la FeatureCollection de error no es un evento", () => {
    expect(readGdeltEvents(gdeltError)).toEqual([]);
  });

  it("conserva los eventos con enlace y deja sin fecha los que no la traen", () => {
    const events = readGdeltEvents(gdeltOk);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      url: "https://ejemplo.com/nota",
      domain: "ejemplo.com",
      atIso: "2026-11-19T14:00:00.000Z",
    });
    expect(events[1].url).toBe("https://ejemplo.com/sin-fecha");
    expect(events[1].atIso).toBeNull();
  });

  it("sin cuerpo válido devuelve lista vacía", () => {
    expect(readGdeltEvents(null)).toEqual([]);
    expect(readGdeltEvents({ error: "GDELT respondió 502" })).toEqual([]);
  });
});

describe("neededSources", () => {
  it("no pide nada sin alertas", () => {
    expect(neededSources([])).toEqual({ market: false, quakes: false, gdeltThemes: [] });
  });

  it("pide sólo lo que alguien ha pedido, y cada tema una vez", () => {
    const alerts: Alert[] = [
      alert(),
      alert({ kind: "move", direction: "below", percent: 5 } as Partial<Alert>),
      alert({ kind: "gdelt", theme: "ARMEDCONFLICT" } as Partial<Alert>),
      alert({ kind: "gdelt", theme: "ARMEDCONFLICT" } as Partial<Alert>),
      alert({ kind: "quake", minMagnitude: 5.5 } as Partial<Alert>),
      alert({ kind: "gdelt", theme: "PROTEST" } as Partial<Alert>),
    ];
    expect(neededSources(alerts)).toEqual({
      market: true,
      quakes: true,
      gdeltThemes: ["ARMEDCONFLICT", "PROTEST"],
    });
  });

  it("con sólo alertas de precio no se consulta ni USGS ni GDELT", () => {
    expect(neededSources([alert()])).toEqual({ market: true, quakes: false, gdeltThemes: [] });
  });
});

describe("emptySnapshot", () => {
  it("empieza vacío y no dispara nada", () => {
    expect(emptySnapshot()).toEqual({ prices: {}, changes: {}, quakes: [], gdelt: {} });
  });
});
