import { describe, expect, it, vi } from "vitest";
import handler from "./csp-report";

/**
 * Peticion como la entrega Vercel con `application/csp-report` o
 * `application/reports+json`: no sabe parsear el tipo, asi que `req.body` llega
 * vacio y el JSON sigue sin leer en el stream. Sin esto el colector se queda
 * mudo justo con los informes que interesan.
 */
function streamedRequest(raw: string, body: unknown = undefined) {
  const bytes = new TextEncoder().encode(raw);
  const half = Math.ceil(bytes.length / 2);

  return {
    method: "POST",
    headers: {
      "content-type": "application/csp-report",
      "x-forwarded-for": "203.0.113.9",
      "user-agent": "csp-raw-body-test",
    },
    body,
    // Vercel entrega un IncomingMessage: se consume con `for await`, en trozos.
    async *[Symbol.asyncIterator]() {
      yield bytes.slice(0, half);
      yield bytes.slice(half);
    },
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    setHeader() {
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    end() {
      return res;
    },
  };
  return res;
}

/** Ejecuta el handler y devuelve el codigo y las lineas de log que escribio. */
async function run(req: unknown) {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const res = mockRes();

  await handler(req as never, res as never);
  const lines = warn.mock.calls.map((call) => String(call[0]));
  warn.mockRestore();

  return { status: res.statusCode, lines };
}

function legacy(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    "csp-report": {
      "effective-directive": "connect-src",
      "blocked-uri": "https://pnyigikagdxqaogbiift.supabase.co/rest/v1",
      "document-uri": "https://aitor.alienflow.space/hub",
      disposition: "report",
      ...extra,
    },
  });
}

describe("handler: cuerpo que Vercel no ha parseado", () => {
  it("lee el cuerpo crudo cuando `body` llega vacio", async () => {
    const { status, lines } = await run(streamedRequest(legacy()));

    expect(status).toBe(204);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("directive=connect-src");
    expect(lines[0]).toContain("blocked=https://pnyigikagdxqaogbiift.supabase.co/rest/v1");
    expect(lines[0]).toContain("document=https://aitor.alienflow.space/hub");
  });

  it("tambien cuando `body` es un objeto sin datos", async () => {
    const { status, lines } = await run(streamedRequest(legacy(), {}));

    expect(status).toBe(204);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("directive=connect-src");
  });

  it("tambien cuando `body` trae un envoltorio que no es un informe", async () => {
    const { lines } = await run(streamedRequest(legacy(), { type: "deprecation" }));

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("document=https://aitor.alienflow.space/hub");
  });

  it("no relee el stream si `body` ya trae el informe", async () => {
    const parsed = JSON.parse(legacy());
    const req = streamedRequest(legacy({ "blocked-uri": "https://otro.example/x.js" }), parsed);

    const { lines } = await run(req);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("blocked=https://pnyigikagdxqaogbiift.supabase.co/rest/v1");
    expect(lines[0]).not.toContain("otro.example");
  });

  it("responde 204 sin registrar nada si el crudo tampoco es un informe", async () => {
    const { status, lines } = await run(streamedRequest("no soy json"));

    expect(status).toBe(204);
    expect(lines).toHaveLength(0);
  });
});
