/**
 * Ejecuta `/api/traffic` de verdad con `fetch` simulado y una respuesta de
 * Vercel falsa: sin esto, la migración a la caché compartida sólo estaba
 * comprobada por tipos.
 *
 * Ambiente node (no jsdom): el handler no toca el DOM.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "./traffic.js";

function mockRes() {
  const headers: Record<string, string> = {};
  let status = 0;
  let body: unknown = null;
  let ended = false;
  const res = {
    statusCode: 200,
    status(code: number) {
      status = code;
      res.statusCode = code;
      return res;
    },
    setHeader(name: string, value: unknown) {
      headers[name.toLowerCase()] = String(value);
      return res;
    },
    json(payload: unknown) {
      body = payload;
      return res;
    },
    send(payload: unknown) {
      body = payload;
      return res;
    },
    end() {
      ended = true;
      return res;
    },
  };
  return { res, snap: () => ({ status, body, headers, ended }) };
}

const mockReq = (extra: Record<string, string> = {}) =>
  ({ method: "GET", headers: { ...extra }, query: { kind: "air" } }) as never;

const adsbReply = (ac: unknown[]) => ({
  ok: true,
  status: 200,
  json: async () => ({ ac }),
  text: async () => "",
});

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      adsbReply([
        { hex: "4CA2B1", flight: "IBE123 ", lat: 40.4, lon: -3.6, alt_baro: 30000, gs: 450, track: 90, t: "A320" },
      ]),
    ),
  );
});

describe("/api/traffic", () => {
  it("devuelve 200 con la aeronave mapeada, ETag y caché de 30 s en CDN", async () => {
    const { res, snap } = mockRes();
    await handler(mockReq(), res as never);
    const result = snap();
    const body = result.body as { count: number; flights: { icao24: string; altitude: number }[]; unavailable: boolean };

    expect(result.status).toBe(200);
    expect(body.count).toBe(1);
    expect(body.flights[0].icao24).toBe("4ca2b1");
    // 30 000 ft -> 9 144 m
    expect(body.flights[0].altitude).toBe(9144);
    expect(body.unavailable).toBe(false);
    expect(result.headers.etag).toMatch(/^"[0-9a-f]{8}"$/);
    expect(result.headers["cache-control"]).toContain("max-age=0");
    expect(result.headers["cdn-cache-control"]).toContain("s-maxage=30");
  });

  it("con If-None-Match igual responde 304 sin cuerpo", async () => {
    const first = mockRes();
    await handler(mockReq(), first.res as never);
    const etag = first.snap().headers.etag;

    const second = mockRes();
    await handler(mockReq({ "if-none-match": etag }), second.res as never);
    const result = second.snap();

    expect(result.status).toBe(304);
    expect(result.ended).toBe(true);
    expect(result.body).toBeNull();
  });

  it("un kind desconocido responde 400 sin salir a la red", async () => {
    const { res, snap } = mockRes();
    await handler({ method: "GET", headers: {}, query: { kind: "space" } } as never, res as never);

    expect(snap().status).toBe(400);
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(0);
  });

  it("descarta los identificadores inventados (mock…)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => adsbReply([{ hex: "mock0000", lat: 1, lon: 1 }])),
    );
    const { res, snap } = mockRes();
    await handler(mockReq(), res as never);
    const body = snap().body as { count: number; unavailable: boolean };

    expect(body.count).toBe(0);
    expect(body.unavailable).toBe(true);
  });
});
