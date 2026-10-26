import { describe, expect, it } from "vitest";
import {
  classifyProbe,
  looksLikeNetworkFailure,
  oembedUrl,
  probeSignal,
  renderStatusModule,
  thumbUrl,
  watchUrl,
} from "./live-probe.mjs";

const json = (status = 200, body = "{}") =>
  new Response(body, { status, headers: { "content-type": "application/json" } });

const text = (status, body) => new Response(body, { status, headers: { "content-type": "text/html" } });

/** Fetch simulado: distingue oembed, póster y página de visionado por la URL. */
function stubFetch({ oembed = 200, thumb = 200, watch = 200, watchHtml = "", throwOn = null } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const href = String(url);
    calls.push({ href, method: init.method ?? "GET" });
    if (throwOn && href.includes(throwOn)) throw new Error("network down");
    if (href.includes("/oembed")) return json(oembed);
    if (href.includes("ytimg.com")) return new Response("", { status: thumb });
    if (href.includes("youtube.com/watch")) return text(watch, watchHtml);
    throw new Error(`URL inesperada: ${href}`);
  };
  return { fetchImpl, calls };
}

const signal = { id: "iss-live", videoId: "M3HKLzjvKPc" };

describe("URLs de la sonda", () => {
  it("codifica el id en oembed y usa hqdefault como póster", () => {
    expect(oembedUrl("abc")).toContain(encodeURIComponent("https://www.youtube.com/watch?v=abc"));
    expect(oembedUrl("abc")).toContain("format=json");
    expect(thumbUrl("abc")).toBe("https://i.ytimg.com/vi/abc/hqdefault.jpg");
    expect(watchUrl("abc")).toBe("https://www.youtube.com/watch?v=abc");
  });
});

describe("probeSignal", () => {
  it("marca en directo cuando la página trae isLiveNow", async () => {
    const { fetchImpl } = stubFetch({ watchHtml: '{"isLiveNow":true,"videoId":"x"}' });
    const result = await probeSignal(signal, { fetchImpl });
    expect(result.embeddable).toBe(true);
    expect(result.thumbnail).toBe(true);
    expect(result.live).toBe(true);
    expect(classifyProbe(result)).toBe("live");
  });

  it("acepta hlsManifestUrl como señal de emisión", async () => {
    const { fetchImpl } = stubFetch({ watchHtml: '{"hlsManifestUrl":"https://x/live.m3u8"}' });
    expect((await probeSignal(signal, { fetchImpl })).live).toBe(true);
  });

  it("marca sin emisión un vídeo incrustable que ya no está en directo", async () => {
    const { fetchImpl } = stubFetch({ watchHtml: '{"isLiveNow":false}' });
    const result = await probeSignal(signal, { fetchImpl });
    expect(result.live).toBe(false);
    expect(classifyProbe(result)).toBe("offline");
  });

  it("no declara sin emisión si el dueño no permite incrustar", async () => {
    const { fetchImpl } = stubFetch({ oembed: 401, watchHtml: '{"isLiveNow":false}' });
    const result = await probeSignal(signal, { fetchImpl });
    expect(result.embeddable).toBe(false);
    expect(classifyProbe(result)).toBe("unknown");
  });

  it("reintenta el póster con GET cuando el CDN rechaza HEAD", async () => {
    const calls = [];
    const fetchImpl = async (url, init = {}) => {
      const href = String(url);
      calls.push({ href, method: init.method ?? "GET" });
      if (href.includes("/oembed")) return json(200);
      if (href.includes("ytimg.com")) {
        return new Response("", { status: (init.method ?? "GET") === "HEAD" ? 405 : 200 });
      }
      return text(200, '{"isLiveNow":true}');
    };
    const result = await probeSignal(signal, { fetchImpl });
    expect(result.thumbnail).toBe(true);
    expect(calls.filter((call) => call.href.includes("ytimg.com")).map((call) => call.method)).toEqual([
      "HEAD",
      "GET",
    ]);
  });

  it("devuelve unknown en vez de lanzar cuando la red falla", async () => {
    const { fetchImpl } = stubFetch({ throwOn: "youtube.com" });
    const result = await probeSignal(signal, { fetchImpl });
    expect(result.live).toBeNull();
    expect(result.embeddable).toBeNull();
    expect(result.note).toMatch(/oembed/);
    expect(classifyProbe(result)).toBe("unknown");
  });
});

describe("salvaguarda de red", () => {
  const probe = (live) => ({ id: "x", live, embeddable: true, thumbnail: true, http: {}, note: null });

  it("aborta cuando la mayoría de las sondas no se completan", () => {
    expect(looksLikeNetworkFailure([probe(null), probe(null), probe(null), probe(true)])).toBe(true);
  });

  it("no aborta por unas pocas cámaras caídas", () => {
    const results = [probe(true), probe(true), probe(false), probe(null), probe(true)];
    expect(looksLikeNetworkFailure(results)).toBe(false);
  });

  it("una lista vacía no se considera fallo de red", () => {
    expect(looksLikeNetworkFailure([])).toBe(false);
  });
});

describe("renderStatusModule", () => {
  it("genera un módulo TypeScript con fecha y estados, incluidos los null", () => {
    const content = renderStatusModule("2026-10-26", "2026-10-26T06:00:00.000Z", [
      { id: "iss-live", live: true, embeddable: true, thumbnail: true, http: {}, note: null },
      { id: "oso", live: false, embeddable: true, thumbnail: true, http: {}, note: null },
      { id: "raro", live: null, embeddable: null, thumbnail: null, http: {}, note: null },
    ]);

    expect(content).toContain('export const LIVE_STATUS_CHECKED_ON = "2026-10-26"');
    expect(content).toContain('"iss-live": { live: true, embeddable: true');
    expect(content).toContain('"oso": { live: false, embeddable: true');
    expect(content).toContain('"raro": { live: null, embeddable: null');
    expect(content).not.toContain("undefined");
  });
});
