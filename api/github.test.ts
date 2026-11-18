/**
 * `/api/github` sin Vercel ni red: respuestas simuladas y una respuesta de
 * Vercel falsa. Cubre el camino de lectura, el 304 y los rechazos que no deben
 * llegar a GitHub (escrituras, acción desconocida, owner inválido).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "./github";

function mockRes() {
  const headers: Record<string, string> = {};
  let status = 0;
  let body: unknown = null;
  let ended = false;
  const res = {
    statusCode: 200,
    status(code: number) {
      status = code;
      res.statusCode = code;
      return res;
    },
    setHeader(name: string, value: unknown) {
      headers[name.toLowerCase()] = String(value);
      return res;
    },
    json(payload: unknown) {
      body = payload;
      return res;
    },
    send(payload: unknown) {
      body = payload;
      return res;
    },
    end() {
      ended = true;
      return res;
    },
  };
  return { res, snap: () => ({ status, body, headers, ended }) };
}

const req = (query: Record<string, string>, extra: Record<string, string> = {}) =>
  ({ method: "GET", headers: { ...extra }, query }) as never;

const treePayload = { sha: "abc", tree: [{ path: "src/main.tsx", type: "blob" }] };

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => treePayload, text: async () => "" })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/api/github", () => {
  it("lee el árbol, devuelve ETag y CORS público", async () => {
    const { res, snap } = mockRes();
    await handler(req({ action: "tree" }), res as never);
    const result = snap();

    expect(result.status).toBe(200);
    expect(result.body).toEqual(treePayload);
    expect(result.headers.etag).toMatch(/^"[0-9a-f]{8}"$/);
    expect(result.headers["access-control-allow-origin"]).toBe("*");
  });

  it("con If-None-Match igual responde 304", async () => {
    const first = mockRes();
    await handler(req({ action: "tree" }), first.res as never);
    const etag = first.snap().headers.etag;

    const second = mockRes();
    await handler(req({ action: "tree" }, { "if-none-match": etag }), second.res as never);

    expect(second.snap().status).toBe(304);
    expect(second.snap().ended).toBe(true);
  });

  it("una escritura responde 501 sin llamar a GitHub", async () => {
    const { res, snap } = mockRes();
    await handler(req({ action: "create_branch" }), res as never);

    expect(snap().status).toBe(501);
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(0);
  });

  it("una acción desconocida es 400", async () => {
    const { res, snap } = mockRes();
    await handler(req({ action: "borrar_todo" }), res as never);
    expect(snap().status).toBe(400);
  });

  it("un owner con barra es 400", async () => {
    const { res, snap } = mockRes();
    await handler(req({ action: "tree", owner: "a/b" }), res as never);
    expect(snap().status).toBe(400);
  });

  it("la clave de caché incluye todos los parámetros", async () => {
    const { cacheKeyFor } = await import("./github");
    const a = cacheKeyFor({ action: "contents", owner: "o", repo: "r", path: "src/a.ts", branch: "main" });
    const b = cacheKeyFor({ action: "contents", owner: "o", repo: "r", path: "src/b.ts", branch: "main" });
    expect(a).not.toBe(b);
    expect(a).toContain("src/a.ts");
  });
});
