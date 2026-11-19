/**
 * El conocimiento curado entra en el turno del bot sólo cuando toca.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (req: unknown, res: unknown) => Promise<unknown>;

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
];

beforeEach(() => {
  for (const name of ENV_KEYS) delete process.env[name];
  process.env.TELEGRAM_BOT_TOKEN = "123:token-de-prueba";
  process.env.SUPABASE_URL = "https://proyecto.supabase.co";
  process.env.VITE_SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.firma-de-prueba-suficientemente-larga";
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

const reply = (status: number, text: string) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => "application/json" },
  text: async () => text,
  json: async () => JSON.parse(text),
});

const OK_STREAM = 'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n';

function stubFetch(messages: string[]): { chatBodies: Array<Record<string, unknown>> } {
  const chatBodies: Array<Record<string, unknown>> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      const target = String(url);
      if (target.includes("/functions/v1/chat-thread")) {
        return reply(200, JSON.stringify({ messages: [] }));
      }
      if (target.includes("/functions/v1/chat")) {
        chatBodies.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
        return reply(200, OK_STREAM);
      }
      return reply(200, '{"ok":true}');
    }),
  );
  return { chatBodies };
}

async function run(text: string): Promise<void> {
  const handler = (await import("./telegram-webhook")).default as unknown as Handler;
  await handler(
    {
      method: "POST",
      body: { message: { chat: { id: 42 }, text } },
      headers: { host: "localhost" },
      socket: { remoteAddress: "203.0.113.11" },
    },
    {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json() {
        return this;
      },
      send() {
        return this;
      },
    },
  );
}

describe("conocimiento en el turno", () => {
  it("una pregunta de la DAO lleva el bloque de contexto", async () => {
    const { chatBodies } = stubFetch([]);
    await run("¿cómo funciona la gobernanza de la DAO?");

    const context = chatBodies[0].context as string[];
    expect(Array.isArray(context)).toBe(true);
    expect(context).toHaveLength(1);
    expect(context[0]).toContain("AlienFlowSpace DAO");
  });

  it("una pregunta de mercados no lleva contexto inventado", async () => {
    const { chatBodies } = stubFetch([]);
    await run("¿cuánto cuesta el bitcoin hoy?");

    expect(chatBodies[0].context).toBeUndefined();
  });
});
