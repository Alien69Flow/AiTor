import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * El bot dejó de responder por la puerta de la firma, no por Telegram ni por el
 * modelo: con `TELEGRAM_WEBHOOK_SECRET` sin configurar el handler respondía 401
 * a cada entrega y el usuario sólo veía silencio. Estas pruebas fijan el
 * contrato real:
 *
 *   - sin secreto configurado → se atiende (con cuota por IP)
 *   - con secreto configurado → sólo pasa la firma exacta
 *   - la respuesta del modelo llega al chat como mensaje de Telegram
 */

const SSE = [
  'data: {"choices":[{"delta":{"content":"hola desde el núcleo"}}]}',
  "",
  "data: [DONE]",
  "",
].join("\n");

interface Call {
  status: number;
  body: string;
}

/** Carga el handler con un entorno concreto (lee process.env al importarse). */
async function load(env: Record<string, string>) {
  vi.resetModules();
  process.env.TELEGRAM_BOT_TOKEN = env.TELEGRAM_BOT_TOKEN ?? "";
  process.env.TELEGRAM_WEBHOOK_SECRET = env.TELEGRAM_WEBHOOK_SECRET ?? "";
  const module = await import("./telegram-webhook");
  return module.default as unknown as (
    req: unknown,
    res: unknown,
  ) => Promise<unknown>;
}

function invoke(
  handler: (req: unknown, res: unknown) => Promise<unknown>,
  body: unknown,
  headers: Record<string, string> = {},
  method = "POST",
): Promise<Call> {
  return new Promise((resolve) => {
    const req = {
      method,
      body,
      headers,
      socket: { remoteAddress: "198.51.100.4" },
    };
    const res = {
      statusCode: 0,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      send(payload: string) {
        resolve({ status: this.statusCode, body: payload });
      },
      end() {
        resolve({ status: this.statusCode, body: "" });
      },
    };
    void handler(req, res);
  });
}

const update = (text: string) => ({
  update_id: 1,
  message: {
    message_id: 7,
    date: 1_700_000_000,
    chat: { id: 4242, type: "private" },
    from: { id: 4242, is_bot: false, first_name: "Tester" },
    text,
  },
});

/** Telegram responde ok a sendMessage; la función de chat responde un SSE. */
function stubNetwork() {
  const fetchMock = vi.fn(async (url: string) => {
    if (typeof url === "string" && url.includes("/sendMessage")) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (typeof url === "string" && url.includes("/sendChatAction")) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return new Response(SSE, { status: 200, headers: { "content-type": "text/event-stream" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("webhook de Telegram", () => {
  it("sin secreto configurado el bot sigue respondiendo", async () => {
    const fetchMock = stubNetwork();
    const handler = await load({ TELEGRAM_BOT_TOKEN: "test-token" });

    const { status } = await invoke(handler, update("hola"));

    expect(status).toBe(200);
    const sent = fetchMock.mock.calls.filter(([url]) => String(url).includes("/sendMessage"));
    expect(sent.length).toBeGreaterThan(0);
    const payload = JSON.parse(String((sent[0][1] as RequestInit).body));
    expect(payload.chat_id).toBe(4242);
    expect(payload.text).toContain("hola desde el núcleo");
  });

  it("con secreto configurado, una entrega sin firma se rechaza sin gastar cuota", async () => {
    const fetchMock = stubNetwork();
    const handler = await load({ TELEGRAM_BOT_TOKEN: "test-token", TELEGRAM_WEBHOOK_SECRET: "s3cr3t" });

    const { status } = await invoke(handler, update("hola"));

    expect(status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("con secreto configurado, una firma distinta también se rechaza", async () => {
    stubNetwork();
    const handler = await load({ TELEGRAM_BOT_TOKEN: "test-token", TELEGRAM_WEBHOOK_SECRET: "s3cr3t" });

    const { status } = await invoke(handler, update("hola"), {
      "x-telegram-bot-api-secret-token": "otro",
    });

    expect(status).toBe(401);
  });

  it("con la firma correcta el mensaje se contesta", async () => {
    const fetchMock = stubNetwork();
    const handler = await load({ TELEGRAM_BOT_TOKEN: "test-token", TELEGRAM_WEBHOOK_SECRET: "s3cr3t" });

    const { status } = await invoke(handler, update("hola"), {
      "x-telegram-bot-api-secret-token": "s3cr3t",
    });

    expect(status).toBe(200);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/sendMessage"))).toBe(true);
  });

  it("/start contesta sin llamar al modelo", async () => {
    const fetchMock = stubNetwork();
    const handler = await load({ TELEGRAM_BOT_TOKEN: "test-token" });

    const { status } = await invoke(handler, update("/start"));

    expect(status).toBe(200);
    // Sólo sendMessage: el saludo es texto fijo, no consume IA.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/sendMessage");
  });

  it("un GET no es un webhook", async () => {
    stubNetwork();
    const handler = await load({ TELEGRAM_BOT_TOKEN: "test-token" });

    const { status } = await invoke(handler, null, {}, "GET");

    expect(status).toBe(405);
  });
});
