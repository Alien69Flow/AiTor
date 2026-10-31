import { describe, expect, it } from "vitest";
import { MAX_HISTORY_TURNS, MAX_PROMPT_CHARS, MAX_TURN_CHARS, buildAgentPrompt } from "./agent-prompt";

describe("prompt del agente con herramientas", () => {
  it("sin historial devuelve la pregunta sin preámbulo", () => {
    expect(buildAgentPrompt([], "¿cuántas rutas tiene el repo?")).toBe(
      "¿cuántas rutas tiene el repo?",
    );
  });

  it("adjunta los turnos previos con su papel", () => {
    const prompt = buildAgentPrompt(
      [
        { role: "user", content: "hola" },
        { role: "assistant", content: "hola, ¿qué miras?" },
      ],
      "lee el árbol del repo",
    );
    expect(prompt).toContain("Tú: hola");
    expect(prompt).toContain("AI Tor: hola, ¿qué miras?");
    expect(prompt.endsWith("lee el árbol del repo")).toBe(true);
  });

  it("se queda con los últimos turnos, no con el principio de la conversación", () => {
    const history = Array.from({ length: 12 }, (_, i) => ({
      role: "user" as const,
      content: `mensaje ${i}`,
    }));
    const prompt = buildAgentPrompt(history, "sigue");
    expect(prompt).toContain(`mensaje ${12 - MAX_HISTORY_TURNS}`);
    expect(prompt).not.toContain("mensaje 0");
  });

  it("recorta cada turno para dejar sitio a la respuesta de las herramientas", () => {
    const prompt = buildAgentPrompt(
      [{ role: "user", content: "x".repeat(MAX_TURN_CHARS * 3) }],
      "¿y ahora?",
    );
    const line = prompt.split("\n").find((l) => l.startsWith("Tú: ")) ?? "";
    expect(line.length).toBeLessThanOrEqual(MAX_TURN_CHARS + 6);
    expect(line.endsWith("…")).toBe(true);
  });

  it("suelta historial hasta que la pregunta quepa entera dentro del tope del endpoint", () => {
    const history = Array.from({ length: MAX_HISTORY_TURNS }, () => ({
      role: "user" as const,
      content: "contexto ".repeat(200),
    }));
    const question = "¿cuántas rutas tiene el repositorio?";
    const prompt = buildAgentPrompt(history, question);

    // El endpoint recorta a 4000 por el final: el prompt debe caber antes.
    expect(prompt.length).toBeLessThanOrEqual(MAX_PROMPT_CHARS);
    expect(prompt.endsWith(question)).toBe(true);
  });

  it("ignora turnos vacíos y espacios sobrantes", () => {
    const prompt = buildAgentPrompt(
      [
        { role: "user", content: "   " },
        { role: "assistant", content: "  con   espacios  " },
      ],
      "  pregunta  ",
    );
    expect(prompt).toContain("AI Tor: con espacios");
    expect(prompt.endsWith("pregunta")).toBe(true);
  });
});
