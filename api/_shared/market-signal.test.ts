import { describe, expect, it, vi } from "vitest";
import {
  fetchSignal,
  formatSignalHtml,
  formatSignalUnavailableHtml,
  humanAge,
  parseMarketSignal,
  parseSignal,
  parseSignalSymbol,
  SignalError,
  signalAgeSeconds,
  signalSourceUrl,
} from "./market-signal.js";

/** Lo que importa: que salga precio con fuente y dos horas, y que sin fuente no salga cifra. */

const NOW = new Date("2026-11-23T00:34:28.829Z");
const SOURCE_PAYLOAD = { bitcoin: { usd: 61241, last_updated_at: 1795394027 } };

function fetchStub(response: Partial<Response> | Error) {
  return vi.fn(async () => {
    if (response instanceof Error) throw response;
    return {
      ok: true,
      status: 200,
      json: async () => SOURCE_PAYLOAD,
      ...response,
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

describe("símbolos", () => {
  it("normaliza y acepta sólo los conocidos", () => {
    expect(parseSignalSymbol(" btc ")).toBe("BTC");
    expect(parseSignalSymbol("ETH")).toBe("ETH");
    expect(parseSignalSymbol("DOGE")).toBeNull();
    expect(parseSignalSymbol(null)).toBeNull();
  });

  it("la URL de la fuente lleva el id y la hora del dato", () => {
    const url = new URL(signalSourceUrl("BTC"));
    expect(url.host).toBe("api.coingecko.com");
    expect(url.searchParams.get("ids")).toBe("bitcoin");
    expect(url.searchParams.get("include_last_updated_at")).toBe("true");
  });
});

describe("parseSignal", () => {
  it("devuelve precio, fuente y las dos horas", () => {
    const signal = parseSignal("BTC", SOURCE_PAYLOAD, NOW);
    expect(signal).toMatchObject({
      symbol: "BTC",
      priceUsd: 61241,
      asOf: "2026-11-23T00:33:47.000Z",
      fetchedAt: "2026-11-23T00:34:28.829Z",
      sourceName: "CoinGecko",
    });
    expect(signal?.source).toContain("ids=bitcoin");
  });

  it("sin precio no hay señal (no se rellena con cero)", () => {
    expect(parseSignal("BTC", { bitcoin: {} }, NOW)).toBeNull();
    expect(parseSignal("BTC", { bitcoin: { usd: 0 } }, NOW)).toBeNull();
    expect(parseSignal("BTC", null, NOW)).toBeNull();
  });

  it("sin hora de la fuente usa la de la lectura", () => {
    const signal = parseSignal("BTC", { bitcoin: { usd: 100 } }, NOW);
    expect(signal?.asOf).toBe("2026-11-23T00:34:28.829Z");
  });
});

describe("parseMarketSignal", () => {
  const valid = {
    symbol: "BTC",
    id: "bitcoin",
    priceUsd: 61241,
    asOf: "2026-11-23T00:33:47.000Z",
    fetchedAt: "2026-11-23T00:34:28.829Z",
    source: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin",
    sourceName: "CoinGecko",
  };

  it("acepta una señal completa", () => {
    expect(parseMarketSignal(valid)?.priceUsd).toBe(61241);
  });

  it("rechaza precio no numérico, fechas falsas y fuente que no es https", () => {
    expect(parseMarketSignal({ ...valid, priceUsd: "mucho" })).toBeNull();
    expect(parseMarketSignal({ ...valid, asOf: "ayer" })).toBeNull();
    expect(parseMarketSignal({ ...valid, source: "ftp://x" })).toBeNull();
    expect(parseMarketSignal({ ...valid, symbol: "DOGE" })).toBeNull();
  });
});

describe("fetchSignal", () => {
  it("pide la fuente con user-agent y devuelve la señal", async () => {
    const fetchImpl = fetchStub({});
    const signal = await fetchSignal("BTC", { fetchImpl, now: () => NOW });
    expect(signal.priceUsd).toBe(61241);
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("ids=bitcoin"),
      expect.objectContaining({ headers: expect.objectContaining({ "user-agent": expect.any(String) }) }),
    );
  });

  it("HTTP malo es SignalError de fuente, no una cifra", async () => {
    const fetchImpl = fetchStub({ ok: false, status: 429 });
    await expect(fetchSignal("BTC", { fetchImpl, now: () => NOW })).rejects.toMatchObject({
      code: "source",
      message: expect.stringContaining("429"),
    });
    await expect(fetchSignal("BTC", { fetchImpl, now: () => NOW })).rejects.toBeInstanceOf(SignalError);
  });

  it("una respuesta sin precio es SignalError de forma", async () => {
    const fetchImpl = fetchStub({ json: async () => ({ bitcoin: {} }) });
    await expect(fetchSignal("BTC", { fetchImpl, now: () => NOW })).rejects.toMatchObject({
      code: "shape",
    });
  });

  it("una caída de red también se cuenta", async () => {
    const fetchImpl = fetchStub(new TypeError("fetch failed"));
    await expect(fetchSignal("BTC", { fetchImpl, now: () => NOW })).rejects.toMatchObject({
      code: "source",
    });
  });
});

describe("mensajes", () => {
  const signal = {
    symbol: "BTC" as const,
    id: "bitcoin",
    priceUsd: 61241,
    asOf: "2026-11-23T00:33:47.000Z",
    fetchedAt: "2026-11-23T00:34:28.829Z",
    source: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    sourceName: "CoinGecko",
  };

  it("el mensaje lleva precio, enlace a la fuente y las dos horas", () => {
    const html = formatSignalHtml(signal, Date.parse(signal.fetchedAt) + 12_000);
    expect(html).toContain("BTC");
    expect(html).toContain("61.241,00");
    expect(html).toContain('href="https://api.coingecko.com');
    expect(html).toContain("&amp;vs_currencies=usd");
    expect(html).toContain("2026-11-23T00:33:47.000Z");
    expect(html).toContain("hace 12 s");
  });

  it("avisa cuando el dato es viejo", () => {
    const html = formatSignalHtml(signal, Date.parse(signal.fetchedAt) + 900_000);
    expect(html).toContain("dato viejo");
  });

  it("sin señal se dice el motivo, sin cifras", () => {
    const html = formatSignalUnavailableHtml("BTC", "la fuente no respondió: timeout");
    expect(html).toContain("Sin señal de BTC");
    expect(html).toContain("timeout");
    expect(html).not.toMatch(/\$\d/);
  });

  it("un símbolo desconocido lista los válidos", () => {
    const html = formatSignalUnavailableHtml("DOGE", "symbol");
    expect(html).toContain("BTC, ETH, SOL, TON");
    expect(html).toContain("/senal BTC");
  });

  it("la antigüedad es humana y nunca negativa", () => {
    expect(humanAge(0)).toBe("ahora mismo");
    expect(humanAge(90)).toBe("hace 2 min");
    expect(signalAgeSeconds({ fetchedAt: "no es fecha" })).toBe(Number.POSITIVE_INFINITY);
    expect(signalAgeSeconds(signal, Date.parse(signal.fetchedAt) - 5_000)).toBe(0);
  });
});
