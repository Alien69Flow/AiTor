import { afterEach, describe, expect, it, vi } from "vitest";
import handler, { encodeRepoPath, readUrl } from "./github";

/**
 * `/api/github` existe porque leer un repositorio **público** no debería costar
 * una sesión de Supabase ni un PAT: el proxy anterior exigía un JWT verificado
 * y, mientras no estuviera desplegado, AI Tor no podía ni ver su árbol de
 * ficheros.
 *
 * Lo que fijan estas pruebas:
 *  - cada lectura se traduce a la ruta correcta de la API de GitHub;
 *  - la petición va **sin** `Authorization` cuando no hay token en el entorno;
 *  - las escrituras se rechazan aquí (501) en vez de intentarse sin permiso;
 *  - un límite de cuota se explica en castellano, no como un 403 mudo;
 *  - una ruta con `..` o un nombre de repo raro no llega a GitHub.
 */

interface Result {
  status: number;
  body: string;
  headers: Record<string, string>;
}

function call(
  body: unknown,
  options: { method?: string; query?: Record<string, string>; headers?: Record<string, string> } = {},
): Promise<Result> {
  return new Promise((resolve) => {
    const headers: Record<string, string> = {};
    const req = {
      method: options.method ?? "POST",
      body,
      query: options.query ?? {},
      headers: options.headers ?? {},
      socket: { remoteAddress: "203.0.113.9" },
    };
    const res = {
      statusCode: 0,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      setHeader(name: string, value: string) {
        headers[name.toLowerCase()] = value;
      },
      send(payload: string) {
        resolve({ status: this.statusCode, body: payload, headers });
      },
      end() {
        resolve({ status: this.statusCode, body: "", headers });
      },
    };
    void (handler as unknown as (req: unknown, res: unknown) => Promise<void>)(req, res);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_PAT;
});

describe("rutas de lectura de GitHub", () => {
  const repo = { owner: "Alien69Flow", repo: "AiTor" };

  it("traduce cada acción a su ruta", () => {
    expect(readUrl({ ...repo, action: "repo_info" })).toBe(
      "https://api.github.com/repos/Alien69Flow/AiTor",
    );
    expect(readUrl({ ...repo, action: "tree", branch: "main" })).toBe(
      "https://api.github.com/repos/Alien69Flow/AiTor/git/trees/main?recursive=1",
    );
    expect(readUrl({ ...repo, action: "get_file", path: "src/App.tsx", branch: "dev" })).toBe(
      "https://api.github.com/repos/Alien69Flow/AiTor/contents/src/App.tsx?ref=dev",
    );
    expect(readUrl({ ...repo, action: "commits" })).toBe(
      "https://api.github.com/repos/Alien69Flow/AiTor/commits?per_page=10",
    );
  });

  it("codifica la ruta por segmentos, sin dejar inyectar query", () => {
    expect(encodeRepoPath("src/a b.ts")).toBe("src/a%20b.ts");
    expect(readUrl({ ...repo, action: "get_file", path: "x?ref=otra" })).toContain(
      "contents/x%3Fref%3Dotra",
    );
  });

  it("una acción de escritura no tiene URL de lectura", () => {
    expect(() => readUrl({ ...repo, action: "create_pull_request" })).toThrow(/no permitida/);
  });
});

describe("GET/POST /api/github", () => {
  it("lee sin Authorization cuando no hay token en el entorno", async () => {
    const seen: { url?: string; headers?: Record<string, string> } = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        seen.url = String(url);
        seen.headers = (init?.headers ?? {}) as Record<string, string>;
        return new Response(JSON.stringify([{ name: "src" }]), { status: 200 });
      }),
    );

    const { status, body, headers } = await call({ action: "contents", path: "src" });

    expect(status).toBe(200);
    expect(JSON.parse(body)).toEqual([{ name: "src" }]);
    expect(seen.headers?.authorization).toBeUndefined();
    expect(seen.url).toBe("https://api.github.com/repos/Alien69Flow/AiTor/contents/src");
    // La caché es lo que mantiene usable la cuota anónima de 60/hora.
    expect(headers["cache-control"]).toMatch(/s-maxage/);
  });

  it("acepta GET con query string", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ full_name: "Alien69Flow/AiTor" }))),
    );

    const { status, body } = await call(null, {
      method: "GET",
      query: { action: "repo_info", owner: "Alien69Flow", repo: "AiTor" },
    });

    expect(status).toBe(200);
    expect(JSON.parse(body).full_name).toBe("Alien69Flow/AiTor");
  });

  it("rechaza escribir aquí y dice dónde se hace", async () => {
    const { status, body } = await call({ action: "create_pull_request", title: "x" });

    expect(status).toBe(501);
    expect(JSON.parse(body).error).toMatch(/github-proxy/);
  });

  it("una acción desconocida es 400, no un 500", async () => {
    const { status, body } = await call({ action: "borrar_todo" });

    expect(status).toBe(400);
    expect(JSON.parse(body).error).toMatch(/Acción desconocida/);
  });

  it("un repositorio con forma rara no llega a GitHub", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { status } = await call({ action: "tree", owner: "a/b", repo: "AiTor" });

    expect(status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("explica el límite anónimo en vez de devolver un 403 mudo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: "API rate limit exceeded for 1.2.3.4." }), {
            status: 403,
          }),
      ),
    );

    const { status, body } = await call({ action: "tree" });

    expect(status).toBe(403);
    const payload = JSON.parse(body);
    expect(payload.rateLimited).toBe(true);
    expect(payload.error).toMatch(/límite de lecturas anónimas/);
  });
});
