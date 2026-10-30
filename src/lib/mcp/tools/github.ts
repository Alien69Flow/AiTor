import { toolResult, type McpGitHub, type McpTool } from "../registry";

/**
 * El repositorio de AI Tor, leído y propuesto desde el propio chat.
 *
 * Dos herramientas y una frontera clara:
 *
 *   `github.repo`     lee árbol, ficheros, commits, PRs y checks.
 *   `github.propose`  abre una rama, deja un cambio y pide el PR.
 *
 * Ninguna de las dos lleva credenciales: ambas hablan por un puerto
 * (`context.github`) que en el navegador usa la sesión del usuario contra el
 * proxy de GitHub, y allí un token de servicio con allowlist de repositorio
 * decide qué se puede tocar. Las escrituras siguen exigiendo rol `admin` en el
 * proxy, así que el modelo no puede saltarse ni el permiso ni el repositorio
 * aunque se lo pida el texto de la conversación.
 *
 * `github.propose` nunca escribe en `main`: crea una rama y abre un PR en
 * borrador, que es lo que hace revisable una mejora antes de que exista.
 */

const DEFAULT_OWNER = "Alien69Flow";
const DEFAULT_REPO = "AiTor";

/** Rama de trabajo a partir del título: `mejora/…` sin acentos ni símbolos. */
export function branchName(title: string, now = new Date()): string {
  const slug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `aitor/${slug || "mejora"}-${stamp}`;
}

/** Contenido en base64 para la API de contenidos; soporta UTF-8. */
export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function repo(args: Record<string, unknown>): { owner: string; repo: string } {
  const owner = typeof args.owner === "string" && args.owner.trim() ? args.owner.trim() : DEFAULT_OWNER;
  const name = typeof args.repo === "string" && args.repo.trim() ? args.repo.trim() : DEFAULT_REPO;
  return { owner, repo: name };
}

function port(context: { github?: McpGitHub }): McpGitHub {
  if (!context.github) {
    throw new Error(
      "Esta ejecución no tiene acceso a GitHub: usa el chat con sesión iniciada, que sí lo tiene.",
    );
  }
  return context.github;
}

/** Error legible del proxy: `GitHub API error: …` en vez de un JSON crudo. */
function fail(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(message.replace(/^GitHub API error:\s*/, "GitHub: "));
}

export const githubTools: McpTool[] = [
  {
    definition: {
      name: "github.repo",
      title: "Leer el repositorio",
      description:
        "Lee el repositorio de AI Tor en GitHub: info del repo, árbol de ficheros, contenido de un " +
        "fichero, últimos commits, pull requests abiertos o los checks de CI de una rama. " +
        "Es la lectura con la que se detectan fallos y se decide qué mejorar.",
      minTier: "free",
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["repo_info", "tree", "contents", "get_file", "commits", "pull_requests", "check_runs"],
            description: "Qué se quiere leer. Por defecto, `tree`.",
            default: "tree",
          },
          path: { type: "string", description: "Ruta del fichero o carpeta, para `contents` y `get_file`." },
          branch: { type: "string", description: "Rama, etiqueta o commit. Por defecto `main`." },
          owner: { type: "string", description: `Propietario; por defecto ${DEFAULT_OWNER}.` },
          repo: { type: "string", description: `Repositorio; por defecto ${DEFAULT_REPO}.` },
        },
      },
    },
    run: async (args, context) => {
      const action = typeof args.action === "string" ? args.action : "tree";
      if (!["repo_info", "tree", "contents", "get_file", "commits", "pull_requests", "check_runs"].includes(action)) {
        throw new Error(`Acción de lectura no permitida: ${action}`);
      }
      const { owner, repo: name } = repo(args);
      try {
        const data = await port(context).call({
          action,
          owner,
          repo: name,
          path: typeof args.path === "string" ? args.path : undefined,
          branch: typeof args.branch === "string" ? args.branch : undefined,
          ref: typeof args.branch === "string" ? args.branch : undefined,
        });
        return toolResult({ owner, repo: name, action, data });
      } catch (error) {
        fail(error);
      }
    },
  },
  {
    definition: {
      name: "github.propose",
      title: "Proponer un cambio",
      description:
        "Crea una rama, escribe un fichero y abre un pull request en borrador con el cambio. " +
        "Nunca escribe en `main`: la mejora queda propuesta para revisión. Requiere permiso de " +
        "escritura en el repositorio (rol admin en el proxy).",
      minTier: "pro",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título del pull request y origen del nombre de rama." },
          path: { type: "string", description: "Fichero a crear o modificar, relativo a la raíz." },
          content: { type: "string", description: "Contenido completo del fichero (texto)." },
          message: { type: "string", description: "Mensaje del commit; por defecto el título." },
          body: { type: "string", description: "Descripción del PR: qué cambia y por qué." },
          base: { type: "string", description: "Rama base; por defecto `main`." },
          owner: { type: "string", description: `Propietario; por defecto ${DEFAULT_OWNER}.` },
          repo: { type: "string", description: `Repositorio; por defecto ${DEFAULT_REPO}.` },
        },
        required: ["title", "path", "content"],
      },
    },
    run: async (args, context) => {
      const title = typeof args.title === "string" ? args.title.trim() : "";
      const path = typeof args.path === "string" ? args.path.trim().replace(/^\/+/, "") : "";
      const content = typeof args.content === "string" ? args.content : "";
      if (!title || !path) throw new Error("`title` y `path` son obligatorios");
      if (!content.trim()) throw new Error("`content` está vacío: no hay cambio que proponer");
      if (path.includes("..")) throw new Error("La ruta no puede salirse del repositorio");

      const { owner, repo: name } = repo(args);
      const base = typeof args.base === "string" && args.base.trim() ? args.base.trim() : "main";
      const head = branchName(title);
      const message = typeof args.message === "string" && args.message.trim() ? args.message.trim() : title;
      const body = typeof args.body === "string" ? args.body : "";

      const github = port(context);
      try {
        const baseRef = (await github.call({ action: "get_ref", owner, repo: name, branch: base })) as {
          object?: { sha?: string };
        };
        const baseSha = baseRef?.object?.sha;
        if (!baseSha) throw new Error(`No pude leer la rama ${base}`);

        await github.call({ action: "create_branch", owner, repo: name, new_branch: head, from_sha: baseSha });

        // Si el fichero ya existe, la API exige su sha para reemplazarlo.
        let existingSha: string | undefined;
        try {
          const existing = (await github.call({
            action: "get_file",
            owner,
            repo: name,
            path,
            branch: base,
          })) as { sha?: string };
          existingSha = existing?.sha;
        } catch {
          existingSha = undefined;
        }

        await github.call({
          action: "create_or_update_file",
          owner,
          repo: name,
          path,
          branch: head,
          content: toBase64(content),
          message,
          sha: existingSha,
        });

        const pull = (await github.call({
          action: "create_pull_request",
          owner,
          repo: name,
          head,
          base,
          title,
          body,
          draft: true,
        })) as { number?: number; html_url?: string };

        return toolResult({
          owner,
          repo: name,
          branch: head,
          path,
          pullRequest: pull?.number ?? null,
          url: pull?.html_url ?? null,
          draft: true,
        });
      } catch (error) {
        fail(error);
      }
    },
  },
];
