/**
 * Tope de gasto por chat: al llegar al límite, el bot contesta sin llamar al
 * modelo. Se recorre el camino real (actualización → webhook → chat/Supabase →
 * sendMessage) y se mira cuántas veces se llamó a la función `chat`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetBudgetForTest } from "./_shared/chat-budget";

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

const response = (status: number, text: string) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => "application/json" },
  text: async () => text,
  json: async () => JSON.parse(text),
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
  "CHAT_DAILY_TURN_LIMIT",
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
  process.env.TELEGRAM_BOT_TOKEN = "123:token-de-prueba";
  process.env.TELEGRAM_WEBHOOK_SECRET = "secreto-de-prueba";
  process.env.SUPABASE_URL = "https://proyecto.supabase.co";
  process.env.VITE_SUPABASE_ANON_KEY = "anon-de-prueba";
  process.env.PUBLIC_URL = "https://bot.example";
  process.env.CHAT_DAILY_TURN_LIMIT = "1";
  __resetBudgetForTest();
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  __resetBudgetForTest();
  clearEnv();
});

async function loadHandler(): Promise<Handler> {
  const module = await import("./telegram-webhook");
  return module.default as unknown as Handler;
}

const SSE = 'data: {"choices":[{"delta":{"content":"Hola desde el modelo"}}]}\n\ndata: [DONE]\n';

/** Cuenta llamadas a la función `chat` y devuelve un turno válido. */
function stubChat() {
  const chatCalls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const target = String(url);
      if (target.includes("/functions/v1/chat")) {
        chatCalls.push(target);
        return response(200, SSE);
      }
      if (target.includes("api.telegram.org")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, result: {} }), text: async () => "{}" };
      }
      return response(404, "{}");
    }),
  );
  return chatCalls;
}

function sentTexts(): string[] {
  const fetchMock = globalThis.fetch as unknown as { mock: { calls: unknown[][] } };
  return fetchMock.mock.calls
    .filter((call) => String(call[0]).includes("sendMessage"))
    .map((call) => {
      const init = call[1] as { body?: string } | undefined;
      return init?.body ? ((JSON.parse(init.body) as { text?: string }).text ?? "") : "";
    })
    .filter(Boolean);
}

async function say(text: string, updateId: number) {
  const handler = await loadHandler();
  const { res, snap } = mockRes();
  await handler(
    {
      method: "POST",
      url: "/api/telegram-webhook",
      headers: { "x-telegram-bot-api-secret-token": "secreto-de-prueba" },
      body: { update_id: updateId, message: { chat: { id: 7 }, text } },
    },
    res,
  );
  return snap();
}

describe("tope diario por chat", () => {
  it("la primera pregunta llega al modelo y la segunda no", async () => {
    const chatCalls = stubChat();

    await say("hola, ¿qué ves?", 1);
    expect(chatCalls.length).toBe(1);
    expect(sentTexts().at(-1)).toContain("Hola desde el modelo");

    await say("y ahora otra más", 2);
    expect(chatCalls.length).toBe(1);
    const refused = sentTexts().at(-1) ?? "";
    expect(refused).toContain("Tope diario");
    expect(refused).toContain("1 de 1");
    expect(refused).toContain("/senal");

    // Insistir no repite el aviso: un mensaje más del tope no puede convertirse
    // en spam. Sigue sin llamar al modelo y sin escribir nada.
    const sent = sentTexts().length;
    await say("insisto", 3);
    await say("insisto otra vez", 4);
    expect(chatCalls.length).toBe(1);
    expect(sentTexts().length).toBe(sent);
    expect(sentTexts().filter((text) => text.includes("Tope diario"))).toHaveLength(1);
  });

  it("el tope no bloquea lo que no gasta modelo", async () => {
    const chatCalls = stubChat();
    await say("hola", 1);
    await say("otra", 2); // agota el tope
    await say("/senal", 3);

    expect(chatCalls.length).toBe(1);
    // /senal pide /api/signal, no el modelo; aquí esa ruta no está simulada,
    // así que contesta el estado vacío honesto, pero no gasta cuota.
    const last = sentTexts().at(-1) ?? "";
    expect(last).toContain("Sin señal de BTC");
  });
});
