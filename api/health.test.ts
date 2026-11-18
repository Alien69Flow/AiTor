/**
 * `/api/health` sin Vercel ni red real.
 *
 * Lo que se fija aquí no es "responde 200" sino tres cosas que se rompen
 * fácil: que la vista completa NO se sirva sin clave (ni siquiera sin Redis),
 * que `?compact=1` no filtre detalle, y que el token del bot no salga nunca.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler, { __resetUpstreamCacheForTest } from "./health";

function mockRes() {
  const headers: Record<string, string> = {};
  let status = 0;
  let body: unknown = null;
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
      return res;
    },
  };
  return { res, snap: () => ({ status, body, headers }) };
}

const OPERATOR = "clave-de-operador";

const req = (url = "/api/health", headers: Record<string, string> = {}) =>
  ({ method: "GET", headers: { host: "localhost", ...headers }, url }) as never;

const authed = (url = "/api/health") => req(url, { "x-api-key": OPERATOR });

const ENV_KEYS = [
  "TELEGRAM_BOT_TOKEN",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "OPERATOR_KEY",
];

function clearEnv(): void {
  for (const name of ENV_KEYS) delete process.env[name];
}

beforeEach(() => {
  clearEnv();
  __resetUpstreamCacheForTest();
  process.env.OPERATOR_KEY = OPERATOR;
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearEnv();
  __resetUpstreamCacheForTest();
});

type UpstreamView = { key: string; status: string; detail?: string | null };

const upstreamsOf = (body: unknown) => (body as { upstreams?: UpstreamView[] }).upstreams ?? [];

const telegramOk = () => ({
  ok: true,
  status: 200,
  json: async () => ({ ok: true, result: { username: "aitor_bot" } }),
});

const chatReport = (available = 2) => ({
  ok: true,
  status: 200,
  json: async () => ({ status: "ok", models: Array.from({ length: available }, () => ({ available: true })) }),
});

describe("/api/health · puerta de operador", () => {
  it("sin clave y sin Redis, la vista completa es 401 y no llama a nadie", async () => {
    const fetcher = vi.fn(async () => telegramOk());
    vi.stubGlobal("fetch", fetcher);

    const { res, snap } = mockRes();
    await handler(req("/api/health"), res as never);
    const result = snap();

    expect(result.status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
    expect(JSON.stringify(result.body)).not.toContain("@");
    expect(result.body).toMatchObject({ code: "unauthorized" });
  });

  it("una clave equivocada tampoco pasa", async () => {
    const { res, snap } = mockRes();
    await handler(req("/api/health", { "x-api-key": "otra-cosa" }), res as never);
    expect(snap().status).toBe(401);
  });

  it("sin OPERATOR_KEY configurada la vista completa queda cerrada", async () => {
    delete process.env.OPERATOR_KEY;
    const { res, snap } = mockRes();
    await handler(req("/api/health", { "x-api-key": "" }), res as never);
    expect(snap().status).toBe(401);
  });

  it("`?compact=1` sigue siendo público y sin detalle", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123:token";
    vi.stubGlobal("fetch", vi.fn(async () => telegramOk()));

    const { res, snap } = mockRes();
    await handler(req("/api/health?compact=1"), res as never);
    const result = snap();

    expect(result.status).toBe(200);
    const telegram = upstreamsOf(result.body).find((entry) => entry.key === "telegram");
    expect(telegram?.status).toBe("OK");
    expect(telegram?.detail).toBeUndefined();
  });
});

describe("/api/health · upstreams", () => {
  it("sin variables dice qué falta, y no inventa un estado", async () => {
    const { res, snap } = mockRes();
    await handler(authed(), res as never);
    const result = snap();

    expect(result.status).toBe(200);
    expect((result.body as { status: string }).status).toBe("UNCONFIGURED");

    const upstreams = upstreamsOf(result.body);
    expect(upstreams.find((entry) => entry.key === "telegram")).toMatchObject({ status: "UNCONFIGURED" });
    expect(upstreams.find((entry) => entry.key === "chat")).toMatchObject({ status: "UNCONFIGURED" });
  });

  it("con Telegram y chat vivos los dos salen OK", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123:token-de-prueba";
    process.env.SUPABASE_URL = "https://proyecto.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon-de-prueba";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => (String(url).includes("api.telegram.org") ? telegramOk() : chatReport())),
    );

    const { res, snap } = mockRes();
    await handler(authed(), res as never);
    const upstreams = upstreamsOf(snap().body);

    expect(upstreams.find((entry) => entry.key === "telegram")).toMatchObject({ status: "OK", detail: "@aitor_bot" });
    expect(upstreams.find((entry) => entry.key === "chat")?.detail).toContain("2 modelos con clave");
  });

  it("un token rechazado es DOWN y el token no sale en la respuesta", async () => {
    const token = "999:secreto-que-no-debe-filtrarse";
    process.env.TELEGRAM_BOT_TOKEN = token;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ ok: false, description: "Unauthorized" }) })),
    );

    const { res, snap } = mockRes();
    await handler(authed(), res as never);
    const result = snap();

    expect(upstreamsOf(result.body).find((entry) => entry.key === "telegram")).toMatchObject({ status: "DOWN" });
    expect(JSON.stringify(result.body)).not.toContain(token);
  });

  it("un 401 del chat explica que la clave del proveedor está mal", async () => {
    process.env.SUPABASE_URL = "https://proyecto.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon-de-prueba";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: "Provider authentication failed." }) })),
    );

    const { res, snap } = mockRes();
    await handler(authed(), res as never);
    const chat = upstreamsOf(snap().body).find((entry) => entry.key === "chat");

    expect(chat?.status).toBe("DOWN");
    expect(chat?.detail).toContain("LOVABLE_API_KEY");
  });

  it("una función chat antigua sin ?health=1 no se reporta como caída", async () => {
    process.env.SUPABASE_URL = "https://proyecto.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon-de-prueba";

    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ error: "not found" }) })));

    const { res, snap } = mockRes();
    await handler(authed(), res as never);
    const chat = upstreamsOf(snap().body).find((entry) => entry.key === "chat");

    expect(chat?.status).toBe("OK");
    expect(chat?.detail).toContain("redesplegar chat");
  });

  it("dos peticiones seguidas no repiten las sondas (caché corta)", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123:token";
    const fetcher = vi.fn(async () => telegramOk());
    vi.stubGlobal("fetch", fetcher);

    await handler(authed(), mockRes().res as never);
    const afterFirst = fetcher.mock.calls.length;
    await handler(authed(), mockRes().res as never);

    expect(fetcher.mock.calls.length).toBe(afterFirst);
    expect(afterFirst).toBeGreaterThan(0);
  });
});
