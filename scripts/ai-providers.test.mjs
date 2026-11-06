import { describe, expect, it } from "vitest";
import {
  buildChatHealth,
  keyState,
  modelsForProvider,
  providerForModel,
  ROUTED_MODELS,
} from "../supabase/functions/_shared/ai-providers.ts";

/**
 * The health report is what the selector trusts to disable an oracle, so its two
 * decisions must be right: "there is no key" versus "there is something that is
 * not a key", and the overall status the owner sees.
 */
describe("keyState", () => {
  it("llama ausente a lo que no existe o está en blanco", () => {
    expect(keyState(undefined)).toBe("missing");
    expect(keyState(null)).toBe("missing");
    expect(keyState("")).toBe("missing");
    expect(keyState("   ")).toBe("missing");
  });

  it("detecta marcadores pegados en la variable", () => {
    expect(keyState("changeme")).toBe("placeholder");
    expect(keyState("your-api-key-here")).toBe("placeholder");
    expect(keyState("sk-your-key-0000000000")).toBe("placeholder");
    expect(keyState("aaaaaaaaaaaaaaaaaaaa")).toBe("placeholder");
    expect(keyState("<LOVABLE_API_KEY>")).toBe("placeholder");
    expect(keyState("corta")).toBe("placeholder");
  });

  it("acepta una clave con forma de clave", () => {
    expect(keyState("lvk_9f3a2b7c4d5e6f708192a3b4c5d6")).toBe("ok");
    expect(keyState("  sk-ant-api03-abcdefghijklmnopqrstuvwxyz  ")).toBe("ok");
  });
});

describe("registro de proveedores", () => {
  it("enruta cada modelo a un proveedor y viceversa", () => {
    for (const model of ROUTED_MODELS) {
      const provider = providerForModel(model);
      expect(provider).not.toBeNull();
      expect(provider?.models).toContain(model);
      expect(modelsForProvider(provider.id)).toContain(model);
    }
  });

  it("no repite un modelo entre proveedores", () => {
    expect(new Set(ROUTED_MODELS).size).toBe(ROUTED_MODELS.length);
  });
});

describe("buildChatHealth", () => {
  const envWith = (values) => (name) => values[name];

  it("sin claves el chat está caído y lo dice modelo a modelo", () => {
    const report = buildChatHealth(envWith({}));
    expect(report.status).toBe("down");
    expect(report.providers.every((provider) => !provider.configured)).toBe(true);
    expect(report.models.every((model) => model.available === false)).toBe(true);
    expect(report.models[0].reason).toBe("missing-key");
  });

  it("con solo un proveedor externo queda degradado", () => {
    const report = buildChatHealth(envWith({ GROK_API_KEY: "xai-abcdefghijklmnopqrstuvwxyz" }));
    expect(report.status).toBe("degraded");
    expect(report.models.find((model) => model.id === "xai/grok-2")).toMatchObject({
      available: true,
      reason: "ready",
    });
    expect(report.models.find((model) => model.id === "google/gemini-2.5-flash")).toMatchObject({
      available: false,
      reason: "missing-key",
    });
  });

  it("con la clave del gateway el chat está operativo", () => {
    const report = buildChatHealth(envWith({ LOVABLE_API_KEY: "lvk_9f3a2b7c4d5e6f708192a3b4c5d6" }));
    expect(report.status).toBe("ok");
    expect(report.models.find((model) => model.id === report.defaultModel)?.available).toBe(true);
  });

  it("distingue una clave de relleno de una ausente", () => {
    const report = buildChatHealth(envWith({ ANTHROPIC_API_KEY: "your-key-here" }));
    expect(report.providers.find((provider) => provider.id === "anthropic")?.keyState).toBe("placeholder");
    expect(report.models.find((model) => model.id === "anthropic/claude-sonnet-4")?.reason).toBe("placeholder-key");
  });

  it("nunca devuelve el valor de la clave", () => {
    const secret = "lvk_9f3a2b7c4d5e6f708192a3b4c5d6";
    const serialized = JSON.stringify(buildChatHealth(envWith({ LOVABLE_API_KEY: secret })));
    expect(serialized).not.toContain(secret);
    expect(serialized).toContain("LOVABLE_API_KEY");
  });
});
