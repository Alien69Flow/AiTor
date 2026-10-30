import { describe, expect, it, vi } from "vitest";
import handler from "./mcp";

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
}

function call(body: unknown, headers: Record<string, string> = {}): Promise<HarnessResult> {
  return new Promise((resolve) => {
    const req = {
      method: "POST",
      body,
      headers,
      socket: { remoteAddress: "203.0.113.7" },
    };
    const res = {
      statusCode: 0,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      setHeader() {},
      send(payload: string) {
        resolve({ status: this.statusCode, body: payload });
      },
      end() {
        resolve({ status: this.statusCode, body: "" });
      },
    };
    // El handler es un (req, res) de Vercel; el arnés sólo necesita esa forma.
    void (handler as unknown as (req: unknown, res: unknown) => Promise<void>)(req, res);
  });
}

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

  it("el bucle del modelo no se abre a invitados", async () => {
    const { status, body } = await call({ prompt: "¿dónde está la ISS?" });

    expect(status).toBe(401);
    expect(JSON.parse(body).error).toMatch(/Inicia sesión/);
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
