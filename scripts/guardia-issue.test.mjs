import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ISSUE_TITLE,
  buildIssueBody,
  buildRecoveryComment,
  decide,
  readResults,
  runGuardiaIssue,
  tail,
} from "./guardia-issue.mjs";

/**
 * Lo que importa del aviso: que un rojo abra o actualice un solo issue con la
 * salida real, que un verde lo cierre, y que sin resultados no invente nada.
 */

const dirs = [];
function resultsDir(files) {
  const dir = mkdtempSync(join(tmpdir(), "guardia-"));
  dirs.push(dir);
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return dir;
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true });
});

/** Fetch falso: responde por ruta y método y apunta las llamadas. */
function fakeApi(routes) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const path = url.replace("https://api.github.com", "");
    calls.push({ path, method: init.method ?? "GET", body: init.body ? JSON.parse(init.body) : null });
    const route = routes(path, init.method ?? "GET");
    return {
      status: route?.status ?? 200,
      json: async () => route?.body ?? null,
    };
  };
  return { fetchImpl, calls };
}

const env = {
  GITHUB_REPOSITORY: "Alien69Flow/AiTor",
  GITHUB_TOKEN: "token-de-prueba",
  GITHUB_RUN_ID: "123456",
  GITHUB_SERVER_URL: "https://github.com",
};

describe("lectura de resultados", () => {
  it("lee código y log de cada comprobación", () => {
    const dir = resultsDir({
      "health.code": "1\n",
      "health.log": "\u001b[31mFALLO\u001b[0m memoria\n",
      "conocimiento.code": "0",
      "conocimiento.log": "todo bien\n",
    });
    const results = readResults(dir);
    expect(results.map((result) => [result.name, result.code])).toEqual([
      ["conocimiento", 0],
      ["health", 1],
    ]);
    expect(results[1].log).toContain("FALLO memoria");
    expect(results[1].log).not.toContain("\u001b[");
  });

  it("sin directorio devuelve lista vacía, no lanza", () => {
    expect(readResults(join(tmpdir(), "no-existe-guardia"))).toEqual([]);
  });
});

describe("decisión", () => {
  it("todo en 0 es verde", () => {
    expect(decide([{ code: 0 }, { code: 0 }])).toBe("green");
  });

  it("un fallo es rojo", () => {
    expect(decide([{ code: 0 }, { code: 1 }])).toBe("red");
  });

  it("código 2 (sin verificar) también es rojo, como el step", () => {
    expect(decide([{ code: 2 }])).toBe("red");
  });

  it("sin salida no se inventa un veredicto", () => {
    expect(decide([{ code: null }])).toBe("red");
    expect(decide([])).toBe("unknown");
  });
});

describe("cuerpo del issue", () => {
  const results = [
    { name: "conocimiento", code: 0, log: "conocimiento OK\n" },
    { name: "health", code: 1, log: "fase 2: el chat no responde\nHTTP 504\n" },
  ];

  it("nombra el fallo, enlaza el run y pega su salida", () => {
    const body = buildIssueBody(results, {
      runUrl: "https://github.com/Alien69Flow/AiTor/actions/runs/123456",
      now: new Date("2026-11-23T07:00:00Z"),
    });
    expect(body).toContain("2026-11-23 07:00:00 UTC");
    expect(body).toContain("https://github.com/Alien69Flow/AiTor/actions/runs/123456");
    expect(body).toContain("| `health` | 1 |");
    expect(body).toContain("<summary><code>health</code>");
    expect(body).toContain("HTTP 504");
    expect(body).not.toContain("<summary><code>conocimiento</code>");
  });

  it("recorta la salida larga por el principio, no por el final", () => {
    const log = `${"x".repeat(10_000)}\nfinal útil\n`;
    const text = tail(log, 100);
    expect(text).toContain("final útil");
    expect(text).toContain("salida recortada");
    expect(text.length).toBeLessThan(300);
  });

  it("el comentario de recuperación dice cuándo y dónde", () => {
    const comment = buildRecoveryComment({
      runUrl: "https://github.com/Alien69Flow/AiTor/actions/runs/9",
      now: new Date("2026-11-30T07:00:00Z"),
    });
    expect(comment).toContain("2026-11-30 07:00:00 UTC");
    expect(comment).toContain("actions/runs/9");
  });
});

describe("apertura, actualización y cierre", () => {
  it("abre un issue cuando no hay ninguno y el veredicto es rojo", async () => {
    const dir = resultsDir({ "health.code": "1", "health.log": "fallo\n" });
    const api = fakeApi((path, method) => {
      if (path.startsWith("/repos/Alien69Flow/AiTor/issues?")) return { body: [] };
      if (path === "/repos/Alien69Flow/AiTor/labels") return { status: 201, body: {} };
      if (path === "/repos/Alien69Flow/AiTor/issues" && method === "POST")
        return { status: 201, body: { number: 7 } };
      return null;
    });
    const result = await runGuardiaIssue({ dir, env, fetchImpl: api.fetchImpl });
    expect(result.action).toBe("opened");
    expect(result.issue).toBe(7);
    const created = api.calls.find((call) => call.path.endsWith("/issues") && call.method === "POST");
    expect(created?.body.title).toBe(ISSUE_TITLE);
    expect(created?.body.labels).toEqual(["guardia"]);
    expect(created?.body.body).toContain("health");
  });

  it("actualiza el que ya estaba abierto en vez de abrir otro", async () => {
    const dir = resultsDir({ "conocimiento.code": "2", "conocimiento.log": "sin clave\n" });
    const api = fakeApi((path, method) => {
      if (path.startsWith("/repos/Alien69Flow/AiTor/issues?"))
        return { body: [{ number: 12, title: ISSUE_TITLE }] };
      if (path === "/repos/Alien69Flow/AiTor/issues/12" && method === "PATCH")
        return { body: { number: 12 } };
      return null;
    });
    const result = await runGuardiaIssue({ dir, env, fetchImpl: api.fetchImpl });
    expect(result.action).toBe("updated");
    expect(result.issue).toBe(12);
    expect(api.calls.some((call) => call.path.endsWith("/issues") && call.method === "POST")).toBe(
      false,
    );
  });

  it("cierra con comentario cuando vuelve a verde", async () => {
    const dir = resultsDir({ "health.code": "0", "health.log": "verde\n" });
    const api = fakeApi((path, method) => {
      if (path.startsWith("/repos/Alien69Flow/AiTor/issues?"))
        return { body: [{ number: 5, title: ISSUE_TITLE }] };
      if (path.endsWith("/issues/5/comments") && method === "POST") return { status: 201, body: {} };
      if (path.endsWith("/issues/5") && method === "PATCH") return { body: { state: "closed" } };
      return null;
    });
    const result = await runGuardiaIssue({ dir, env, fetchImpl: api.fetchImpl });
    expect(result.action).toBe("closed");
    const comment = api.calls.find((call) => call.path.endsWith("/comments"));
    expect(comment?.body.body).toContain("volvió a verde");
    const patch = api.calls.find((call) => call.method === "PATCH");
    expect(patch?.body.state).toBe("closed");
  });

  it("verde sin issue abierto no toca la API", async () => {
    const dir = resultsDir({ "health.code": "0" });
    const api = fakeApi(() => ({ body: [] }));
    const result = await runGuardiaIssue({ dir, env, fetchImpl: api.fetchImpl });
    expect(result.action).toBe("none");
    expect(api.calls.filter((call) => call.method !== "GET")).toEqual([]);
  });

  it("dry-run no llama a GitHub", async () => {
    const dir = resultsDir({ "health.code": "1" });
    const api = fakeApi(() => ({}));
    const result = await runGuardiaIssue({ dir, dryRun: true, env, fetchImpl: api.fetchImpl });
    expect(result.action).toBe("dry-run");
    expect(api.calls).toEqual([]);
  });

  it("sin resultados no hace nada", async () => {
    const api = fakeApi(() => ({}));
    const result = await runGuardiaIssue({
      dir: join(tmpdir(), "guardia-vacia"),
      env,
      fetchImpl: api.fetchImpl,
    });
    expect(result.action).toBe("none");
    expect(api.calls).toEqual([]);
  });
});
