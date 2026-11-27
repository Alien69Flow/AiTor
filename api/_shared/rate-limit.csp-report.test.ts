import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetRateLimitMemoryForTest, checkRateLimit } from "./rate-limit";
import { isRedisConfigured } from "./redis";

/**
 * El límite que el cuerpo de la #168 afirma para el colector CSP y que ninguna
 * prueba cubría: **120 peticiones por minuto desde la misma IP**.
 *
 * Ojo con lo que esto prueba y lo que no. El handler `api/csp-report.ts` se
 * retiró en `bbdb740`, así que aquí no hay endpoint al que pedirle el 429 —la
 * suite `api/csp-report.contract.test.ts` sigue roja justo por eso: importa un
 * módulo que ya no existe—. Lo que sí vive es el contador compartido
 * (`api/_shared/rate-limit.ts`), y es ahí donde el número tiene que ser cierto:
 * `{ limit: 120, windowSec: 60 }`, clave por IP, 429 en la 121. Eso es lo que
 * se fija aquí, con la política exacta que describía el documento.
 *
 * Si el colector vuelve, tiene que usar esta política y estas pruebas pasan a
 * ser también las suyas. Si alguien la cambia, el número deja de estar
 * inventado en un documento y empieza a fallar algo.
 */

const COLECTOR = { name: "csp-report", limit: 120, windowSec: 60 };

/** Una llamada con su `res` propio: el contador vive en el módulo, la respuesta no. */
async function call(ip: string) {
  const headers: Record<string, string> = {};

  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    setHeader(name: string, value: string | number | string[]) {
      headers[name.toLowerCase()] = String(value);
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    end() {
      return res;
    },
  };

  const allowed = await checkRateLimit(
    { method: "POST", headers: { "x-vercel-forwarded-for": ip, "user-agent": "colector-csp" } },
    res,
    COLECTOR,
  );

  return { allowed, status: res.statusCode, headers, body: res.body };
}

describe("colector CSP: 120 peticiones/minuto por IP", () => {
  beforeAll(() => {
    // Con Upstash configurado esto mediría otro contador; mejor enterarse que
    // creer que se probó el de memoria.
    expect(isRedisConfigured(), "esta prueba necesita el contador en memoria").toBe(false);
  });

  beforeEach(() => {
    __resetRateLimitMemoryForTest();
  });

  it("las 120 primeras pasan y la 121 responde 429", async () => {
    for (let i = 1; i <= 120; i += 1) {
      const respuesta = await call("203.0.113.7");
      expect(respuesta.allowed, `la petición ${i} tenía que pasar`).toBe(true);
      // El borde, por los dos lados: la 119ª deja una y la 120ª deja cero, así
      // que el techo es 120 y no 119 ni 121.
      if (i === 119) expect(respuesta.headers["ratelimit-remaining"]).toBe("1");
      if (i === 120) expect(respuesta.headers["ratelimit-remaining"]).toBe("0");
    }

    const bloqueada = await call("203.0.113.7");
    expect(bloqueada.allowed).toBe(false);
    expect(bloqueada.status).toBe(429);
    expect(bloqueada.body).toEqual({
      error: "too many requests",
      policy: "csp-report",
      retryAfterSeconds: expect.any(Number),
    });
    // Un 429 sin `Retry-After` obliga al cliente a adivinar cuándo volver.
    expect(Number(bloqueada.headers["retry-after"])).toBeGreaterThanOrEqual(1);
  });

  it("el cubo es por IP: agotar una no cierra la puerta a las demás", async () => {
    for (let i = 1; i <= 121; i += 1) await call("203.0.113.7");
    expect((await call("203.0.113.7")).status).toBe(429);

    const otra = await call("198.51.100.9");
    expect(otra.allowed).toBe(true);
    expect(otra.headers["ratelimit-remaining"]).toBe("119");
  });

  it("la ventana es de 60 s: al minuto siguiente se vuelve a entrar", async () => {
    // Reloj propio en vez de esperar: `memoryDecision` sólo mira `Date.now()`.
    let ahora = 1_764_000_000_000;
    const reloj = vi.spyOn(Date, "now").mockImplementation(() => ahora);
    try {
      for (let i = 1; i <= 121; i += 1) await call("203.0.113.7");
      expect((await call("203.0.113.7")).status).toBe(429);

      ahora += 60_000;
      const despues = await call("203.0.113.7");
      expect(despues.allowed).toBe(true);
      expect(despues.headers["ratelimit-remaining"]).toBe("119");
    } finally {
      reloj.mockRestore();
    }
  });

  it("anuncia en la respuesta la misma política que el cuerpo afirma", async () => {
    const primera = await call("203.0.113.7");
    expect(primera.headers["ratelimit-policy"]).toBe('"csp-report";q=120;w=60');
    expect(primera.headers["ratelimit-limit"]).toBe("120");
  });
});
