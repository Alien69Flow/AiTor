import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_MODELS } from "./ai-models";
import {
  loadChatHealth,
  peekChatHealth,
  resetChatHealthCache,
  resolveOracles,
  type ChatHealth,
} from "./ai-health";

/**
 * The selector must disable an oracle without a key, not hide it — and must
 * never disable anything based on a report it could not read. These tests pin
 * both directions, plus the "unknown model" case (ChainGPT/Chainlink) which is
 * unrouted rather than keyless.
 */
const health: ChatHealth = {
  service: "chat",
  status: "degraded",
  checkedAt: "2026-10-20T00:00:00.000Z",
  providers: [
    {
      id: "lovable",
      label: "Lovable AI",
      envVar: "LOVABLE_API_KEY",
      where: "secrets → LOVABLE_API_KEY",
      keyState: "missing",
      configured: false,
      models: ["google/gemini-2.5-flash"],
    },
    {
      id: "xai",
      label: "xAI",
      envVar: "GROK_API_KEY",
      where: "secrets → GROK_API_KEY",
      keyState: "ok",
      configured: true,
      models: ["xai/grok-2"],
    },
  ],
  models: [
    { id: "google/gemini-2.5-flash", provider: "lovable", available: false, reason: "missing-key" },
    { id: "xai/grok-2", provider: "xai", available: true, reason: "ready" },
  ],
  defaultModel: "google/gemini-2.5-flash",
  fallbackModel: "google/gemini-2.5-flash",
};

const byId = (oracles: ReturnType<typeof resolveOracles>, id: string) => {
  const found = oracles.find((oracle) => oracle.model.id === id);
  if (!found) throw new Error(`oráculo no resuelto: ${id}`);
  return found;
};

describe("resolveOracles", () => {
  it("sin informe respeta el catálogo estático y no desactiva nada", () => {
    const oracles = resolveOracles(AI_MODELS, null);
    expect(byId(oracles, "google/gemini-2.5-flash")).toMatchObject({ availability: "ready", available: true });
    expect(byId(oracles, "chaingpt/oracle")).toMatchObject({ availability: "no-route", available: false });
  });

  it("desactiva el modelo cuya clave falta y conserva el motivo", () => {
    const gemini = byId(resolveOracles(AI_MODELS, health), "google/gemini-2.5-flash");
    expect(gemini.available).toBe(false);
    expect(gemini.availability).toBe("missing-key");
    expect(gemini.envVar).toBe("LOVABLE_API_KEY");
    expect(gemini.where).toContain("LOVABLE_API_KEY");
  });

  it("deja seleccionable el modelo cuyo proveedor sí tiene clave", () => {
    expect(byId(resolveOracles(AI_MODELS, health), "xai/grok-2")).toMatchObject({
      availability: "ready",
      available: true,
      providerLabel: "xAI",
    });
  });

  it("trata como próxima entrega lo que el servidor no enruta", () => {
    expect(byId(resolveOracles(AI_MODELS, health), "chainlink/oracle")).toMatchObject({
      availability: "no-route",
      available: false,
      envVar: null,
    });
  });

  it("distingue una clave con pinta de marcador de una ausente", () => {
    const placeholder: ChatHealth = {
      ...health,
      models: [{ id: "xai/grok-2", provider: "xai", available: false, reason: "placeholder-key" }],
    };
    expect(byId(resolveOracles(AI_MODELS, placeholder), "xai/grok-2").availability).toBe("placeholder-key");
  });
});

describe("loadChatHealth", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    resetChatHealthCache();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetChatHealthCache();
  });

  it("consulta el endpoint de salud y cachea la respuesta", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => health });

    const first = await loadChatHealth();
    const second = await loadChatHealth();

    expect(first?.status).toBe("degraded");
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toMatch(/\/functions\/v1\/chat\?health=1$/);
    expect(peekChatHealth()?.providers).toHaveLength(2);
  });

  it("devuelve null ante un cuerpo que no es un informe", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ hello: "world" }) });
    expect(await loadChatHealth()).toBeNull();
    expect(peekChatHealth()).toBeNull();
  });

  it("devuelve null si la función no responde, sin desactivar el catálogo", async () => {
    fetchMock.mockRejectedValue(new Error("paused"));
    expect(await loadChatHealth()).toBeNull();
    expect(resolveOracles(AI_MODELS, peekChatHealth()).every((oracle) => oracle.availability !== "missing-key")).toBe(true);
  });

  it("refresh ignora la caché", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => health });
    await loadChatHealth();
    await loadChatHealth(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
