import { describe, expect, it } from "vitest";
import { branchName, githubTools, toBase64 } from "./github";
import type { McpGitHub, McpToolContext } from "../registry";

/**
 * `github.propose` es la herramienta con más consecuencias del catálogo: deja
 * un commit en un repositorio real. Lo que se comprueba aquí no es la API de
 * GitHub, es el orden y el destino de las llamadas: rama nueva, contenido
 * íntegro y PR en borrador, nunca un empujón a `main`.
 */

function fakeGithub(overrides: Record<string, unknown> = {}) {
  const calls: Record<string, unknown>[] = [];
  const port: McpGitHub = {
    call: async (params) => {
      calls.push(params);
      const action = String(params.action);
      if (action in overrides) return overrides[action];
      if (action === "get_ref") return { object: { sha: "sha-de-main" } };
      if (action === "get_file") throw new Error("GitHub: 404 Not Found");
      if (action === "create_pull_request") return { number: 42, html_url: "https://github.com/o/r/pull/42" };
      return {};
    },
  };
  return { calls, port };
}

function context(port: McpGitHub): McpToolContext {
  return {
    tier: "pro",
    fetch: (() => Promise.reject(new Error("sin red en pruebas"))) as unknown as typeof fetch,
    github: port,
  };
}

const propose = githubTools.find((tool) => tool.definition.name === "github.propose")!;
const repo = githubTools.find((tool) => tool.definition.name === "github.repo")!;

const text = (result: { content: { text: string }[] }) => result.content[0].text;

describe("github.propose", () => {
  it("abre rama, escribe el fichero y pide el PR en borrador, en ese orden", async () => {
    const { calls, port } = fakeGithub();
    const result = await propose.run(
      { title: "Mejora del globo", path: "src/globe.ts", content: "export const a = 1;\n", body: "Por esto." },
      context(port),
    );

    expect(calls.map((call) => call.action)).toEqual([
      "get_ref",
      "create_branch",
      "get_file",
      "create_or_update_file",
      "create_pull_request",
    ]);

    const branch = calls.find((call) => call.action === "create_branch")!;
    expect(String(branch.new_branch)).toMatch(/^aitor\/mejora-del-globo-\d{8}$/);
    expect(branch.from_sha).toBe("sha-de-main");

    const write = calls.find((call) => call.action === "create_or_update_file")!;
    expect(write.branch).toBe(branch.new_branch);
    expect(write.sha).toBeUndefined();
    expect(Buffer.from(String(write.content), "base64").toString("utf8")).toBe("export const a = 1;\n");

    const pull = calls.find((call) => call.action === "create_pull_request")!;
    expect(pull.head).toBe(branch.new_branch);
    expect(pull.base).toBe("main");
    expect(pull.draft).toBe(true);

    expect(text(result)).toContain("https://github.com/o/r/pull/42");
  });

  it("no escribe nunca en la rama base", async () => {
    const { calls, port } = fakeGithub();
    await propose.run({ title: "t", path: "a.ts", content: "x" }, context(port));
    const writes = calls.filter((call) => call.action === "create_or_update_file");
    expect(writes.every((call) => call.branch !== "main")).toBe(true);
    expect(calls.some((call) => call.action === "create_pull_request" && call.base === "main")).toBe(true);
  });

  it("conserva el sha cuando el fichero ya existe", async () => {
    const { calls, port } = fakeGithub({ get_file: { sha: "sha-viejo" } });
    await propose.run({ title: "t", path: "a.ts", content: "x" }, context(port));
    const write = calls.find((call) => call.action === "create_or_update_file")!;
    expect(write.sha).toBe("sha-viejo");
  });

  it("rechaza rutas que se salen del repositorio y contenido vacío", async () => {
    const { port } = fakeGithub();
    await expect(propose.run({ title: "t", path: "../fuera.ts", content: "x" }, context(port))).rejects.toThrow(
      /salirse/,
    );
    await expect(propose.run({ title: "t", path: "a.ts", content: "   " }, context(port))).rejects.toThrow(
      /vacío/,
    );
  });

  it("lo dice claro cuando la ejecución no tiene puerto de GitHub", async () => {
    await expect(
      propose.run({ title: "t", path: "a.ts", content: "x" }, { tier: "pro", fetch }),
    ).rejects.toThrow(/no tiene acceso a GitHub/);
  });
});

describe("github.repo", () => {
  it("sólo acepta las lecturas declaradas", async () => {
    const { port } = fakeGithub();
    await expect(repo.run({ action: "delete_repo" }, context(port))).rejects.toThrow(/no permitida/);
  });

  it("rellena el repositorio propio y devuelve lo leído", async () => {
    const { calls, port } = fakeGithub({ tree: { tree: [{ path: "src/App.tsx" }] } });
    const result = await repo.run({ action: "tree" }, context(port));
    expect(calls[0]).toMatchObject({ action: "tree", owner: "Alien69Flow", repo: "AiTor" });
    expect(text(result)).toContain("src/App.tsx");
  });
});

describe("nombre de rama y codificación", () => {
  it("quita acentos y símbolos y mantiene la fecha", () => {
    expect(branchName("Mejoras: atmósfera / rediseño", new Date("2026-10-30T00:00:00Z"))).toBe(
      "aitor/mejoras-atmosfera-rediseno-20261030",
    );
  });

  it("codifica en base64 respetando UTF-8", () => {
    const encoded = toBase64("atmósfera ✔");
    expect(Buffer.from(encoded, "base64").toString("utf8")).toBe("atmósfera ✔");
  });
});
