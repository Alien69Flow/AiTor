import { describe, expect, it, vi } from "vitest";
import {
  collectText,
  memoryMessagesFor,
  normalizeThreadRef,
  rememberTurn,
  summarizePrompt,
} from "../../supabase/functions/chat/thread";

const TG = `tg_${"a1b2c3d4".repeat(4)}`;
const WEB = `web_${"0f".repeat(16)}`;

describe("normalizeThreadRef", () => {
  it("acepta un token de Telegram y otro de la web", () => {
    expect(normalizeThreadRef({ surface: "telegram", externalId: TG })).toEqual({
      surface: "telegram",
      externalId: TG,
    });
    expect(normalizeThreadRef({ surface: "web", externalId: WEB })).toEqual({
      surface: "web",
      externalId: WEB,
    });
  });

  it("rechaza prefijos cruzados, tokens cortos y basura", () => {
    expect(normalizeThreadRef({ surface: "telegram", externalId: WEB })).toBeNull();
    expect(normalizeThreadRef({ surface: "web", externalId: TG })).toBeNull();
    expect(normalizeThreadRef({ surface: "web", externalId: "web_abc" })).toBeNull();
    expect(normalizeThreadRef({ surface: "web", externalId: `web_${"z".repeat(32)}` })).toBeNull();
    expect(normalizeThreadRef({ surface: "otra", externalId: TG })).toBeNull();
    expect(normalizeThreadRef(null)).toBeNull();
    expect(normalizeThreadRef("tg_x")).toBeNull();
  });
});

describe("memoryMessagesFor", () => {
  it("sin hilo no lee nada y no falla", async () => {
    await expect(memoryMessagesFor(undefined)).resolves.toEqual({ ref: null, messages: [] });
  });
});

const stream = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });

describe("collectText", () => {
  it("junta los deltas SSE e ignora comentarios y [DONE]", async () => {
    const body = stream([
      ": keep-alive\n\n",
      'data: {"choices":[{"delta":{"content":"Hola "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"mundo"}}]}\n\n',
      "data: [DONE]\n\n",
    ]);
    await expect(collectText(body)).resolves.toBe("Hola mundo");
  });

  it("una línea partida entre dos trozos se reconstruye", async () => {
    const body = stream(['data: {"choices":[{"delta":{"content":"par', 'tido"}}]}\n\n']);
    await expect(collectText(body)).resolves.toBe("partido");
  });

  it("sin stream devuelve vacío", async () => {
    await expect(collectText(null)).resolves.toBe("");
  });
});

describe("rememberTurn", () => {
  it("sin hilo drena la copia y no escribe", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const body = stream(['data: {"choices":[{"delta":{"content":"x"}}]}\n\n']);
    await expect(rememberTurn(null, "hola", body, async () => null)).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("sin configuración de memoria no lanza aunque haya hilo", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const body = stream(['data: {"choices":[{"delta":{"content":"x"}}]}\n\n']);
    await expect(
      rememberTurn({ surface: "telegram", externalId: TG }, "hola", body, async () => null),
    ).resolves.toBeUndefined();
    vi.unstubAllGlobals();
  });
});

describe("summarizePrompt", () => {
  it("pide datos concretos y no repite el resumen anterior", () => {
    const prompt = summarizePrompt("se llama Ana", [
      { id: 1, role: "user", content: "me llamo Ana" },
      { id: 2, role: "assistant", content: "encantado" },
    ]);
    expect(prompt).toContain("600 caracteres");
    expect(prompt).toContain("se llama Ana");
    expect(prompt).toContain("USUARIO: me llamo Ana");
    expect(prompt).toContain("No guardes saludos");
  });
});
