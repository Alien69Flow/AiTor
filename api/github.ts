/**
 * `POST /api/github` — lectura del repositorio, sin credenciales.
 *
 * El repositorio es **público**, así que leerlo no necesita ni sesión de
 * Supabase ni PAT. Antes toda lectura pasaba por `github-proxy` en el proyecto
 * de identidad, que exige un JWT verificado: si el proxy no estaba desplegado
 * (404) o el usuario no tenía sesión, AI Tor no podía ni mirar su propio árbol
 * de ficheros. Esto lo arregla sirviendo la lectura desde Vercel contra la API
 * pública de GitHub.
 *
 * Qué **no** hace: escribir. `create_branch`, `create_or_update_file` y
 * `create_pull_request` necesitan un token con permiso de escritura y siguen
 * viviendo en `supabase/functions/github-proxy`, que además exige rol `admin`.
 * Aquí responden 501 con esa explicación en vez de fingir que no existen.
 *
 * Cuota: la API de GitHub permite 60 peticiones/hora por IP sin autenticar. Si
 * `GITHUB_TOKEN` está en el entorno se usa para leer (5.000/hora); **nunca es
 * obligatorio** y nunca sale en la respuesta. Un 403 `rate limit` se traduce a
 * un mensaje que lo dice, en vez de un «Forbidden» mudo.
 *
 * Autocontenido a propósito: el runtime de Vercel ya falló resolviendo un
 * import hermano (`api/predictions.ts` lo documenta), así que este fichero no
 * importa nada del proyecto salvo los tipos.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

export const maxDuration = 20;

const GITHUB_API = "https://api.github.com";
const TIMEOUT_MS = 12_000;
const DEFAULT_OWNER = "Alien69Flow";
const DEFAULT_REPO = "AiTor";

/** Lecturas que la API pública atiende sin token ni sesión. */
export const READ_ACTIONS = [
  "repo_info",
  "tree",
  "contents",
  "get_file",
  "branches",
  "commits",
  "get_ref",
  "pull_requests",
  "check_runs",
] as const;

/** Escrituras: no se sirven aquí porque necesitan un token con permiso. */
export const WRITE_ACTIONS = [
  "create_branch",
  "create_or_update_file",
  "create_pull_request",
] as const;

export interface ReadParams {
  action: string;
  owner: string;
  repo: string;
  path?: string;
  branch?: string;
  ref?: string;
  state?: string;
}

export function isReadAction(action: string): boolean {
  return (READ_ACTIONS as readonly string[]).includes(action);
}

export function isWriteAction(action: string): boolean {
  return (WRITE_ACTIONS as readonly string[]).includes(action);
}

/** `owner`/`repo` tal como los acepta GitHub: sin barras ni espacios. */
export function isSafeName(value: unknown): value is string {
  return typeof value === "string" && /^[\w.-]{1,100}$/.test(value);
}

/**
 * Ruta del repositorio, codificada segmento a segmento. Sin esto una ruta como
 * `src/a b.ts` o `x?ref=otra-rama` cambiaría la petición que se hace a GitHub.
 */
export function encodeRepoPath(path: string | undefined): string {
  if (!path) return "";
  return path
    .split("/")
    .filter((segment) => segment && segment !== ".")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * URL de la API de GitHub para una lectura. Lanza un error legible si la
 * acción no es de lectura: es lo único que decide qué se puede pedir.
 */
export function readUrl(params: ReadParams): string {
  const { action, owner, repo } = params;
  const base = `${GITHUB_API}/repos/${owner}/${repo}`;
  const ref = encodeURIComponent(params.ref || params.branch || "main");
  const path = encodeRepoPath(params.path);

  switch (action) {
    case "repo_info":
      return base;
    case "branches":
      return `${base}/branches`;
    case "commits":
      return `${base}/commits?per_page=10`;
    case "pull_requests": {
      const state = ["open", "closed", "all"].includes(params.state ?? "")
        ? (params.state as string)
        : "open";
      return `${base}/pulls?state=${state}&per_page=20`;
    }
    case "tree":
      return `${base}/git/trees/${ref}?recursive=1`;
    case "get_ref":
      return `${base}/git/ref/heads/${ref}`;
    case "contents":
    case "get_file": {
      const suffix = path ? `/${path}` : "";
      const query = params.branch ? `?ref=${encodeURIComponent(params.branch)}` : "";
      return `${base}/contents${suffix}${query}`;
    }
    case "check_runs":
      return `${base}/commits/${ref}/check-runs`;
    default:
      throw new Error(`Acción no permitida en la lectura pública: ${action}`);
  }
}

/** Lee la petición, venga por `POST` (JSON) o por `GET` (query string). */
export function readParams(req: VercelRequest): ReadParams {
  const raw: Record<string, unknown> =
    req.method === "GET"
      ? {
          action: req.query.action,
          owner: req.query.owner,
          repo: req.query.repo,
          path: req.query.path,
          branch: req.query.branch,
          ref: req.query.ref,
          state: req.query.state,
        }
      : typeof req.body === "string"
        ? (JSON.parse(req.body || "{}") as Record<string, unknown>)
        : ((req.body ?? {}) as Record<string, unknown>);

  const text = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim() ? value.trim() : undefined;

  return {
    action: text(raw.action) ?? "tree",
    owner: text(raw.owner) ?? DEFAULT_OWNER,
    repo: text(raw.repo) ?? DEFAULT_REPO,
    path: text(raw.path),
    branch: text(raw.branch),
    ref: text(raw.ref),
    state: text(raw.state),
  };
}

function json(res: VercelResponse, body: unknown, status = 200) {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  // Es una lectura pública del mismo origen; el comodín sólo evita sorpresas
  // si algún día se sirve aparte.
  res.setHeader("access-control-allow-origin", "*");
  // GitHub limita a 60 peticiones/hora por IP en modo anónimo, así que la
  // caché no es un lujo: es lo que mantiene la herramienta usable.
  res.setHeader("cache-control", status === 200 ? "public, max-age=60, s-maxage=300" : "no-store");
  res.send(JSON.stringify(body));
}

export default async function github(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.status(204);
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    res.setHeader("access-control-allow-headers", "content-type");
    return res.end();
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return json(res, { error: "Sólo GET y POST" }, 405);
  }

  let params: ReadParams;
  try {
    params = readParams(req);
  } catch {
    return json(res, { error: "El cuerpo no es JSON válido" }, 400);
  }

  if (isWriteAction(params.action)) {
    return json(
      res,
      {
        error:
          "Escribir en GitHub no se hace desde esta ruta: necesita un token con permiso y el " +
          "rol admin, y eso vive en github-proxy (Supabase). Esta función sólo lee repositorios públicos.",
        action: params.action,
        readOnly: true,
      },
      501,
    );
  }

  if (!isReadAction(params.action)) {
    return json(res, { error: `Acción desconocida: ${params.action}` }, 400);
  }

  if (!isSafeName(params.owner) || !isSafeName(params.repo)) {
    return json(res, { error: "Repositorio inválido: owner y repo deben ser nombres de GitHub" }, 400);
  }

  if (params.path?.includes("..")) {
    return json(res, { error: "La ruta no puede salirse del repositorio" }, 400);
  }

  const url = readUrl(params);
  // Sólo si el entorno lo trae: la función está obligada a trabajar sin token.
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || "";

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "aitor-intel/1.0",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | unknown[];

    if (response.ok) return json(res, payload);

    const detail =
      payload && !Array.isArray(payload) && typeof payload.message === "string"
        ? payload.message
        : `HTTP ${response.status}`;

    const rateLimited =
      response.status === 429 ||
      (response.status === 403 && /rate limit/i.test(detail));

    return json(
      res,
      {
        error: rateLimited
          ? `GitHub alcanzó su límite de lecturas anónimas (60/hora por IP). ${token ? "" : "Configura GITHUB_TOKEN para ampliarlo."}`.trim()
          : `GitHub respondió ${response.status}: ${detail}`,
        action: params.action,
        repository: `${params.owner}/${params.repo}`,
        ...(rateLimited ? { rateLimited: true } : {}),
      },
      response.status,
    );
  } catch (error) {
    return json(
      res,
      {
        error: `No pude hablar con la API de GitHub: ${
          error instanceof Error ? error.message : "error de red"
        }`,
        action: params.action,
        repository: `${params.owner}/${params.repo}`,
      },
      502,
    );
  }
}
