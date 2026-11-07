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
  if (env.VERCEL_ENV) process.env.VERCEL_ENV = env.VERCEL_ENV;
  else delete process.env.VERCEL_ENV;
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
      json(payload: unknown) {
        resolve({ status: this.statusCode, body: JSON.stringify(payload) });
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

const TELEGRAM_OK = (result: unknown) =>
  new Response(JSON.stringify({ ok: true, result }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

/** Telegram responde ok a sendMessage; la función de chat responde un SSE. */
function stubNetwork(webhookUrl = "https://aitor.alienflow.space/api/telegram-webhook") {
  const fetchMock = vi.fn(async (url: string) => {
    if (typeof url === "string" && url.includes("/getMe")) {
      return TELEGRAM_OK({ id: 7_000_001, username: "Alien69Bot", first_name: "AI Tor" });
    }
    if (typeof url === "string" && url.includes("/getWebhookInfo")) {
      return TELEGRAM_OK({ url: webhookUrl, pending_update_count: 0 });
    }
    if (typeof url === "string" && url.includes("/setWebhook")) {
      return TELEGRAM_OK(true);
    }
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

  it("el diagnóstico GET devuelve el estado real del webhook sin exponer secretos", async () => {
    stubNetwork();
    const handler = await load({
      TELEGRAM_BOT_TOKEN: "test-token",
      TELEGRAM_WEBHOOK_SECRET: "s3cr3t",
      VERCEL_ENV: "production",
    });

    const { status, body } = await invoke(handler, null, {}, "GET");

    expect(status).toBe(200);
    const payload = JSON.parse(body);
    expect(payload.bot.username).toBe("Alien69Bot");
    expect(payload.secretConfigured).toBe(true);
    expect(payload.webhook.matchesExpected).toBe(true);
    expect(payload.registration).toBe("ya-registrado");
    expect(body).not.toContain("test-token");
    expect(body).not.toContain("s3cr3t");
  });

  it("si la URL registrada no es la buena, el diagnóstico la corrige con el secreto", async () => {
    const fetchMock = stubNetwork("https://viejo.example/hook");
    const handler = await load({
      TELEGRAM_BOT_TOKEN: "test-token",
      TELEGRAM_WEBHOOK_SECRET: "s3cr3t",
      VERCEL_ENV: "production",
    });

    const { status, body } = await invoke(handler, null, {}, "GET");

    expect(status).toBe(200);
    expect(JSON.parse(body).registration).toBe("registrado-con-secreto");
    const set = fetchMock.mock.calls.find(([url]) => String(url).includes("/setWebhook"));
    expect(set).toBeDefined();
    const sent = JSON.parse(String((set![1] as RequestInit).body));
    expect(sent.url).toBe("https://aitor.alienflow.space/api/telegram-webhook");
    expect(sent.secret_token).toBe("s3cr3t");
  });

  it("un despliegue de preview no roba el webhook de producción", async () => {
    const fetchMock = stubNetwork("https://viejo.example/hook");
    const handler = await load({
      TELEGRAM_BOT_TOKEN: "test-token",
      TELEGRAM_WEBHOOK_SECRET: "s3cr3t",
      VERCEL_ENV: "preview",
    });

    const { status, body } = await invoke(handler, null, {}, "GET");

    expect(status).toBe(200);
    expect(JSON.parse(body).registration).toBe("no-produccion");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/setWebhook"))).toBe(false);
  });
});
