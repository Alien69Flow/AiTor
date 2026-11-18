/**
 * `/api/health` sin Vercel ni red real: las sondas de upstream se prueban con
 * `fetch` simulado, porque lo que hay que garantizar no es "responde 200" sino
 * "dice la verdad sin filtrar el token".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "./health";

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

const req = (url = "/api/health?compact=1") =>
  ({ method: "GET", headers: { host: "localhost" }, url }) as never;

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
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearEnv();
});

type UpstreamView = { key: string; status: string; detail?: string | null };

const upstreamsOf = (body: unknown) => (body as { upstreams: UpstreamView[] }).upstreams;

describe("/api/health · upstreams", () => {
  it("sin variables dice qué falta, y no inventa un estado", async () => {
    const { res, snap } = mockRes();
    await handler(req(), res as never);
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
      vi.fn(async (url: string) => {
        if (String(url).includes("api.telegram.org")) {
          return { ok: true, status: 200, json: async () => ({ ok: true, result: { username: "aitor_bot" } }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: "ok",
            models: [{ available: true }, { available: false }, { available: true }],
          }),
        };
      }),
    );

    const { res, snap } = mockRes();
    await handler(req(), res as never);
    const upstreams = upstreamsOf(snap().body);

    expect(upstreams.find((entry) => entry.key === "telegram")).toMatchObject({
      status: "OK",
      detail: "@aitor_bot",
    });
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
    await handler(req(), res as never);
    const result = snap();

    expect(upstreamsOf(result.body).find((entry) => entry.key === "telegram")).toMatchObject({
      status: "DOWN",
    });
    expect(JSON.stringify(result.body)).not.toContain(token);
  });

  it("una función chat antigua sin ?health=1 no se reporta como caída", async () => {
    process.env.SUPABASE_URL = "https://proyecto.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon-de-prueba";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ error: "not found" }) })),
    );

    const { res, snap } = mockRes();
    await handler(req(), res as never);
    const chat = upstreamsOf(snap().body).find((entry) => entry.key === "chat");

    expect(chat?.status).toBe("OK");
    expect(chat?.detail).toContain("redesplegar chat");
  });
});
