/**
 * Prueba del puente web <-> Telegram en api/telegram-webhook.ts, sin salir a
 * la red: fetch se sustituye por un doble que registra las llamadas.
 *
 * Ejecutar con:  npx tsx scripts/test-telegram-bridge.ts   (exit != 0 si falla)
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

process.env.TELEGRAM_BOT_TOKEN = "test-token";
process.env.TELEGRAM_WEBHOOK_SECRET = "test-secret";

type FetchCall = { url: string; body: Record<string, unknown> | null };
const calls: FetchCall[] = [];

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
  calls.push({ url, body });
  return new Response(JSON.stringify({ ok: true, result: {} }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}) as typeof fetch;

const handler = (await import(new URL("../api/telegram-webhook.ts", import.meta.url).href)).default;

let failures = 0;
function check(condition: boolean, label: string, detail?: unknown) {
  if (condition) {
    console.log(`  ✔ ${label}`);
  } else {
    failures++;
    console.error(`  ✘ ${label}`, detail ?? "");
  }
}

async function post(body: unknown, withSecret = true) {
  calls.length = 0;
  let status = 0;
  let out: unknown = "";
  const res = {
    status(code: number) {
      status = code;
      return res;
    },
    send(payload: unknown) {
      out = payload;
      return res;
    },
  } as unknown as VercelResponse;
  const headers: Record<string, string> = {};
  if (withSecret) headers["x-telegram-bot-api-secret-token"] = "test-secret";
  const req = { method: "POST", headers, body } as unknown as VercelRequest;
  await handler(req, res);
  return { status, out, calls: calls.slice() };
}

const message = (text: string) => ({ message: { chat: { id: 777 }, text } });

console.log("1) request sin cabecera de secreto");
{
  const r = await post({ message: { chat: { id: 1 }, text: "/start" } }, false);
  check(r.status === 401, "responde 401", r.status);
  check(r.calls.length === 0, "no llama a ninguna API", r.calls);
}

console.log("2) /start incluye el puente a la web");
{
  const r = await post(message("/start"));
  check(r.status === 200, "responde 200", r.status);
  const send = r.calls.find((c) => c.url.endsWith("/sendMessage"));
  check(Boolean(send), "envía sendMessage");
  const markup = send?.body?.reply_markup as { inline_keyboard?: { url?: string }[][] } | undefined;
  const urls = (markup?.inline_keyboard ?? []).flat().map((b) => b.url ?? "");
  check(urls.some((u) => u.includes("aitor.alienflow.space/?source=telegram")), "botón a la web", urls);
  check(urls.some((u) => u.includes("t.me/Alien69Bot/app")), "botón a la Mini App", urls);
  const text = String(send?.body?.text ?? "");
  check(text.includes("/web"), "el saludo lista /web", text.slice(0, 80));
}

console.log("3) /web responde con el mismo puente");
{
  const r = await post(message("/web"));
  check(r.status === 200, "responde 200", r.status);
  const send = r.calls.find((c) => c.url.endsWith("/sendMessage"));
  const markup = send?.body?.reply_markup as { inline_keyboard?: { url?: string }[][] } | undefined;
  const urls = (markup?.inline_keyboard ?? []).flat().map((b) => b.url ?? "");
  check(urls.some((u) => u.includes("?source=telegram")), "teclado presente", urls);
}

console.log("4) /start@Alien69Bot se normaliza (grupos)");
{
  const r = await post(message("/start@Alien69Bot"));
  const send = r.calls.find((c) => c.url.endsWith("/sendMessage"));
  const markup = send?.body?.reply_markup as { inline_keyboard?: unknown[][] } | undefined;
  check(Boolean(markup?.inline_keyboard?.length), "teclado presente tras normalizar");
}

console.log("5) /help documenta /web");
{
  const r = await post(message("/help"));
  const send = r.calls.find((c) => c.url.endsWith("/sendMessage"));
  check(String(send?.body?.text ?? "").includes("/web - Terminal web"), "ayuda con /web", send?.body?.text);
}

console.log("6) mensaje normal -> función chat de Supabase + respuesta");
{
  const r = await post(message("hola Ai Tor"));
  check(r.status === 200, "responde 200", r.status);
  check(r.calls.some((c) => c.url.includes("/functions/v1/chat")), "invoca la función chat", r.calls.map((c) => c.url));
  const reply = r.calls.filter((c) => c.url.endsWith("/sendMessage")).at(-1);
  check(Boolean(reply?.body?.text), "responde al usuario");
  check(!(reply?.body && "reply_markup" in reply.body), "sin teclado en mensajes normales");
}

console.log("7) payload sin mensaje -> 200 OK");
{
  const r = await post({});
  check(r.status === 200 && r.out === "OK", "ignora updates sin mensaje", { status: r.status, out: r.out });
  check(r.calls.length === 0, "sin llamadas externas");
}

console.log("8) lib/telegram: detección de Telegram y deep links");
{
  const w = globalThis as unknown as { window?: unknown; open?: unknown };
  const opened: string[] = [];
  const wdw = {
    location: { origin: "http://localhost:8080" },
    open: (url: string) => {
      opened.push(url);
      return null;
    },
  };
  w.window = wdw;
  const mod = await import(new URL("../src/lib/telegram.ts", import.meta.url).href);

  check(!mod.isRunningInTelegram(), "sin SDK -> no está en Telegram");
  check(
    mod.webLinkFromTelegram() === "http://localhost:8080/?source=telegram",
    "enlace de vuelta a la web",
    mod.webLinkFromTelegram(),
  );

  (wdw as { Telegram?: unknown }).Telegram = { WebApp: { initData: "" } };
  check(!mod.isRunningInTelegram(), "SDK sin initData -> no está en Telegram");
  (wdw as { Telegram?: unknown }).Telegram = {
    WebApp: { initData: "user=1&hash=x", initDataUnsafe: { start_param: "web" } },
  };
  check(mod.isRunningInTelegram(), "initData real -> detecta Telegram");
  check(mod.telegramStartParam() === "web", "lee start_param", mod.telegramStartParam());

  mod.openTelegram("web");
  mod.openTelegram("chat");
  check(
    opened[0] === "https://t.me/Alien69Bot/app?startapp=web",
    "deep link a la Mini App con startapp=web",
    opened[0],
  );
  check(opened[1] === "https://t.me/Alien69Bot", "deep link al chat", opened[1]);

  const fromTg = mod.webLinkFromTelegram();
  check(fromTg.includes("?source=telegram"), "retorno a la web queda marcado");

  delete w.window;
}

if (failures > 0) {
  console.error(`\n${failures} comprobación(es) fallida(s)`);
  process.exit(1);
}
console.log("\nTodas las comprobaciones del puente pasan.");
