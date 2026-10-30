import { describe, expect, it } from "vitest";
import { createAiTorMcpServer } from "./index";
import { McpError, createMcpServer, toolResult } from "./registry";
import { createRateLimiter, pickModel, runToolLoop, toGeminiSchema, toGeminiTools } from "./gemini";
import { createMcpHttpHandler } from "./http";
import { resolveColumns, resolveFilters } from "./tools/database";
import { parseTleText } from "./tools/satellites";
import { JSON_RPC_ERRORS, type McpToolResult } from "./types";

/**
 * El registro MCP es la puerta: si el filtro por plan falla, un plan gratuito
 * ejecuta una herramienta de pago. Estos casos cubren lo que no se ve en la
 * interfaz y no lo detectaría un typecheck.
 */

const fakeDb = {
  select: async (
    table: string,
    columns: string,
    limit: number,
    filters: Record<string, string>,
  ): Promise<Record<string, unknown>[]> => [{ table, columns, limit, filters, tier: "pro" }],
};

const context = {
  tier: "free" as const,
  fetch: (() => Promise.reject(new Error("no debe salir a la red"))) as unknown as typeof fetch,
};

describe("registro MCP y planes", () => {
  it("el plan gratuito no ve la herramienta de base de datos", () => {
    const names = createAiTorMcpServer().listTools("free").map((tool) => tool.name);
    expect(names).toContain("telemetry.satellites");
    expect(names).toContain("osint.events");
    expect(names).not.toContain("db.select");
  });

  it("pro y dao sí la ven", () => {
    const server = createAiTorMcpServer();
    expect(server.listTools("pro").map((t) => t.name)).toContain("db.select");
    expect(server.listTools("dao").map((t) => t.name)).toContain("db.select");
  });

  it("pedir una herramienta no listada se rechaza igual", async () => {
    const server = createAiTorMcpServer({ db: fakeDb });
    await expect(server.callTool("db.select", { table: "profiles" }, { ...context, db: fakeDb })).rejects.toBeInstanceOf(
      McpError,
    );
  });

  it("tools/list responde sólo con lo permitido", async () => {
    const response = await createAiTorMcpServer().handle({ jsonrpc: "2.0", id: 1, method: "tools/list" }, context);
    expect("result" in response).toBe(true);
    const tools = (response as { result: { tools: { name: string }[] } }).result.tools;
    expect(tools.map((tool) => tool.name)).not.toContain("db.select");
  });

  it("un método desconocido devuelve METHOD_NOT_FOUND, no una excepción", async () => {
    const response = await createAiTorMcpServer().handle(
      { jsonrpc: "2.0", id: "x", method: "resources/read" },
      context,
    );
    expect("error" in response && response.error?.code).toBe(JSON_RPC_ERRORS.METHOD_NOT_FOUND);
  });

  it("falta un parámetro obligatorio → INVALID_PARAMS", async () => {
    const response = await createAiTorMcpServer({ db: fakeDb }).handle(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "db.select", arguments: {} },
      },
      { ...context, tier: "pro", db: fakeDb },
    );
    expect("error" in response && response.error?.code).toBe(JSON_RPC_ERRORS.INVALID_PARAMS);
  });

  it("una llamada válida devuelve las filas del puerto inyectado", async () => {
    const response = await createAiTorMcpServer({ db: fakeDb }).handle(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "db.select", arguments: { table: "profiles", limit: 1 } },
      },
      { ...context, tier: "pro", db: fakeDb },
    );
    const result = (response as { result: McpToolResult }).result;
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent?.count).toBe(1);
  });

  it("no se puede filtrar ni leer una columna fuera de la lista", () => {
    expect(() => resolveColumns("profiles", "id,password")).toThrow(/no permitidas/i);
    expect(() => resolveFilters("profiles", { secret: "x" })).toThrow(/filtrar/i);
  });
});

describe("traducción a Gemini", () => {
  it("los tipos van en mayúsculas, como pide la API", () => {
    const schema = toGeminiSchema({ type: "integer", minimum: 1, maximum: 50 });
    expect(schema.type).toBe("INTEGER");
    expect(schema.maximum).toBe(50);
  });

  it("declara una función por herramienta, con sus parámetros", () => {
    const publicTools = createAiTorMcpServer().listTools("free");
    const declarations = toGeminiTools(publicTools)[0].functionDeclarations;
    // Una declaración por herramienta pública: si el catálogo crece, el modelo
    // tiene que verla sin que esta prueba se quede contando tres a mano.
    expect(declarations).toHaveLength(publicTools.length);
    const satellites = declarations.find((d) => d.name === "telemetry.satellites");
    expect(satellites?.parameters?.properties?.group?.type).toBe("STRING");
    expect(declarations.some((d) => d.name === "github.repo")).toBe(true);
    // La previsión viaja con su parámetro, o el modelo no puede pedir un lugar.
    const weather = declarations.find((d) => d.name === "weather.outlook");
    expect(weather?.parameters?.properties?.place?.type).toBe("STRING");
  });

  it("elige el Flash más nuevo y descarta los que no conversan", () => {
    expect(
      pickModel(["models/text-embedding-004", "models/gemini-1.5-flash", "models/gemini-3.8-flash"]),
    ).toBe("gemini-3.8-flash");
    expect(pickModel(["models/text-embedding-004", "models/imagen-4"])).toBeNull();
  });
});

describe("límite del plan gratuito", () => {
  it("corta al superar el máximo por minuto", () => {
    let clock = 1_000;
    const limiter = createRateLimiter({ perMinute: 2, perDay: 100, now: () => clock });
    expect(limiter.check().ok).toBe(true);
    expect(limiter.check().ok).toBe(true);
    const denied = limiter.check();
    expect(denied.ok).toBe(false);
    expect(denied.retryAfterMs).toBeGreaterThan(0);

    // Pasado el minuto, vuelve a haber cupo.
    clock += 61_000;
    expect(limiter.check().ok).toBe(true);
  });
});

describe("handler HTTP", () => {
  const hasFetchApi = typeof Request !== "undefined" && typeof Response !== "undefined";

  it.skipIf(!hasFetchApi)("sin llamante verificado responde 401", async () => {
    const handler = createMcpHttpHandler({
      server: createAiTorMcpServer(),
      resolveCaller: async () => null,
    });
    const response = await handler(
      new Request("https://example.test/mcp", { method: "POST", body: "{}" }),
    );
    expect(response.status).toBe(401);
  });

  it.skipIf(!hasFetchApi)("sirve tools/list y rechaza el agente si no está configurado", async () => {
    const handler = createMcpHttpHandler({
      server: createAiTorMcpServer(),
      resolveCaller: async () => ({ tier: "free" }),
    });

    const listed = await handler(
      new Request("https://example.test/mcp", {
        method: "POST",
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      }),
    );
    expect(listed.status).toBe(200);
    const payload = (await listed.json()) as { result?: { tools: unknown[] } };
    expect(payload.result?.tools).toHaveLength(createAiTorMcpServer().listTools("free").length);

    const prompt = await handler(
      new Request("https://example.test/mcp", {
        method: "POST",
        body: JSON.stringify({ prompt: "hola" }),
      }),
    );
    expect(prompt.status).toBe(501);
  });
});

describe("bucle de herramientas con el modelo", () => {
  it("devuelve al modelo el resultado de la herramienta antes de responder", async () => {
    const calls: string[] = [];
    const server = createMcpServer({
      name: "test",
      version: "0",
      tools: [
        {
          definition: {
            name: "demo.contar",
            title: "Contar",
            description: "Devuelve un número fijo.",
            inputSchema: { type: "object", properties: {} },
          },
          run: async () => {
            calls.push("tool");
            return toolResult({ total: 7 });
          },
        },
      ],
    });

    const seen: unknown[] = [];
    let round = 0;
    const client = {
      model: async () => "fake-flash",
      listModels: async () => ["fake-flash"],
      generateContent: async (body: Record<string, unknown>) => {
        seen.push(body);
        round += 1;
        if (round === 1) {
          return {
            model: "fake-flash",
            content: {
              role: "model" as const,
              parts: [{ functionCall: { name: "demo.contar", args: {} } }],
            },
          };
        }
        return {
          model: "fake-flash",
          content: { role: "model" as const, parts: [{ text: "El total es 7." }] },
        };
      },
    };

    const result = await runToolLoop({
      client,
      server,
      context: { tier: "free", fetch: context.fetch },
      prompt: "cuenta",
    });

    expect(calls).toEqual(["tool"]);
    expect(result.text).toContain("7");
    expect(result.toolCalls).toEqual([{ name: "demo.contar", args: {}, isError: false }]);

    // La segunda ronda lleva el resultado de la herramienta como functionResponse.
    const second = seen[1] as { contents: Array<{ parts: Array<{ functionResponse?: { name: string } }> }> };
    const names = second.contents.flatMap((c) => c.parts).map((p) => p.functionResponse?.name);
    expect(names).toContain("demo.contar");
  });

  it("no deja que el modelo encadene herramientas sin límite", async () => {
    const server = createMcpServer({
      name: "test",
      version: "0",
      tools: [
        {
          definition: {
            name: "demo.loop",
            title: "Bucle",
            description: "Siempre pide otra vuelta.",
            inputSchema: { type: "object", properties: {} },
          },
          run: async () => toolResult({ ok: true }),
        },
      ],
    });

    let rounds = 0;
    const client = {
      model: async () => "fake-flash",
      listModels: async () => ["fake-flash"],
      generateContent: async () => {
        rounds += 1;
        return {
          model: "fake-flash",
          content: {
            role: "model" as const,
            parts: [{ functionCall: { name: "demo.loop", args: {} } }],
          },
        };
      },
    };

    const result = await runToolLoop({
      client,
      server,
      context: { tier: "free", fetch: context.fetch },
      prompt: "bucle",
      maxRounds: 2,
    });

    expect(rounds).toBe(2);
    expect(result.text).toMatch(/rondas/i);
  });
});

describe("catálogo TLE", () => {
  it("lee grupos de tres líneas y salta lo que no es TLE", () => {
    const text = [
      "ISS (ZARYA)",
      "1 25544U 98067A   24001.00000000  .00000000  00000-0  00000-0 0  9990",
      "2 25544  51.6400  10.0000 0005000  20.0000  30.0000 15.50000000 00000",
      "basura",
      "BASURA",
      "no empieza por 1",
      "ni por 2",
    ].join("\n");
    const parsed = parseTleText(text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe("ISS (ZARYA)");
  });
});

/**
 * El `fetch` del navegador exige `window` como `this`: pasarlo dentro del
 * contexto y llamarlo como método (`context.fetch(...)`) responde «Illegal
 * invocation» en Chrome. Pasó en producción con `weather.outlook`, así que el
 * registro lo ata antes de entregar el contexto a cualquier herramienta.
 */
describe("fetch recibido de la página", () => {
  it("una herramienta puede llamarlo sin perder el `this` global", async () => {
    const seen: string[] = [];
    // Fiel al navegador: sólo funciona con el objeto global como `this`.
    const browserLikeFetch = function (
      this: unknown,
      input: unknown,
    ): Promise<Response> {
      if (this !== globalThis) {
        throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
      }
      seen.push(String(input));
      return Promise.resolve(new Response("{}", { status: 200 }));
    };

    const server = createMcpServer({
      name: "test",
      version: "0",
      tools: [
        {
          definition: {
            name: "probe.fetch",
            title: "Probe",
            description: "Llama a fetch como lo haría una herramienta real.",
            minTier: "free",
            inputSchema: { type: "object", properties: {} },
          },
          run: async (_args, responseContext) => {
            const response = await responseContext.fetch("https://example.test/x");
            return toolResult({ status: response.status });
          },
        },
      ],
    });

    const result = await server.callTool("probe.fetch", {}, {
      tier: "free",
      fetch: browserLikeFetch as unknown as typeof fetch,
    });

    expect(result.isError).toBeUndefined();
    expect(seen).toEqual(["https://example.test/x"]);
  });
});
