/**
 * `/senal`: el bot tiene que enseñar precio, fuente y hora de lo que sirve
 * `/api/signal`, y no una cifra cuando la función no responde.
 *
 * Se recorre el camino real (actualización de Telegram → /senal → sendMessage) y
 * se mira el texto que llega al chat.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (req: unknown, res: unknown) => Promise<unknown>;

function mockRes() {
  let status = 0;
  let sent: string | null = null;
  const res = {
    statusCode: 200,
    status(code: number) {
      status = code;
      res.statusCode = code;
      return res;
    },
    json() {
      return res;
    },
    send(payload: unknown) {
      sent = String(payload);
      return res;
    },
  };
  return { res, snap: () => ({ status, sent }) };
}

const response = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => "application/json" },
  text: async () => JSON.stringify(body),
  json: async () => body,
});

const ENV_KEYS = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "MANUS_API_KEY",
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "OPERATOR_KEY",
  "VERCEL_ENV",
  "PUBLIC_URL",
];

function clearEnv(): void {
  for (const name of ENV_KEYS) delete process.env[name];
}

beforeEach(() => {
  clearEnv();
  process.env.TELEGRAM_BOT_TOKEN = "123:token-de-prueba";
  process.env.TELEGRAM_WEBHOOK_SECRET = "secreto-de-prueba";
  process.env.SUPABASE_URL = "https://proyecto.supabase.co";
  process.env.VITE_SUPABASE_ANON_KEY = "anon-de-prueba";
  process.env.PUBLIC_URL = "https://bot.example";
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  clearEnv();
});

async function loadHandler(): Promise<Handler> {
  const module = await import("./telegram-webhook");
  return module.default as unknown as Handler;
}

const SIGNAL = {
  ok: true,
  servedFrom: "api/signal",
  cache: "hit",
  ageSeconds: 12,
  stale: false,
  signal: {
    symbol: "BTC",
    id: "bitcoin",
    priceUsd: 61241,
    asOf: "2026-11-23T00:33:47.000Z",
    fetchedAt: "2026-11-23T00:34:28.829Z",
    source: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    sourceName: "CoinGecko",
  },
};

/** Simula la función de señal y la API de Telegram; apunta lo enviado. */
function stubDeployment(signalResponse: { status: number; body: unknown }) {
  const sent: string[] = [];
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(String(url));
      if (String(url).startsWith("https://bot.example/api/signal")) {
        return response(signalResponse.status, signalResponse.body);
      }
      if (String(url).includes("api.telegram.org")) {
        const body = sent;
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, result: { message_id: body.length + 1 } }),
          text: async () => "{}",
        };
      }
      return response(404, { ok: false });
    }),
  );
  return { sent, calls };
}

/** Los `text` de cada sendMessage son lo que ve el usuario. */
function sentTexts(): string[] {
  const fetchMock = globalThis.fetch as unknown as { mock: { calls: unknown[][] } };
  return fetchMock.mock.calls
    .filter((call) => String(call[0]).includes("sendMessage"))
    .map((call) => {
      const init = call[1] as { body?: string } | undefined;
      if (!init?.body) return "";
      return (JSON.parse(init.body) as { text?: string }).text ?? "";
    })
    .filter(Boolean);
}

async function command(text: string) {
  const handler = await loadHandler();
  const { res, snap } = mockRes();
  await handler(
    {
      method: "POST",
      url: "/api/telegram-webhook",
      headers: { "x-telegram-bot-api-secret-token": "secreto-de-prueba" },
      body: { update_id: 1, message: { chat: { id: 7 }, text } },
    },
    res,
  );
  return snap();
}

describe("/senal", () => {
  it("contesta precio, fuente y las dos horas servidas por /api/signal", async () => {
    const stub = stubDeployment({ status: 200, body: SIGNAL });
    const snap = await command("/senal BTC");
    expect(snap.status).toBe(200);
    const text = sentTexts().at(-1) ?? "";
    expect(text).toContain("BTC");
    expect(text).toContain("61.241,00");
    expect(text).toContain("CoinGecko");
    expect(text).toContain("2026-11-23T00:33:47.000Z");
    expect(text).toContain("2026-11-23T00:34:28.829Z");
    expect(stub.calls.some((url) => url.includes("/api/signal?symbol=BTC"))).toBe(true);
  });

  it("sin precio no enseña cifra: dice el motivo", async () => {
    stubDeployment({
      status: 502,
      body: { ok: false, code: "source", reason: "la fuente no respondió: timeout" },
    });
    await command("/senal BTC");
    const text = sentTexts().at(-1) ?? "";
    expect(text).toContain("Sin señal de BTC");
    expect(text).toContain("timeout");
    expect(text).not.toMatch(/\$\d/);
  });

  it("un símbolo que no conozco no llega a pedir nada", async () => {
    const stub = stubDeployment({ status: 200, body: SIGNAL });
    await command("/senal DOGE");
    const text = sentTexts().at(-1) ?? "";
    expect(text).toContain("BTC, ETH, SOL, TON");
    expect(stub.calls.some((url) => url.includes("/api/signal"))).toBe(false);
  });

  it("por defecto consulta BTC", async () => {
    const stub = stubDeployment({ status: 200, body: SIGNAL });
    await command("/senal");
    expect(stub.calls.some((url) => url.includes("/api/signal?symbol=BTC"))).toBe(true);
  });
});
