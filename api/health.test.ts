/**
 * `/api/health` sin Vercel ni red real.
 *
 * Lo que se fija aquí no es "responde 200" sino tres cosas que se rompen
 * fácil: que la vista completa NO se sirva sin clave (ni siquiera sin Redis),
 * que `?compact=1` no filtre detalle, y que el token del bot no salga nunca.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler, { __resetUpstreamCacheForTest, explainChatFailure, webhookSecretState } from "./health";

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
  "TELEGRAM_WEBHOOK_SECRET",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
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

const asText = (payload: unknown) => JSON.stringify(payload);

const telegramOk = () => {
  const payload = { ok: true, result: { username: "aitor_bot" } };
  return { ok: true, status: 200, json: async () => payload, text: async () => asText(payload) };
};

const chatReport = (available = 2) => {
  const payload = { status: "ok", models: Array.from({ length: available }, () => ({ available: true })) };
  return { ok: true, status: 200, json: async () => payload, text: async () => asText(payload) };
};

/** Respuesta de error del chat: lo que importa es el cuerpo, que ahora se lee. */
const chatError = (status: number, payload: unknown) => ({
  ok: false,
  status,
  json: async () => payload,
  text: async () => asText(payload),
});

describe("explainChatFailure", () => {
  it("el cuerpo del gateway se atribuye a la clave de Supabase, no a la del proveedor", () => {
    const detail = explainChatFailure(
      401,
      '{"message":"Invalid API key","hint":"Double check the provided API key for typos."}',
    );
    expect(detail).toContain("Supabase rechaza la clave");
    expect(detail).toContain("VITE_SUPABASE_");
    expect(detail).not.toContain("LOVABLE_API_KEY");
  });

  it("el cuerpo del proveedor se atribuye a LOVABLE_API_KEY", () => {
    const detail = explainChatFailure(401, '{"error":"Provider authentication failed."}');
    expect(detail).toContain("proveedor de IA");
    expect(detail).toContain("LOVABLE_API_KEY");
    expect(detail).not.toContain("VITE_SUPABASE_");
  });

  it("si el cuerpo no aclara nada, se devuelve el recorte y no se inventa la causa", () => {
    const detail = explainChatFailure(401, "nope");
    expect(detail).toContain("no dice cuál");
    expect(detail).toContain("nope");
  });

  it("un JWT que venga en el cuerpo sale tapado", () => {
    const token = "eyJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.firmafirmafirma";
    const detail = explainChatFailure(500, `boom ${token}`);
    expect(detail).toContain("[clave]");
    expect(detail).not.toContain(token);
  });

  it("un 402 y un 429 se explican con su causa, sin cuerpo", () => {
    expect(explainChatFailure(402, "")).toContain("sin créditos");
    expect(explainChatFailure(429, "")).toContain("límite de peticiones");
  });
});

describe("webhookSecretState", () => {
  it("distingue ausente, definido y definido pero inservible", () => {
    expect(webhookSecretState(undefined)).toBe("missing");
    expect(webhookSecretState("")).toBe("missing");
    expect(webhookSecretState("   ")).toBe("missing");
    expect(webhookSecretState("secreto-de-prueba_123")).toBe("present");
    // Telegram sólo acepta A-Za-z0-9_- y hasta 256 caracteres.
    expect(webhookSecretState("con espacio")).toBe("invalid");
    expect(webhookSecretState("ñandú")).toBe("invalid");
    expect(webhookSecretState("a".repeat(257))).toBe("invalid");
  });
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
    process.env.TELEGRAM_WEBHOOK_SECRET = "secreto-de-prueba";
    vi.stubGlobal("fetch", vi.fn(async () => telegramOk()));

    const { res, snap } = mockRes();
    await handler(req("/api/health?compact=1"), res as never);
    const result = snap();

    expect(result.status).toBe(200);
    const telegram = upstreamsOf(result.body).find((entry) => entry.key === "telegram");
    expect(telegram?.status).toBe("OK");
    expect(telegram?.detail).toBeUndefined();
    // Se ve de un vistazo si el bot puede recibir, sin OPERATOR_KEY y sin
    // publicar el valor.
    expect(result.body).toMatchObject({ telegramWebhookSecret: "present" });
    expect(JSON.stringify(result.body)).not.toContain("secreto-de-prueba");
  });

  it("`?compact=1` con Redis publica el dato y sigue sin checks ni detalle", async () => {
    // El módulo de Redis lee el entorno al importarse: para esta ruta hace
    // falta una instancia nueva.
    vi.resetModules();
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.test";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token-de-prueba";
    process.env.TELEGRAM_WEBHOOK_SECRET = "secreto-de-prueba";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("api.telegram.org")) return telegramOk();
        return { ok: true, status: 200, json: async () => ({ result: Array(8).fill(null) }) };
      }),
    );
    const fresh = await import("./health");

    const { res, snap } = mockRes();
    await fresh.default(req("/api/health?compact=1"), res as never);
    const result = snap();

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ telegramWebhookSecret: "present" });
    expect(result.body).not.toHaveProperty("checks");
    expect(result.body).not.toHaveProperty("detail");
  });

  it("`?compact=1` sin Redis también dice si el secreto falta", async () => {
    const { res, snap } = mockRes();
    await handler(req("/api/health?compact=1"), res as never);
    const result = snap();

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      status: "UNCONFIGURED",
      telegramWebhookSecret: "missing",
    });
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

  it("con una publishable en el entorno prueba el chat con la JWT del repo, no como Bearer", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123:token-de-prueba";
    process.env.SUPABASE_URL = "https://proyecto.supabase.co";
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_de_prueba";

    const calls: { url: string; headers: Record<string, string> }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
        calls.push({ url: String(url), headers: { ...(init?.headers ?? {}) } });
        return String(url).includes("api.telegram.org") ? telegramOk() : chatReport();
      }),
    );

    const { res, snap } = mockRes();
    await handler(authed(), res as never);

    const chatCall = calls.find((call) => call.url.includes("/functions/v1/chat"));
    const key = chatCall?.headers.apikey ?? "";

    // Una JWT tiene tres partes; una `sb_publishable_…` no.
    expect(key.split(".")).toHaveLength(3);
    expect(chatCall?.headers.Authorization).toBe(`Bearer ${key}`);
    expect(upstreamsOf(snap().body).find((entry) => entry.key === "chat")?.status).toBe("OK");
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

  it("un 401 del gateway de Supabase se explica como clave de Supabase (el caso de producción)", async () => {
    process.env.SUPABASE_URL = "https://proyecto.supabase.co";
    process.env.SUPABASE_ANON_KEY = "sb_publishable_de_prueba";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        chatError(401, {
          message: "Invalid API key",
          hint: "Double check the provided API key for typos. This API key might also be owned by another Supabase project.",
        }),
      ),
    );

    const { res, snap } = mockRes();
    await handler(authed(), res as never);
    const chat = upstreamsOf(snap().body).find((entry) => entry.key === "chat");

    expect(chat?.status).toBe("DOWN");
    expect(chat?.detail).toContain("Invalid API key");
    expect(chat?.detail).toContain("VITE_SUPABASE_");
    expect(chat?.detail).not.toContain("LOVABLE_API_KEY");
    expect(JSON.stringify(snap().body)).not.toContain("sb_publishable_de_prueba");
  });

  it("un 401 del proveedor se explica como LOVABLE_API_KEY", async () => {
    process.env.SUPABASE_URL = "https://proyecto.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon-de-prueba";

    vi.stubGlobal("fetch", vi.fn(async () => chatError(401, { error: "Provider authentication failed." })));

    const { res, snap } = mockRes();
    await handler(authed(), res as never);
    const chat = upstreamsOf(snap().body).find((entry) => entry.key === "chat");

    expect(chat?.status).toBe("DOWN");
    expect(chat?.detail).toContain("proveedor de IA");
    expect(chat?.detail).toContain("LOVABLE_API_KEY");
  });

  it("una función chat antigua sin ?health=1 no se reporta como caída", async () => {
    process.env.SUPABASE_URL = "https://proyecto.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon-de-prueba";

    const payload = { error: "not found" };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => payload, text: async () => asText(payload) })));

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
