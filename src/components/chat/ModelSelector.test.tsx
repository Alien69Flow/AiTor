import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModelSelector } from "./ModelSelector";
import { resetChatHealthCache, type ChatHealth } from "@/lib/ai-health";

/**
 * The point of the change: a model without a key is *disabled and explained*,
 * not removed. Rendering the real selector keeps that honest — the list comes
 * from the health report, so a regression to filtering would fail here.
 */
const health: ChatHealth = {
  service: "chat",
  status: "degraded",
  checkedAt: "2026-10-20T10:00:00.000Z",
  providers: [
    {
      id: "lovable",
      label: "Lovable AI",
      envVar: "LOVABLE_API_KEY",
      where: "Supabase → Edge Functions → Secrets → LOVABLE_API_KEY",
      keyState: "missing",
      configured: false,
      models: ["google/gemini-2.5-flash", "openai/gpt-5"],
    },
    {
      id: "xai",
      label: "xAI",
      envVar: "GROK_API_KEY",
      where: "Supabase → Edge Functions → Secrets → GROK_API_KEY",
      keyState: "ok",
      configured: true,
      models: ["xai/grok-2"],
    },
    {
      id: "deepseek",
      label: "DeepSeek",
      envVar: "DEEPSEEK_API_KEY",
      where: "Supabase → Edge Functions → Secrets → DEEPSEEK_API_KEY",
      keyState: "ok",
      configured: true,
      models: ["deepseek/deepseek-v3"],
    },
  ],
  models: [
    { id: "google/gemini-2.5-flash", provider: "lovable", available: false, reason: "missing-key" },
    { id: "openai/gpt-5", provider: "lovable", available: false, reason: "missing-key" },
    { id: "xai/grok-2", provider: "xai", available: true, reason: "ready" },
    { id: "deepseek/deepseek-v3", provider: "deepseek", available: true, reason: "ready" },
  ],
  defaultModel: "google/gemini-2.5-flash",
  fallbackModel: "google/gemini-2.5-flash",
};

// jsdom no trae lo que Radix y cmdk esperan del navegador real.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  resetChatHealthCache();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => health }));
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetChatHealthCache();
});

describe("ModelSelector con informe de salud", () => {
  it("lista como desactivados los oráculos sin clave, con el motivo", async () => {
    render(<ModelSelector value="xai/grok-2" onChange={() => {}} />);
    await userEvent.click(screen.getByRole("button"));

    expect(await screen.findByText("2 de 12 oráculos con clave")).toBeTruthy();

    const blocked = screen.getByRole("option", { name: /GPT-5 Oracle/ });
    expect(blocked.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getAllByText("sin clave").length).toBeGreaterThan(0);

    const ready = screen.getByRole("option", { name: /Grok 2/ });
    expect(ready.getAttribute("aria-disabled")).not.toBe("true");
  });

  it("no selecciona un oráculo desactivado", async () => {
    const onChange = vi.fn();
    render(<ModelSelector value="xai/grok-2" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button"));
    await screen.findByText("2 de 12 oráculos con clave");

    await userEvent.click(screen.getByRole("option", { name: /GPT-5 Oracle/ }));
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("option", { name: /Grok 2/ }));
    expect(onChange).toHaveBeenCalledWith("xai/grok-2");
  });
});
