/**
 * El caso que motivó unificar las dos sondas: la gratuita dice DOWN (500 o
 * timeout) y la de pago, con clave de operador, contesta 200.
 *
 * Lo que se fija es que las dos superficies publican el mismo veredicto —DOWN—
 * y que la conclusión cuenta las dos cosas (la gratis falla, la de pago
 * responde) sin afirmar que el chat vive. Es la discrepancia que durante días
 * dejó a `/api/health` diciendo DOWN mientras la sonda decía «el fallo está en
 * el webhook».
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const OPERATOR = "clave-de-operador";
const PROJECT = "https://proyecto.supabase.co";

const SSE_200 = [
  'data: {"choices":[{"delta":{"content":"pong"}}]}',
  "",
  "data: [DONE]",
  "",
].join("\n");

const ENV_KEYS = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "VITE_SUPABASE_ANON_KEY",
  "OPERATOR_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
];

function clearEnv(): void {
  for (const name of ENV_KEYS) delete process.env[name];
}

beforeEach(() => {
  clearEnv();
  process.env.OPERATOR_KEY = OPERATOR;
  process.env.SUPABASE_URL = PROJECT;
  process.env.TELEGRAM_BOT_TOKEN = "123:token-de-prueba";
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearEnv();
  vi.resetModules();
});

type ProbeBody = {
  chatProbe: {
    status: string;
    conclusion: string;
    attempts: { via: string; status: number | null; ok: boolean }[];
  } | null;
};
type CompactBody = { upstreams: { key: string; status: string }[] };

/** La gratis falla como se pida; la de pago contesta 200 con un SSE válido. */
function stubChat(free: "500" | "timeout") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const target = String(url);
      if (target.includes("api.telegram.org")) {
        return new Response(JSON.stringify({ ok: true, result: {} }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (target.includes("functions/v1/chat")) {
        if (target.includes("health=1")) {
          if (free === "timeout") {
            throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
          }
          return new Response(JSON.stringify({ error: "boom" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(SSE_200, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return new Response("{}", { status: 404 });
    }),
  );
}

function mockRes<T>() {
  let status = 0;
  let body: T | null = null;
  const res = {
    statusCode: 0,
    status(code: number) {
      status = code;
      res.statusCode = code;
      return res;
    },
    setHeader() {
      return res;
    },
    json(payload: T) {
      body = payload;
      return res;
    },
    send() {
      return res;
    },
    end() {
      return res;
    },
  };
  return { res, snap: () => ({ status, body }) };
}

const get = (url: string, headers: Record<string, string> = {}) =>
  ({ method: "GET", url, headers: { host: "localhost", ...headers } }) as never;

async function probeWebhook() {
  const module = await import("./telegram-webhook");
  const handler = module.default as unknown as (req: unknown, res: unknown) => Promise<unknown>;
  const { res, snap } = mockRes<ProbeBody>();
  await handler(get("/api/telegram-webhook?probe=1", { "x-api-key": OPERATOR }), res);
  return snap().body!.chatProbe!;
}

async function healthCompact() {
  const module = await import("./health");
  const handler = module.default as unknown as (req: unknown, res: unknown) => Promise<unknown>;
  const { res, snap } = mockRes<CompactBody>();
  await handler(get("/api/health?compact=1"), res);
  return snap().body!.upstreams.find((upstream) => upstream.key === "chat")!;
}

describe("veredicto unificado cuando la gratis dice DOWN y la de pago responde", () => {
  it("con HTTP 500 en la gratis, las dos superficies dicen DOWN y la conclusión no da el chat por bueno", async () => {
    stubChat("500");

    const probe = await probeWebhook();
    const chat = await healthCompact();

    expect(chat.status).toBe("DOWN");
    expect(probe.status).toBe("DOWN");
    expect(probe.status).toBe(chat.status);

    expect(probe.attempts.map((attempt) => attempt.via)).toEqual(["salud", "como-hoy"]);
    expect(probe.attempts[0].ok).toBe(false);
    expect(probe.attempts[1]).toMatchObject({ ok: true, status: 200 });

    expect(probe.conclusion).toContain("DOWN");
    expect(probe.conclusion).toContain("HTTP 500");
    expect(probe.conclusion).toContain("clave de operador");
    expect(probe.conclusion).not.toMatch(/chat vive|chat responde|el fallo está en el webhook/);
  });

  it("si la gratis no responde a tiempo, el veredicto sigue siendo DOWN", async () => {
    stubChat("timeout");

    const probe = await probeWebhook();
    const chat = await healthCompact();

    expect(chat.status).toBe("DOWN");
    expect(probe.status).toBe("DOWN");
    expect(probe.conclusion).toContain("sin respuesta a tiempo");
    expect(probe.conclusion).not.toMatch(/chat vive|chat responde|el fallo está en el webhook/);
  });
});
