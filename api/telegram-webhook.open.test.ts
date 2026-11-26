/**
 * El webhook es fail-closed: sin `TELEGRAM_WEBHOOK_SECRET` no procesa nada.
 *
 * El 401 no depende de que Telegram firme mal: si la variable no llegó al
 * despliegue, el handler corta antes de mirar el cuerpo y contesta lo mismo que
 * a una firma incorrecta. Lo que esta suite fija es eso —el comportamiento de
 * `main` y el que producción sirve— para que nadie lo abra «para que el bot no
 * se quede mudo» sin decidirlo antes.
 *
 * El precio de cerrar es visible: `secretConfigured: false` en el informe GET,
 * `registration` sin secreto y un 401 anotado por Telegram en
 * `getWebhookInfo`. El precio de abrir no se ve: gasta cuota de IA cualquiera
 * que conozca la URL.
 *
 * El handler lee `TELEGRAM_WEBHOOK_SECRET` **al importarse**, no en cada
 * petición, así que cada caso fija el entorno y recarga el módulo; el primero
 * comprueba además que no hay secreto colado antes de medir nada.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (req: unknown, res: unknown) => Promise<unknown>;

type Report = {
  ok?: boolean;
  secretConfigured?: boolean;
  registration?: string;
  expectedUrl?: string;
};

function mockRes() {
  let status = 0;
  let sent: string | null = null;
  let body: Report | null = null;
  const res = {
    statusCode: 200,
    status(code: number) {
      status = code;
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      body = payload as Report;
      return res;
    },
    send(payload: unknown) {
      sent = String(payload);
      return res;
    },
  };
  return { res, snap: () => ({ status, sent, body }) };
}

/**
 * Telegram dice que sí a todo, y `getWebhookInfo` devuelve una URL vacía: así el
 * auto-registro sin secreto no llama a `setWebhook` y el estado que se observa
 * es `sin-secreto`, no `ya-registrado`.
 */
function stubTelegram() {
  const mock = vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: { get: () => "application/json" },
    text: async () => '{"ok":true,"result":{"id":1,"username":"bot","url":""}}',
    json: async () => ({ ok: true, result: { id: 1, username: "bot", url: "" } }),
  }));
  vi.stubGlobal("fetch", mock);
  return mock;
}

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
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];

function clearEnv(): void {
  for (const name of ENV_KEYS) delete process.env[name];
}

beforeEach(() => {
  clearEnv();
  // Token sí, secreto no: es exactamente el despliegue que respondió 401.
  process.env.TELEGRAM_BOT_TOKEN = "123:token-de-prueba";
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  clearEnv();
});

/** El módulo se carga después de fijar el entorno: lee `process.env` al importarse. */
async function loadHandler(): Promise<Handler> {
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
  const module = await import("./telegram-webhook");
  return module.default as unknown as Handler;
}

async function loadHandlerWithSecret(secret: string): Promise<Handler> {
  process.env.TELEGRAM_WEBHOOK_SECRET = secret;
  const module = await import("./telegram-webhook");
  return module.default as unknown as Handler;
}

const IP = "203.0.113.10";

/**
 * Un sticker: llega `message` pero sin `text`, así que el handler reconoce la
 * actualización sin llamar al modelo. La puerta ya se ha cruzado (o no) cuando
 * se decide eso, que es justo lo que este fichero mide.
 */
const update = {
  update_id: 1,
  message: { message_id: 1, chat: { id: 7 }, sticker: { file_id: "AgAD-de-prueba" } },
};

const post = (headers: Record<string, string> = {}, ip = IP) =>
  ({
    method: "POST",
    body: update,
    headers: { host: "localhost", "x-forwarded-for": ip, ...headers },
    socket: { remoteAddress: ip },
  }) as never;

const get = () => ({ method: "GET", url: "/api/telegram-webhook", headers: { host: "localhost" } }) as never;

describe("sin TELEGRAM_WEBHOOK_SECRET el webhook rechaza con 401", () => {
  it("el informe GET dice que no hay secreto y que el registro no lo lleva", async () => {
    stubTelegram();
    expect(process.env.TELEGRAM_WEBHOOK_SECRET).toBeUndefined();
    const handler = await loadHandler();
    const { res, snap } = mockRes();

    await handler(get(), res);

    expect(snap().status).toBe(200);
    // Si esto no se cumple, el 401 de los casos siguientes vendría de un
    // secreto que nadie ha puesto aquí.
    expect(snap().body?.secretConfigured).toBe(false);
    expect(snap().body?.registration).toBe("sin-secreto");
  });

  it("una actualización sin firma se rechaza con 401 y queda en el log", async () => {
    const fetchMock = stubTelegram();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = await loadHandler();
    const { res, snap } = mockRes();

    await handler(post(), res);

    expect(snap().status).toBe(401);
    expect(snap().sent).toBe("Unauthorized");
    const logged = log.mock.calls.map((call) => call.join(" ")).join(" ");
    // El motivo tiene que quedar en el log: el 401 solo no dice qué falta.
    expect(logged).toContain("TELEGRAM_WEBHOOK_SECRET");

    // Y se rechaza antes de gastar cuota: nada sale hacia Supabase ni hacia el
    // modelo, sólo las llamadas a la API de Telegram del auto-registro.
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.every((url) => url.includes("api.telegram.org"))).toBe(true);
  });

  it("una cabecera inventada tampoco pasa", async () => {
    stubTelegram();
    const handler = await loadHandler();
    const { res, snap } = mockRes();

    await handler(post({ "x-telegram-bot-api-secret-token": "firma-que-nadie-compara" }), res);

    expect(snap().status).toBe(401);
  });
});

describe("con TELEGRAM_WEBHOOK_SECRET la firma es la puerta", () => {
  it("la cabecera correcta pasa y la incorrecta no", async () => {
    stubTelegram();
    const secret = "secreto-de-prueba-123";
    vi.resetModules();
    const handler = await loadHandlerWithSecret(secret);

    const ok = mockRes();
    await handler(post({ "x-telegram-bot-api-secret-token": secret }), ok.res);
    expect(ok.snap().status).toBe(200);
    expect(ok.snap().sent).toBe("OK");

    const bad = mockRes();
    await handler(post({ "x-telegram-bot-api-secret-token": "otro-valor" }), bad.res);
    expect(bad.snap().status).toBe(401);

    const none = mockRes();
    await handler(post(), none.res);
    expect(none.snap().status).toBe(401);
  });
});
