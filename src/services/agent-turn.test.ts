import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * El chat tiene que preguntar primero al agente con herramientas: es la única
 * vía que lee el repositorio, la telemetría o la base. Estas pruebas fijan ese
 * contrato en el módulo que decide, no en el contenido de la respuesta.
 */
const askAgent = vi.fn();
const streamAgentAnswer = vi.fn();
vi.mock("./mcpClient", () => ({
  askAgent: (...args: unknown[]) => askAgent(...args),
  streamAgentAnswer: (...args: unknown[]) => streamAgentAnswer(...args),
}));

const { runAgentTurn } = await import("./agent-turn");

beforeEach(() => {
  askAgent.mockReset();
  streamAgentAnswer.mockReset();
});

describe("turno del agente con herramientas", () => {
  it("devuelve la respuesta y las herramientas ejecutadas", async () => {
    askAgent.mockResolvedValue({
      answer: "El árbol tiene 586 rutas y 512 ficheros.",
      toolCalls: [{ name: "github.repo", args: { action: "tree" }, isError: false }],
    });

    const result = await runAgentTurn([], "¿cuántas rutas tiene el repositorio?");

    expect(result).toEqual({
      content: "El árbol tiene 586 rutas y 512 ficheros.",
      reasoning: "",
      images: [],
      tools: ["github.repo"],
      failed: [],
    });
    expect(askAgent).toHaveBeenCalledTimes(1);
    expect(String(askAgent.mock.calls[0][0])).toContain("¿cuántas rutas tiene el repositorio?");
  });

  it("marca las herramientas que fallaron en vez de esconderlas", async () => {
    askAgent.mockResolvedValue({
      answer: "No pude leer el árbol; GitHub respondió 403.",
      toolCalls: [{ name: "github.repo", args: {}, isError: true }],
    });

    const result = await runAgentTurn([], "lee el repo");
    expect(result?.tools).toEqual(["github.repo"]);
    expect(result?.failed).toEqual(["github.repo"]);
  });

  it("sin sesión devuelve null para que el chat caiga al camino sin herramientas", async () => {
    askAgent.mockRejectedValue(new Error("Necesitas iniciar sesión para usar el agente"));
    await expect(runAgentTurn([], "hola")).resolves.toBeNull();
  });

  it("si el endpoint falla también devuelve null, nunca lanza", async () => {
    askAgent.mockRejectedValue(new Error("El agente respondió 502: sin clave"));
    await expect(runAgentTurn([], "hola")).resolves.toBeNull();
  });

  it("una respuesta vacía no se publica como mensaje", async () => {
    askAgent.mockResolvedValue({ answer: "   ", toolCalls: [] });
    await expect(runAgentTurn([], "hola")).resolves.toBeNull();
  });

  it("con imagen no se llama al agente: el bucle no acepta adjuntos", async () => {
    await expect(runAgentTurn([], "¿qué ves?", { hasImage: true })).resolves.toBeNull();
    expect(askAgent).not.toHaveBeenCalled();
  });

  it("con onDelta pide la respuesta en flujo y reenvía cada trozo", async () => {
    const deltas: string[] = [];
    streamAgentAnswer.mockImplementation(async (_prompt: string, handlers: { onDelta?: (t: string) => void }) => {
      handlers.onDelta?.("El árbol");
      handlers.onDelta?.(" tiene 586 rutas.");
      return {
        answer: "El árbol tiene 586 rutas.",
        toolCalls: [{ name: "github.repo", args: {}, isError: true }],
      };
    });

    const result = await runAgentTurn([], "lee el árbol", { onDelta: (text) => deltas.push(text) });

    expect(deltas).toEqual(["El árbol", " tiene 586 rutas."]);
    expect(result).toEqual({
      content: "El árbol tiene 586 rutas.",
      reasoning: "",
      images: [],
      tools: ["github.repo"],
      failed: ["github.repo"],
    });
    // Sin callback se usa la vía de una sola pieza, no el flujo.
    expect(askAgent).not.toHaveBeenCalled();
  });

  it("el razonamiento viaja en su propio canal y no se cuela en la respuesta", async () => {
    const thoughts: string[] = [];
    const deltas: string[] = [];
    streamAgentAnswer.mockImplementation(
      async (
        _prompt: string,
        handlers: { onDelta?: (t: string) => void; onThought?: (t: string) => void },
      ) => {
        handlers.onThought?.("Primero miro el árbol. ");
        handlers.onThought?.("Luego respondo.");
        handlers.onDelta?.("Hay 586 rutas.");
        return {
          answer: "Hay 586 rutas.",
          reasoning: "Primero miro el árbol. Luego respondo.",
          toolCalls: [],
        };
      },
    );

    const result = await runAgentTurn([], "lee el árbol", {
      onDelta: (text) => deltas.push(text),
      onThought: (text) => thoughts.push(text),
    });

    expect(thoughts).toEqual(["Primero miro el árbol. ", "Luego respondo."]);
    expect(deltas).toEqual(["Hay 586 rutas."]);
    expect(result?.content).toBe("Hay 586 rutas.");
    expect(result?.reasoning).toBe("Primero miro el árbol. Luego respondo.");
  });

  it("explica por qué no hubo agente: sin clave no es lo mismo que sin sesión", async () => {
    // El chat usaba null y callaba; el usuario sólo veía una respuesta sin
    // datos. Con el motivo se puede decir qué falta.
    const failures: Array<{ kind: string; status: number | null }> = [];
    askAgent.mockRejectedValue(new Error("El agente respondió 501: GEMINI_API_KEY no está configurada en el despliegue"));
    await runAgentTurn([], "lee el repo", { onFailure: (failure) => failures.push(failure) });
    expect(failures[0]).toMatchObject({ kind: "no-key", status: 501 });

    askAgent.mockRejectedValue(new Error("Necesitas iniciar sesión para usar el agente"));
    await runAgentTurn([], "lee el repo", { onFailure: (failure) => failures.push(failure) });
    expect(failures[1]).toMatchObject({ kind: "no-session", status: null });

    askAgent.mockRejectedValue(new Error("Failed to fetch"));
    await runAgentTurn([], "lee el repo", { onFailure: (failure) => failures.push(failure) });
    expect(failures[2].kind).toBe("unavailable");
  });

  it("adjunta el contexto de la conversación al prompt", async () => {
    askAgent.mockResolvedValue({ answer: "ok", toolCalls: [] });
    await runAgentTurn(
      [
        { role: "user", content: "estoy mirando el repo" },
        { role: "assistant", content: "dime qué mirar" },
      ],
      "lee el árbol",
    );
    const prompt = String(askAgent.mock.calls[0][0]);
    expect(prompt).toContain("Tú: estoy mirando el repo");
    expect(prompt).toContain("AI Tor: dime qué mirar");
    expect(prompt.endsWith("lee el árbol")).toBe(true);
  });
});
