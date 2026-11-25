import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { __resetRateLimitMemoryForTest, checkRateLimit } from "./rate-limit";
import { isRedisConfigured } from "./redis";

interface Snapshot {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

function mockRes() {
  const headers: Record<string, string> = {};
  let status = 200;
  let body: unknown = null;

  const res = {
    statusCode: 200,
    status(code: number) {
      status = code;
      res.statusCode = code;
      return res;
    },
    setHeader(name: string, value: string | number | string[]) {
      headers[name.toLowerCase()] = String(value);
      return res;
    },
    json(payload: unknown) {
      body = payload;
      return res;
    },
    end() {
      return res;
    },
  };

  const snap = (): Snapshot => ({ status, body, headers });
  return { res, snap };
}

/** Misma IP, cabeceras de plataforma: lo único que cambia es el User-Agent. */
function req(userAgent: string, ip = "203.0.113.7") {
  return {
    method: "POST",
    headers: { "x-vercel-forwarded-for": ip, "user-agent": userAgent },
  };
}

const POLICY = { name: "prueba-sin-ua", limit: 1, windowSec: 60 };

describe("checkRateLimit", () => {
  beforeAll(() => {
    // Esta prueba necesita el contador en memoria. `redis.ts` resuelve sus
    // variables al importar el módulo, así que vaciarlas aquí no serviría: si
    // el entorno trae Upstash configurado, mejor enterarse que pasar en falso.
    expect(isRedisConfigured(), "esta prueba necesita correr sin Upstash configurado").toBe(false);
  });

  beforeEach(() => {
    __resetRateLimitMemoryForTest();
  });

  it("el mismo IP con otro User-Agent comparte cubo: la segunda llamada da 429", async () => {
    const first = mockRes();
    await expect(checkRateLimit(req("aitor/1.0"), first.res, POLICY)).resolves.toBe(true);
    expect(first.snap().headers["x-ratelimit-mode"]).toBe("memory");

    const second = mockRes();
    await expect(checkRateLimit(req("curl/8.0 (otro cliente)"), second.res, POLICY)).resolves.toBe(
      false,
    );

    const snap = second.snap();
    expect(snap.status).toBe(429);
    expect(snap.body).toMatchObject({ error: "too many requests", policy: "prueba-sin-ua" });
    expect(Number(snap.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("una IP distinta sí estrena cubo, para que el test no pase por denegarlo todo", async () => {
    const first = mockRes();
    await checkRateLimit(req("aitor/1.0"), first.res, POLICY);

    const other = mockRes();
    await expect(checkRateLimit(req("aitor/1.0", "198.51.100.9"), other.res, POLICY)).resolves.toBe(
      true,
    );
  });
});
