/**
 * `GET ?probe=1` del webhook, con `fetch` simulado.
 *
 * Lo que se fija: que sin clave de operador no se llama al modelo (la sonda
 * gratuita sí), que con clave se prueban las dos formas de credencial, y que
 * la respuesta no lleva nunca el valor de la clave.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (req: unknown, res: unknown) => Promise<unknown>;

function mockRes() {
  let status = 0;
  let body: any = null;
  let sent: string | null = null;
  const res = {
    statusCode: 200,
    status(code: number) {
      status = code;
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      body = payload;
      return res;
    },
    send(payload: unknown) {
      sent = String(payload);
      return res;
    },
  };
  return { res, snap: () => ({ status, body, sent }) };
}

function response(status: number, text: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : null) },
    text: async () => text,
    json: async () => JSON.parse(text),
  };
}

const OPERATOR = "clave-de-operador";
const PUBLISHABLE = "sb_publishable_no_debe_salir";

const ENV_KEYS = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "MANUS_API_KEY",
  "OPERATOR_KEY",
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_ANON_KEY",
  "VERCEL_ENV",
];

function clearEnv(): void {
  for (const name of ENV_KEYS) delete process.env[name];
}

beforeEach(() => {
  clearEnv();
  process.env.TELEGRAM_BOT_TOKEN = "123:token-de-prueba";
  process.env.SUPABASE_URL = "https://proyecto.supabase.co";
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = PUBLISHABLE;
  process.env.OPERATOR_KEY = OPERATOR;
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  clearEnv();
});

/** Carga el módulo después de fijar el entorno (lee process.env al importarse). */
async function loadHandler(): Promise<Handler> {
  const module = await import("./telegram-webhook");
  return module.default as unknown as Handler;
}

/** Telegram responde bien; el chat devuelve el estado que se le pida. */
function stubFetch(chatStatus = 401, chatBody = '{"error":"Provider authentication failed."}') {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { method?: string }) => {
      const method = init?.method ?? "GET";
      calls.push(`${method} ${String(url)}`);
      if (String(url).includes("api.telegram.org")) {
        return response(200, JSON.stringify({ ok: true, result: { id: 1, username: "bot" } }));
      }
      if (String(url).includes("health=1")) {
        return response(200, JSON.stringify({ status: "ok", models: [] }));
      }
      return response(chatStatus, chatBody);
    }),
  );
  return calls;
}

const req = (url: string, headers: Record<string, string> = {}) =>
  ({ method: "GET", url, headers: { host: "localhost", ...headers } }) as never;

describe("GET /api/telegram-webhook?probe=1", () => {
  it("sin clave de operador sólo hace la comprobación gratuita", async () => {
    const calls = stubFetch();
    const handler = await loadHandler();
    const { res, snap } = mockRes();

    await handler(req("/api/telegram-webhook?probe=1"), res);
    const body = snap().body;

    expect(snap().status).toBe(200);
    expect(body.chatProbe.attempts).toHaveLength(1);
    expect(body.chatProbe.attempts[0].via).toBe("salud");
    expect(body.chatProbe.note).toContain("OPERATOR_KEY");
    // Sólo GET al chat: ninguna llamada al modelo.
    expect(calls.filter((call) => call.startsWith("POST") && call.includes("functions/v1/chat"))).toHaveLength(0);
  });

  it("con clave llama al modelo por las dos formas y no filtra la credencial", async () => {
    stubFetch();
    const handler = await loadHandler();
    const { res, snap } = mockRes();

    await handler(req("/api/telegram-webhook?probe=1", { "x-api-key": OPERATOR }), res);
    const body = snap().body;

    expect(body.chatProbe.attempts.map((attempt: { via: string }) => attempt.via)).toEqual([
      "salud",
      "como-hoy",
      "solo-apikey",
    ]);
    // Con una publicable en el entorno y ninguna JWT, se usa la JWT del
    // repositorio: es justo el arreglo. Antes se informaba `publishable` y el
    // bot se quedaba mudo.
    expect(body.chatProbe.keyKind).toBe("jwt");
    expect(body.chatProbe.conclusion).toContain("rechaza la credencial");
    expect(JSON.stringify(body)).not.toContain(PUBLISHABLE);
  });

  it("si el chat contesta, la conclusión señala al webhook", async () => {
    stubFetch(200, 'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n');
    const handler = await loadHandler();
    const { res, snap } = mockRes();

    await handler(req("/api/telegram-webhook?probe=1", { "x-api-key": OPERATOR }), res);

    expect(snap().body.chatProbe.conclusion).toContain("el fallo está en el webhook");
  });

  it("sin ?probe=1 no se sonda nada", async () => {
    const calls = stubFetch();
    const handler = await loadHandler();
    const { res, snap } = mockRes();

    await handler(req("/api/telegram-webhook"), res);

    expect(snap().body.chatProbe).toBeNull();
    expect(calls.some((call) => call.includes("functions/v1/chat"))).toBe(false);
  });
});
