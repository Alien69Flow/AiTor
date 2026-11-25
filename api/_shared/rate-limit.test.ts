import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { __resetRateLimitMemoryForTest, checkRateLimit } from "./rate-limit";
import { isRedisConfigured } from "./redis";

const POLICY = { name: "prueba-sin-ua", limit: 1, windowSec: 60 };

/**
 * Una llamada con su propio `res`: el contador vive en el módulo, la respuesta
 * no. La IP entra por la cabecera de plataforma; el User-Agent va aparte
 * porque es justo lo que la clave tiene que ignorar.
 */
async function call(ip: string, userAgent: string) {
  const headers: Record<string, string> = {};

  const res = {
    statusCode: 200,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    setHeader(name: string, value: string | number | string[]) {
      headers[name.toLowerCase()] = String(value);
      return res;
    },
    json() {
      return res;
    },
    end() {
      return res;
    },
  };

  const allowed = await checkRateLimit(
    { method: "POST", headers: { "x-vercel-forwarded-for": ip, "user-agent": userAgent } },
    res,
    POLICY,
  );

  return { allowed, status: res.statusCode, headers };
}

describe("checkRateLimit", () => {
  beforeAll(() => {
    // `redis.ts` resuelve sus variables al importar, así que vaciarlas aquí no
    // serviría: si el entorno trae Upstash, mejor enterarse que medir otro
    // contador y creer que se probó el de memoria.
    expect(isRedisConfigured(), "esta prueba necesita el contador en memoria").toBe(false);
  });

  beforeEach(() => {
    __resetRateLimitMemoryForTest();
  });

  it("la clave es la IP: otro User-Agent comparte cubo y otra IP estrena uno", async () => {
    const first = await call("203.0.113.7", "aitor/1.0");
    expect(first.allowed).toBe(true);
    // Sin Redis configurado (arriba), la memoria es la única ruta posible.
    expect(first.headers["x-ratelimit-mode"]).toBe("memory");

    // Misma IP, otro cliente: si el User-Agent entrara en la clave, esto sería true.
    const sameIp = await call("203.0.113.7", "curl/8.0 (otro cliente)");
    expect(sameIp.allowed).toBe(false);
    expect(sameIp.status).toBe(429);

    // IP distinta: cubo nuevo. Sin esta llamada, denegarlo todo también pasaría.
    const otherIp = await call("198.51.100.9", "aitor/1.0");
    expect(otherIp.allowed).toBe(true);
  });
});
