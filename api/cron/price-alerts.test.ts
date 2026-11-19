/**
 * `GET /api/cron/price-alerts` — el primer loop de la fase 5, de punta a punta.
 *
 * Lo que se fija aquí es lo que puede romperse sin que nadie lo note: que sin
 * secreto no se ejecute, que sin Redis o sin precios no dispare nada a ciegas,
 * que una alerta cruzada avise por Telegram **y** se borre (es de un solo uso),
 * y que si Telegram rechaza el aviso la alerta **no** se pierda.
 *
 * El Redis es de mentira pero implementa los comandos que usa `alerts.ts`
 * (`HGET`, `HSET`, `HDEL`, `EXPIRE`, `HGETALL`), así que la lógica de verdad
 * —`dueAlerts`, `formatAlert`, el borrado de las disparadas— se ejecuta entera.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redis = vi.hoisted(() => ({
  configured: true,
  hash: new Map<string, string>(),
  calls: [] as (string | number)[][],
}));

vi.mock("../_shared/redis.js", () => ({
  isRedisConfigured: () => redis.configured,
  redisCommand: async (args: (string | number)[]) => {
    redis.calls.push(args);
    const command = String(args[0]).toUpperCase();
    if (command === "HGETALL") return [...redis.hash.entries()].flat();
    if (command === "HGET") return redis.hash.get(String(args[2])) ?? null;
    if (command === "HSET") {
      redis.hash.set(String(args[2]), String(args[3]));
      return 1;
    }
    if (command === "HDEL") return redis.hash.delete(String(args[2])) ? 1 : 0;
    if (command === "EXPIRE") return 1;
    return null;
  },
}));

import handler from "./price-alerts";

const THREAD = "tg_abc123";
const CHAT = 4242;

function seed(alerts: unknown[], token = THREAD) {
  redis.hash.set(token, JSON.stringify(alerts));
}

const alerta = (overrides: Record<string, unknown> = {}) => ({
  chatId: CHAT,
  symbol: "BTC",
  direction: "above",
  price: 100_000,
  createdAt: "2026-11-19T10:00:00.000Z",
  ...overrides,
});

interface Result {
  status: number;
  body: Record<string, unknown>;
}

function call(headers: Record<string, string> = {}, method = "GET"): Promise<Result> {
  return new Promise((resolve) => {
    const req = { method, headers };
    const res = {
      statusCode: 0,
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this.headers[name] = value;
        return this;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: Record<string, unknown>) {
        resolve({ status: this.statusCode, body: payload });
      },
      send(payload: string) {
        resolve({ status: this.statusCode, body: { raw: payload } });
      },
    };
    void handler(req as never, res as never);
  });
}

/** CoinGecko y Telegram simulados; `prices` a null = la fuente falla. */
function stubNetwork(prices: Record<string, number> | null, telegramOk = true) {
  const calls: { url: string; body?: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const target = String(url);
      calls.push({ url: target, body: init?.body ? String(init.body) : undefined });
      if (target.includes("coingecko")) {
        if (!prices) return new Response("caído", { status: 500 });
        return new Response(JSON.stringify({ bitcoin: { usd: prices.BTC } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (target.includes("api.telegram.org")) {
        return new Response(JSON.stringify({ ok: telegramOk }), {
          status: telegramOk ? 200 : 500,
        });
      }
      return new Response("{}", { status: 200 });
    }),
  );
  return calls;
}

const telegramCalls = (calls: { url: string; body?: string }[]) =>
  calls.filter((call) => call.url.includes("api.telegram.org"));

beforeEach(() => {
  redis.configured = true;
  redis.hash.clear();
  redis.calls = [];
  process.env.CRON_SECRET = "secreto-de-cron";
  process.env.TELEGRAM_BOT_TOKEN = "123:token-de-prueba";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CRON_SECRET;
  delete process.env.TELEGRAM_BOT_TOKEN;
});

describe("GET /api/cron/price-alerts", () => {
  it("sin secreto no se ejecuta", async () => {
    seed([alerta()]);
    const calls = stubNetwork({ BTC: 120_000 });

    const result = await call();

    expect(result.status).toBe(401);
    expect(calls).toHaveLength(0);
    // La alerta sigue donde estaba: no se ha tocado nada.
    expect(redis.hash.size).toBe(1);
  });

  it("con un secreto distinto tampoco", async () => {
    const result = await call({ authorization: "Bearer otro" });
    expect(result.status).toBe(401);
  });

  it("sólo acepta GET", async () => {
    const result = await call({ authorization: "Bearer secreto-de-cron" }, "POST");
    expect(result.status).toBe(405);
  });

  it("sin Redis lo dice y no revienta", async () => {
    redis.configured = false;
    seed([alerta()]);

    const result = await call({ authorization: "Bearer secreto-de-cron" });

    expect(result.status).toBe(200);
    expect(result.body.reason).toBe("sin-redis");
  });

  it("si la fuente de precios falla no dispara ni borra", async () => {
    seed([alerta()]);
    const calls = stubNetwork(null);

    const result = await call({ authorization: "Bearer secreto-de-cron" });

    expect(result.status).toBe(200);
    expect(result.body.reason).toBe("sin-precios");
    expect(result.body.fired).toBe(0);
    expect(telegramCalls(calls)).toHaveLength(0);
    // Sigue guardada para la siguiente pasada: no se inventa ni se pierde.
    expect(redis.hash.get(THREAD)).toContain("100000");
  });

  it("avisa por Telegram y borra la alerta cuando el precio cruza", async () => {
    seed([alerta()]);
    const calls = stubNetwork({ BTC: 120_000 });

    const result = await call({ authorization: "Bearer secreto-de-cron" });

    expect(result.status).toBe(200);
    expect(result.body.fired).toBe(1);
    expect(result.body.delivered).toBe(1);

    const sent = telegramCalls(calls);
    expect(sent).toHaveLength(1);
    const payload = JSON.parse(String(sent[0].body));
    expect(payload.chat_id).toBe(CHAT);
    expect(payload.text).toContain("BTC");
    // El aviso lleva el precio de ahora, no el umbral: 120.000 en es-ES.
    expect(payload.text).toContain("120.000");

    // Una alerta de precio es de un solo uso: ya no está.
    expect(redis.hash.has(THREAD)).toBe(false);
  });

  it("no avisa si el precio no llega al umbral, y la alerta sigue", async () => {
    seed([alerta()]);
    const calls = stubNetwork({ BTC: 90_000 });

    const result = await call({ authorization: "Bearer secreto-de-cron" });

    expect(result.body.fired).toBe(0);
    expect(telegramCalls(calls)).toHaveLength(0);
    expect(redis.hash.get(THREAD)).toContain("100000");
  });

  it("si Telegram rechaza el aviso, la alerta no se pierde", async () => {
    seed([alerta()]);
    stubNetwork({ BTC: 120_000 }, false);

    const result = await call({ authorization: "Bearer secreto-de-cron" });

    expect(result.body.fired).toBe(0);
    expect(result.body.delivered).toBe(0);
    expect(redis.hash.get(THREAD)).toContain("100000");
  });

  it("sin alertas no pide precios ni avisa a nadie", async () => {
    const calls = stubNetwork({ BTC: 120_000 });

    const result = await call({ authorization: "Bearer secreto-de-cron" });

    expect(result.status).toBe(200);
    expect(result.body.checked).toBe(0);
    expect(calls).toHaveLength(0);
  });
});
