/**
 * Fija el comportamiento de `cachedFetchJson` que el typecheck no puede ver.
 *
 * Contexto: la review del PR #94 detectó que la caché negativa era decorativa
 * (el centinela se traducía a `miss` y se volvía a salir a la red). Estos tests
 * fallan si ese bug vuelve.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

const reply = (body: unknown) => ({ ok: true, json: async () => body }) as unknown as Response;

/** Upstash REST de mentira: GET / SET / MGET / EVAL sobre una Map. */
function fakeRedisFetch() {
  return vi.fn(async (_url: string, init?: RequestInit) => {
    const args = JSON.parse(String(init?.body ?? "[]")) as (string | number)[];
    const cmd = String(args[0] ?? "").toUpperCase();
    if (cmd === "GET") return reply({ result: store.get(String(args[1])) ?? null });
    if (cmd === "SET") {
      store.set(String(args[1]), String(args[2]));
      return reply({ result: "OK" });
    }
    if (cmd === "MGET") {
      return reply({ result: (args.slice(1) as string[]).map((key) => store.get(key) ?? null) });
    }
    if (cmd === "EVAL") return reply({ result: [1, 60_000] });
    return reply({ result: null });
  });
}

type RedisModule = typeof import("./redis");

async function loadModule(): Promise<RedisModule> {
  vi.resetModules();
  return (await import("./redis")) as RedisModule;
}

beforeEach(() => {
  store.clear();
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.test";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  vi.stubGlobal("fetch", fakeRedisFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

describe("cachedFetchJson", () => {
  it("sirve el acierto cacheado sin repetir el fetch", async () => {
    const redis = await loadModule();
    const fetcher = vi.fn(async () => ({ ok: 1 }));

    await expect(redis.cachedFetchJson("k", 60, fetcher)).resolves.toEqual({ ok: 1 });
    await expect(redis.cachedFetchJson("k", 60, fetcher)).resolves.toEqual({ ok: 1 });

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("cachea el fallo: la segunda petición no vuelve a salir a la red", async () => {
    const redis = await loadModule();
    const fetcher = vi.fn(async () => {
      throw new Error("upstream caído");
    });

    await expect(redis.cachedFetchJson("k2", 60, fetcher, { negativeTtlSeconds: 60 })).resolves.toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);

    // El bug del #94: esta segunda llamada volvía a invocar fetcher.
    await expect(redis.cachedFetchJson("k2", 60, fetcher, { negativeTtlSeconds: 60 })).resolves.toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("distingue un fallo cacheado (negative) de una clave que nunca existió (miss)", async () => {
    const redis = await loadModule();
    const fetcher = vi.fn(async () => {
      throw new Error("x");
    });

    await redis.cachedFetchJson("k3", 60, fetcher, { negativeTtlSeconds: 60 });

    await expect(redis.getJsonStatus("k3")).resolves.toEqual({ status: "negative" });
    await expect(redis.getJsonStatus("nunca-visto")).resolves.toEqual({ status: "miss" });
  });

  it("con onError: throw propaga el error al primer llamante", async () => {
    const redis = await loadModule();
    const fetcher = vi.fn(async () => {
      throw new Error("boom");
    });

    await expect(redis.cachedFetchJson("k4", 60, fetcher, { onError: "throw" })).rejects.toThrow("boom");
  });
});

describe("readSeedMetas", () => {
  it("lee las marcas de frescura en una sola llamada", async () => {
    store.set("seed-meta:osint:gdelt:v1", JSON.stringify({ fetchedAt: "2026-11-18T18:00:00.000Z", recordCount: 12 }));
    const redis = await loadModule();

    const metas = await redis.readSeedMetas(["osint:gdelt:v1", "otra:v1"]);

    expect(metas.get("osint:gdelt:v1")?.recordCount).toBe(12);
    expect(metas.get("otra:v1")).toBeNull();
  });
});
