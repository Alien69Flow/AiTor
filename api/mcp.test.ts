import { describe, expect, it, vi } from "vitest";
import handler, { budgetToolResponse, compressToolResult } from "./mcp";

/**
 * `POST /api/mcp` es la puerta del agente en producción y no tenía pruebas.
 *
 * Dos fallos reales que esto fija:
 *
 *  - Sin `Authorization` todo respondía 401, así que una visita sin cuenta no
 *    podía ni listar las herramientas públicas que el globo ya sirve.
 *  - La comprobación de plan se lanzaba **antes** del `try` de `callTool`, de
 *    modo que la promesa rechazaba sin manejar y el handler moría en un 500 sin
 *    JSON-RPC de vuelta. Un fallo de permisos tiene que ser un error del
 *    protocolo, no una caída.
 */

interface HarnessResult {
  status: number;
  body: string;
  headers?: Record<string, string>;
}

function call(
  body: unknown,
  headers: Record<string, string> = {},
  method = "POST",
): Promise<HarnessResult> {
  return new Promise((resolve) => {
    const req = {
      method,
      body,
      headers,
      socket: { remoteAddress: "203.0.113.7" },
    };
    const res = {
      statusCode: 0,
      responseHeaders: {} as Record<string, string>,
      chunks: [] as string[],
      writableEnded: false,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      setHeader(key: string, value: string) {
        this.responseHeaders[key.toLowerCase()] = value;
      },
      flushHeaders() {},
      write(chunk: string) {
        this.chunks.push(chunk);
        return true;
      },
      send(payload: string) {
        resolve({ status: this.statusCode, body: payload, headers: this.responseHeaders });
      },
      end() {
        this.writableEnded = true;
        resolve({
          status: this.statusCode,
          body: this.chunks.join(""),
          headers: this.responseHeaders,
        });
      },
    };
    // El handler es un (req, res) de Vercel; el arnés sólo necesita esa forma.
    void (handler as unknown as (req: unknown, res: unknown) => Promise<void>)(req, res);
  });
}

/** Sobre SSE tal y como lo manda Gemini con `alt=sse`. */
const sseChunk = (parts: unknown[]) =>
  `data: ${JSON.stringify({ candidates: [{ content: { role: "model", parts } }] })}\n\n`;

const toolsOf = (body: string) =>
  (JSON.parse(body).result?.tools ?? []).map((tool: { name: string }) => tool.name) as string[];

describe("MCP en /api/mcp", () => {
  it("un invitado puede listar las herramientas públicas", async () => {
    const { status, body } = await call({ jsonrpc: "2.0", id: 1, method: "tools/list" });

    expect(status).toBe(200);
    const names = toolsOf(body);
    expect(names).toContain("telemetry.satellites");
    expect(names).toContain("osint.events");
    expect(names).toContain("weather.outlook");
  });

  it("a un invitado no se le ofrecen las de sesión ni las de pago", async () => {
    const { body } = await call({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    const names = toolsOf(body);

    // GitHub habla por un proxy que valida identidad: listarlo sería prometer
    // algo que no puede ejecutar.
    expect(names.filter((name) => name.startsWith("github."))).toEqual([]);
    expect(names).not.toContain("db.select");
  });

  it("pedir una herramienta de pago devuelve error JSON-RPC, no un 500", async () => {
    const { status, body } = await call({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "db.select", arguments: { table: "profiles" } },
    });

    expect(status).toBe(200);
    const payload = JSON.parse(body);
    expect(payload.error?.message).toMatch(/requiere plan pro/);
    expect(payload.result).toBeUndefined();
  });

  it("una herramienta inexistente tampoco tumba el handler", async () => {
    const { status, body } = await call({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "no.existe", arguments: {} },
    });

    expect(status).toBe(200);
    expect(JSON.parse(body).error?.message).toMatch(/Herramienta desconocida/);
  });

  it("GitHub sin sesión explica qué falta en vez de romper", async () => {
    const { status, body } = await call({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "github.repo", arguments: { action: "tree" } },
    });

    expect(status).toBe(200);
    const result = JSON.parse(body).result;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/sesión iniciada/);
  });

  it("con sesión, la lectura va a GitHub y no al proxy", async () => {
    // El proxy exige JWT y, si no está desplegado, dejaba `github.repo` sin
    // poder leer ni un repositorio público. Ahora la lectura va directa a la
    // API abierta: aquí se comprueba que no toca `github-proxy` ni pide token.
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const href = String(url);
        urls.push(href);
        if (href.includes("/auth/v1/user")) {
          return new Response(JSON.stringify({ id: "usuario-1" }), { status: 200 });
        }
        if (href.includes("/rest/v1/profiles")) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response(JSON.stringify({ full_name: "Alien69Flow/AiTor" }), { status: 200 });
      }),
    );

    try {
      const { status, body } = await call(
        {
          jsonrpc: "2.0",
          id: 6,
          method: "tools/call",
          params: { name: "github.repo", arguments: { action: "repo_info" } },
        },
        { authorization: "Bearer sesion-valida" },
      );

      expect(status).toBe(200);
      const result = JSON.parse(body).result;
      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain("Alien69Flow/AiTor");
      expect(urls.some((href) => href.includes("api.github.com/repos/Alien69Flow/AiTor"))).toBe(true);
      expect(urls.some((href) => href.includes("github-proxy"))).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("el bucle del modelo no se abre a invitados", async () => {
    const { status, body } = await call({ prompt: "¿dónde está la ISS?" });

    expect(status).toBe(401);
    expect(JSON.parse(body).error).toMatch(/Inicia sesión/);
  });

  it("el flujo separa el razonamiento de la respuesta", async () => {
    // Un modelo con «thinking» manda primero sus partes `thought`. Antes se
    // tiraban (el chat no tenía dónde enseñarlas); ahora viajan en su propio
    // evento `thought` y nunca dentro de un `delta`, que es lo que se pinta
    // como respuesta.
    vi.stubEnv("GEMINI_API_KEY", `AIza${"x".repeat(32)}`);
    const stream = [
      sseChunk([{ text: "Estoy pensando", thought: true }]),
      sseChunk([{ text: "Madrid" }]),
      sseChunk([{ text: ", 21 °C" }]),
    ].join("");

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const href = String(url);
        if (href.includes("/auth/v1/user")) {
          return new Response(JSON.stringify({ id: "usuario-1" }), { status: 200 });
        }
        if (href.includes("/rest/v1/profiles")) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        if (href.endsWith("/models")) {
          return new Response(
            JSON.stringify({
              models: [
                { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] },
              ],
            }),
            { status: 200 },
          );
        }
        return new Response(stream, { status: 200 });
      }),
    );

    try {
      const result = await call(
        { prompt: "¿qué tiempo hace en Madrid?", stream: true },
        { authorization: "Bearer sesion-valida" },
      );

      expect(result.status).toBe(200);
      expect(result.headers?.["content-type"]).toContain("text/event-stream");
      // El proxy no debe acumular: sin esto Vercel suelta todo de golpe.
      expect(result.headers?.["x-accel-buffering"]).toBe("no");

      const events = result.body
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => JSON.parse(line.slice(6)) as { type: string; text?: string; answer?: string });

      expect(events.filter((event) => event.type === "delta").map((event) => event.text)).toEqual([
        "Madrid",
        ", 21 °C",
      ]);
      expect(events.filter((event) => event.type === "thought").map((event) => event.text)).toEqual([
        "Estoy pensando",
      ]);
      // El monólogo no se cuela en la respuesta ni se suma al texto final.
      expect(events.filter((event) => event.type === "delta").map((event) => event.text).join(""))
        .not.toContain("Estoy pensando");
      expect(events.at(-1)).toMatchObject({
        type: "done",
        answer: "Madrid, 21 °C",
        reasoning: "Estoy pensando",
      });
    } finally {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    }
  });

  it("sin clave del modelo el flujo no se abre: contesta 501 en JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const href = String(url);
        if (href.includes("/auth/v1/user")) {
          return new Response(JSON.stringify({ id: "usuario-1" }), { status: 200 });
        }
        return new Response(JSON.stringify([]), { status: 200 });
      }),
    );

    try {
      const result = await call(
        { prompt: "hola", stream: true },
        { authorization: "Bearer sesion-valida" },
      );
      expect(result.status).toBe(501);
      expect(JSON.parse(result.body).error).toMatch(/GEMINI_API_KEY/);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("GET /api/mcp publica si el despliegue tiene clave del modelo", async () => {
    // Sin esta sonda, una clave ausente sólo se notaba como un chat que
    // contestaba sin herramientas y se inventaba códigos de error.
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GOOGLE_API_KEY", "");
    try {
      const { status, body } = await call(null, {}, "GET");
      expect(status).toBe(200);
      const health = JSON.parse(body) as {
        geminiConfigured: boolean;
        geminiKeyState: string;
        tools: number;
        toolNames: string[];
        hint: string;
      };
      expect(health.geminiConfigured).toBe(false);
      expect(health.geminiKeyState).toBe("missing");
      expect(health.tools).toBeGreaterThan(5);
      expect(health.toolNames).toContain("media.image");
      expect(health.hint).toMatch(/GEMINI_API_KEY/);

      vi.stubEnv("GEMINI_API_KEY", `AIza${"x".repeat(32)}`);
      const withKey = await call(null, {}, "GET");
      const okHealth = JSON.parse(withKey.body) as { geminiConfigured: boolean; geminiKeyState: string };
      expect(okHealth.geminiConfigured).toBe(true);
      expect(okHealth.geminiKeyState).toBe("ok");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("una variable con marcador de posición no cuenta como clave real", async () => {
    // Un `GEMINI_API_KEY=tu_clave_aqui` pegado en el panel decía «configurada»
    // y luego cada turno moría con 400 del proveedor. El diagnóstico tiene que
    // distinguir «existe» de «sirve».
    vi.stubEnv("GEMINI_API_KEY", "tu_clave_aqui");
    vi.stubEnv("GOOGLE_API_KEY", "");
    try {
      const { body } = await call(null, {}, "GET");
      const health = JSON.parse(body) as {
        geminiConfigured: boolean;
        geminiKeyState: string;
        hint: string;
      };
      expect(health.geminiConfigured).toBe(false);
      expect(health.geminiKeyState).toBe("placeholder");
      expect(health.hint).toMatch(/marcador de posición/);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("una sesión inválida es 401 y no se degrada a invitado", async () => {
    // Degradar una sesión rota a «gratuito» escondería el fallo de auth justo
    // cuando hay que verlo.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ message: "invalid JWT" }), { status: 401 })),
    );

    try {
      const { status } = await call(
        { jsonrpc: "2.0", id: 5, method: "tools/list" },
        { authorization: "Bearer token-caducado" },
      );
      expect(status).toBe(401);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

/**
 * Presupuesto de los resultados que vuelven al modelo (idea de `headroom`).
 *
 * El bucle de herramientas reenvía cada resultado completo en cada ronda, así
 * que lo que se fija aquí es que comprimir no cueste información crítica: el
 * principio, el final y cualquier línea de error del trozo descartado.
 */
describe("presupuesto de resultados de herramientas", () => {
  const largo = (() => {
    const lineas = Array.from({ length: 400 }, (_, i) => `fila ${i} · lat ${i % 90} lon ${i % 180} · ok`);
    // El error va en el centro a propósito: es lo que se perdería recortando.
    lineas.splice(200, 0, "ERROR 500 en el origen: la cola de datos no respondió");
    return lineas.join("\n");
  })();

  it("un texto corto pasa intacto", () => {
    expect(compressToolResult("hola", 1000)).toBe("hola");
  });

  it("un texto largo cabe en el presupuesto y avisa de lo omitido", () => {
    const salida = compressToolResult(largo, 2000);
    expect(salida.length).toBeLessThan(2000 * 1.2);
    expect(salida.length).toBeLessThan(largo.length);
    expect(salida).toContain("caracteres omitidos");
  });

  it("conserva el principio y el final", () => {
    const salida = compressToolResult(largo, 2000);
    expect(salida.startsWith("fila 0 ")).toBe(true);
    expect(salida).toContain("fila 399 ");
  });

  it("rescata la línea de error del trozo descartado", () => {
    expect(compressToolResult(largo, 2000)).toContain("ERROR 500");
  });

  it("es determinista y no crece con presupuesto mínimo", () => {
    expect(compressToolResult(largo, 2000)).toBe(compressToolResult(largo, 2000));
    expect(compressToolResult("abcdefghij", 3)).toBe("abc");
    expect(compressToolResult(largo, 50).length).toBeLessThanOrEqual(100);
  });

  it("mantiene la forma de la respuesta y sólo comprime cadenas", () => {
    const salida = budgetToolResponse({ repo: "AiTor", count: 3, tree: largo, nested: { note: "ok" } }, 1200);
    expect(salida.repo).toBe("AiTor");
    expect(salida.count).toBe(3);
    expect((salida.tree as string).length).toBeLessThan(1200 * 1.2);
    expect(salida.nested).toEqual({ note: "ok" });
  });

  it("recorre arrays", () => {
    const salida = budgetToolResponse({ items: [largo, "corto"] }, 800);
    const items = salida.items as string[];
    expect(items).toHaveLength(2);
    expect(items[1]).toBe("corto");
    expect(items[0].length).toBeLessThan(800 * 1.2);
  });

  it("una estructura enorme se degrada a texto comprimido", () => {
    const enorme: Record<string, unknown> = {};
    for (let i = 0; i < 4000; i++) enorme[`k${i}`] = `v${i}`;
    const salida = budgetToolResponse(enorme, 600);
    expect(Object.keys(salida)).toEqual(["text"]);
    expect(String(salida.text).length).toBeLessThan(600 * 1.2);
    expect(String(salida.text)).toContain("caracteres omitidos");
  });

  it("no toca tipos que no son cadena", () => {
    expect(budgetToolResponse({ ok: true, n: null, x: 42, arr: [1, 2] }, 100)).toEqual({
      ok: true,
      n: null,
      x: 42,
      arr: [1, 2],
    });
  });
});
