/**
 * Cuando la función `chat` falla, el bot tiene que decir por qué.
 *
 * Durante días contestó «Mi núcleo cuántico está recalibrando frecuencias» por
 * una clave inválida: el usuario no podía distinguir su mensaje de un
 * despliegue roto. Esta suite recorre el camino real (actualización de
 * Telegram → chat → sendMessage) y mira el texto que llega al chat.
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
];

function clearEnv(): void {
  for (const name of ENV_KEYS) delete process.env[name];
}

beforeEach(() => {
  clearEnv();
  process.env.TELEGRAM_BOT_TOKEN = "123:token-de-prueba";
  process.env.SUPABASE_URL = "https://proyecto.supabase.co";
  process.env.VITE_SUPABASE_ANON_KEY = "anon-de-prueba";
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

const update = {
  message: { chat: { id: 7 }, text: "hola, ¿qué ves en el mercado?" },
};

const req = () =>
  ({
    method: "POST",
    body: update,
    headers: { host: "localhost" },
    socket: { remoteAddress: "203.0.113.5" },
  }) as never;

/** Telegram acepta todo; el chat responde lo que pida cada caso. */
function stubFetch(chat: () => unknown) {
  const sentToUser: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { body?: string }) => {
      const target = String(url);
      if (target.includes("sendMessage")) {
        const body = JSON.parse(String(init?.body ?? "{}\"));
        sentToUser.push(String(body.text ?? ""));
        return response(200, '{"ok":true}');
      }
      if (target.includes("sendChatAction") || target.includes("setWebhook")) {
        return response(200, '{"ok":true,"result":true}');
      }
      if (target.includes("getMe") || target.includes("getWebhookInfo")) {
        return response(200, '{"ok":true,"result":{"id":1,"url":""}}');
      }
      return chat();
    }),
  );
  return sentToUser;
}

describe("el bot explica el fallo del chat", () => {
  it("gateway de Supabase: dice que la clave de Supabase no vale", async () => {
    const sent = stubFetch(() =>
      response(
        401,
        '{"message":"Invalid API key","hint":"Double check the provided API key for typos. This API key might also be owned by another Supabase project."}',
      ),
    );
    const handler = await loadHandler();
    const { res } = mockRes();

    await handler(req(), res);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain("clave de Supabase");
    expect(sent[0]).toContain("Invalid API key");
    expect(sent[0]).not.toContain("recalibrando frecuencias");
  });

  it("proveedor de IA: dice que rechazó la clave del bot", async () => {
    const sent = stubFetch(() => response(401, '{"error":"Provider authentication failed."}'));
    const handler = await loadHandler();

    await handler(req(), mockRes().res);

    expect(sent[0]).toContain("proveedor de IA rechazó la clave");
    expect(sent[0]).not.toContain("recalibrando frecuencias");
  });

  it("5xx: dice que la función está fallando, con el código", async () => {
    const sent = stubFetch(() => response(500, '{"error":"boom"}'));
    const handler = await loadHandler();

    await handler(req(), mockRes().res);

    expect(sent[0]).toContain("HTTP 500");
    expect(sent[0]).not.toContain("recalibrando frecuencias");
  });

  it("sin respuesta: dice que no hay conexión", async () => {
    const sent = stubFetch(() => {
      throw new Error("fetch failed");
    });
    const handler = await loadHandler();

    await handler(req(), mockRes().res);

    expect(sent[0]).toContain("No hay conexión");
    expect(sent[0]).not.toContain("campo cuántico");
  });

  it("el camino feliz sigue enviando el texto del modelo", async () => {
    const sent = stubFetch(() =>
      response(200, 'data: {"choices":[{"delta":{"content":"El mercado sube."}}]}\n\ndata: [DONE]\n\n'),
    );
    const handler = await loadHandler();

    await handler(req(), mockRes().res);

    expect(sent[0]).toContain("El mercado sube.");
  });
});
