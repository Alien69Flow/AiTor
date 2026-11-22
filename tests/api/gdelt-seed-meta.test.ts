/**
 * La marca de frescura de `/api/gdelt`.
 *
 * `/api/health` vigila `osint:gdelt:v1` y hasta ahora nadie escribía su
 * `seed-meta`: el dataset salía EMPTY aunque GDELT respondiera bien. Lo que se
 * fija aquí son las dos mitades que importan: se marca cuando se trae de la
 * fuente, y **no** se marca al servir una copia de la caché (una copia vieja no
 * es un dato fresco).
 *
 * La caché compartida y el rate limit se sustituyen por dobles; la lógica del
 * handler, el parseo y el `recordSeed` son los de verdad.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  seeds: [] as { key: string; count: number; ttl: number }[],
  cache: new Map<string, unknown>(),
}));

vi.mock("../../api/_shared/redis.js", () => ({
  // Sin Redis el rate limit cae al contador en memoria: no hace falta red.
  isRedisConfigured: () => false,
  redisCommand: async () => null,
  recordSeed: async (key: string, count: number, ttl: number) => {
    state.seeds.push({ key, count, ttl });
    return true;
  },
  cachedFetchJson: async (key: string, _ttl: number, fetcher: () => Promise<unknown>) => {
    if (!state.cache.has(key)) state.cache.set(key, await fetcher());
    return state.cache.get(key);
  },
}));

import handler from "../../api/gdelt";

const FEED = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        url: "https://ejemplo.com/uno",
        name: "Moscú, Rusia",
        urlpubtimedate: "20261119120000",
      },
    },
    {
      type: "Feature",
      properties: {
        url: "https://ejemplo.com/dos",
        name: "Kiev, Ucrania",
        urlpubtimedate: "20261119121000",
      },
    },
  ],
};

interface Result {
  status: number;
  body: unknown;
}

/** `req`/`res` mínimos: los campos que miran CORS, rate limit y `sendJson`. */
function call(query: Record<string, string> = {}): Promise<Result> {
  return new Promise((resolve) => {
    const req = {
      method: "GET",
      query: { theme: "ARMEDCONFLICT", hours: "12", maxrows: "10", ...query },
      headers: {},
      socket: { remoteAddress: "198.51.100.9" },
    };
    const res = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
        return this;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
      send(payload: string) {
        let body: unknown = payload;
        try {
          body = JSON.parse(payload);
        } catch {
          /* texto plano */
        }
        resolve({ status: this.statusCode, body });
        return this;
      },
      end() {
        resolve({ status: this.statusCode, body: null });
        return this;
      },
    };
    void handler(req as never, res as never);
  });
}

function stubUpstream(payload: unknown, status = 200) {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  state.seeds = [];
  state.cache.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/api/gdelt · marca de frescura", () => {
  it("marca osint:gdelt:v1 con las filas que acaba de traer", async () => {
    stubUpstream(FEED);

    const result = await call();

    expect(result.status).toBe(200);
    expect(state.seeds).toEqual([{ key: "osint:gdelt:v1", count: 2, ttl: 6 * 3_600 }]);
  });

  it("servir de caché no rejuvenece la marca", async () => {
    stubUpstream(FEED);

    await call();
    await call();

    // El segundo request sale de la caché: ya no hubo dato nuevo que marcar.
    expect(state.seeds).toEqual([{ key: "osint:gdelt:v1", count: 2, ttl: 6 * 3_600 }]);
  });

  it("un fallo de la fuente no deja una marca fresca", async () => {
    stubUpstream({ error: "caído" }, 500);

    const result = await call();

    expect(result.status).toBe(502);
    expect(state.seeds).toEqual([]);
  });

  it("un cuerpo que no es JSON tampoco cuenta como dato", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>Invalid format.</html>", { status: 200 })),
    );

    const result = await call();

    expect(result.status).toBe(502);
    expect(state.seeds).toEqual([]);
  });
});
