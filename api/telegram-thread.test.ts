/**
 * El hilo, de punta a punta.
 *
 * Tres cosas se comprueban aquí y no en un test unitario del helper:
 *  1. Con qué clave se llama al chat (la JWT, nunca la publicable).
 *  2. Que la memoria del hilo va delante del mensaje nuevo en el prompt.
 *  3. Que el turno se guarda sólo cuando la respuesta salió bien.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (req: unknown, res: unknown) => Promise<unknown>;

const JWT =
  "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.firma-de-prueba-suficientemente-larga";
const PUBLISHABLE = "sb_publishable_abc123";

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

function clearEnv(): void {
  for (const name of ENV_KEYS) delete process.env[name];
}

beforeEach(() => {
  clearEnv();
  process.env.TELEGRAM_BOT_TOKEN = "123:token-de-prueba";
  process.env.SUPABASE_URL = "https://proyecto.supabase.co";
  process.env.VITE_SUPABASE_ANON_KEY = JWT;
  // La que rompía el bot: presente, y no debe usarse.
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = PUBLISHABLE;
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  clearEnv();
});

function mockRes() {
  const res = {
    statusCode: 200,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json() {
      return res;
    },
    send() {
      return res;
    },
  };
  return res;
}

const reply = (status: number, text: string) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => "application/json" },
  text: async () => text,
  json: async () => JSON.parse(text),
});

const OK_STREAM = 'data: {"choices":[{"delta":{"content":"El mercado sube."}}]}\n\ndata: [DONE]\n\n';

interface Captured {
  chat?: { headers: Record<string, string>; body: Record<string, unknown> };
  saved: Array<Record<string, unknown>>;
}

/** Telegram acepta todo; el chat y el hilo responden lo que pida el caso. */
function stubFetch(chat: () => unknown): Captured {
  const captured: Captured = { saved: [] };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { method?: string; body?: string; headers?: Record<string, string> }) => {
      const target = String(url);
      const method = init?.method ?? "GET";

      if (target.includes("/functions/v1/chat-thread")) {
        if (method === "GET") {
          return reply(
            200,
            JSON.stringify({
              messages: [
                { role: "user", content: "me llamo Ana" },
                { role: "assistant", content: "encantado, Ana" },
              ],
            }),
          );
        }
        captured.saved.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
        return reply(200, JSON.stringify({ saved: true }));
      }

      if (target.includes("/functions/v1/chat")) {
        captured.chat = {
          headers: (init?.headers ?? {}) as Record<string, string>,
          body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
        };
        return chat();
      }

      if (target.includes("sendMessage") || target.includes("sendChatAction")) {
        return reply(200, '{"ok":true}');
      }
      return reply(200, '{"ok":true,"result":{}}');
    }),
  );
  return captured;
}

const update = { message: { chat: { id: 7 }, text: "y el mercado?" } };

async function run(updateBody: unknown = update): Promise<void> {
  const handler = (await import("./telegram-webhook")).default as unknown as Handler;
  await handler(
    {
      method: "POST",
      body: updateBody,
      headers: { host: "localhost" },
      socket: { remoteAddress: "203.0.113.9" },
    },
    mockRes(),
  );
}

describe("hilo de Telegram", () => {
  it("llama al chat con la JWT, no con la clave publicable", async () => {
    const captured = stubFetch(() => reply(200, OK_STREAM));
    await run();

    expect(captured.chat?.headers.Authorization).toBe(`Bearer ${JWT}`);
    expect(captured.chat?.headers.apikey).toBe(JWT);
  });

  it("manda un hilo opaco de 128 bits, sin el chat_id", async () => {
    const captured = stubFetch(() => reply(200, OK_STREAM));
    await run();

    const thread = captured.chat?.body.thread as { surface: string; externalId: string };
    expect(thread.surface).toBe("telegram");
    expect(thread.externalId).toMatch(/^tg_[0-9a-f]{32}$/);
    // El chat_id 7 no aparece como valor suelto en lo que se envía al chat.
    expect(JSON.stringify(captured.chat?.body)).not.toContain('"7"');
  });

  it("antepone la memoria del hilo al mensaje nuevo", async () => {
    const captured = stubFetch(() => reply(200, OK_STREAM));
    await run();

    const messages = captured.chat?.body.messages as Array<{ role: string; content: string }>;
    expect(messages).toHaveLength(3);
    expect(messages[0]).toEqual({ role: "user", content: "me llamo Ana" });
    expect(messages[1].content).toContain("encantado");
    expect(messages[2]).toEqual({ role: "user", content: "y el mercado?" });
  });

  it("guarda el turno cuando la respuesta sale bien", async () => {
    const captured = stubFetch(() => reply(200, OK_STREAM));
    await run();

    expect(captured.saved).toHaveLength(1);
    expect(captured.saved[0].user).toBe("y el mercado?");
    expect(captured.saved[0].assistant).toBe("El mercado sube.");
    expect((captured.saved[0].thread as { externalId: string }).externalId).toMatch(/^tg_[0-9a-f]{32}$/);
  });

  it("no guarda nada si el chat falla", async () => {
    const captured = stubFetch(() => reply(401, '{"message":"Invalid API key"}'));
    await run();

    expect(captured.saved).toHaveLength(0);
  });

  it("si la memoria no responde, el chat sigue funcionando sin historial", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: { method?: string }) => {
        const target = String(url);
        if (target.includes("chat-thread")) throw new Error("memoria caída");
        if (target.includes("/functions/v1/chat")) {
          const capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
          expect((capturedBody.messages as unknown[]).length).toBe(1);
          return reply(200, OK_STREAM);
        }
        return reply(200, '{"ok":true}');
      }),
    );

    await run();
  });
});
