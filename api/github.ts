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
 * Desde la Fase 1 cada lectura se cachea 60 s en Redis (`getJsonStatus` /
 * `setJson`), que es lo que hace que 60 peticiones/hora den para navegar un
 * árbol de ficheros. Sólo se cachean los 200: un 403 de cuota o un 404 de ruta
 * llegan al cliente sin tocar la caché.
 *
 * Autocontenido a propósito: el runtime de Vercel ya falló resolviendo un
 * import hermano (`api/predictions.ts` lo documenta), así que este fichero no
 * importa nada del proyecto salvo los helpers compartidos, siempre con `.js`.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors } from "./_shared/cors.js";
import { sendError, sendJson } from "./_shared/http.js";
import { checkRateLimit } from "./_shared/rate-limit.js";
import { getJsonStatus, setJson } from "./_shared/redis.js";

export const maxDuration = 20;

const GITHUB_API = "https://api.github.com";
const TIMEOUT_MS = 12_000;
const DEFAULT_OWNER = "Alien69Flow";
const DEFAULT_REPO = "AiTor";
/** El árbol de un repo cambia al hacer push; un minuto es suficiente. */
const CACHE_TTL_SECONDS = 60;

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

/**
 * `owner`/`repo` tal como los acepta GitHub: sin barras ni espacios.
 *
 * La clase de caracteres evita `\\w` a propósito: un doble escape convierte el
 * regex en "barra invertida o w" y rechaza nombres reales como `Alien69Flow`
 * (fue un 400 real en el primer intento, cazado por el test).
 */
export function isSafeName(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,100}$/.test(value);
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

/** Clave de caché: incluye cada parámetro que cambia la respuesta. */
export function cacheKeyFor(params: ReadParams): string {
  const path = params.path ?? "";
  const ref = params.ref ?? params.branch ?? "main";
  return `github:v1:${params.owner}/${params.repo}:${params.action}:${ref}:${params.state ?? ""}:${path}`;
}

export default async function github(req: VercelRequest, res: VercelResponse) {
  // Lecturas públicas: ACAO * para que la CDN guarde una sola entrada.
  if (applyCors(req, res, { methods: "GET, POST, OPTIONS", publicRead: true })) return;

  if (req.method !== "GET" && req.method !== "POST") {
    return sendError(res, 405, { error: "Sólo GET y POST", code: "method_not_allowed" }, { Allow: "GET, POST, OPTIONS" });
  }

  // El límite protege la cuota de GitHub (60/h por IP) y la propia función.
  if (!(await checkRateLimit(req, res, { name: "github", limit: 60, windowSec: 60 }))) return;

  let params: ReadParams;
  try {
    params = readParams(req);
  } catch {
    return sendError(res, 400, { error: "El cuerpo no es JSON válido", code: "bad_json" });
  }

  if (isWriteAction(params.action)) {
    return sendError(
      res,
      501,
      {
        error:
          "Escribir en GitHub no se hace desde esta ruta: necesita un token con permiso y el " +
          "rol admin, y eso vive en github-proxy (Supabase). Esta función sólo lee repositorios públicos.",
        code: "read_only",
        action: params.action,
        readOnly: true,
      },
    );
  }

  if (!isReadAction(params.action)) {
    return sendError(res, 400, { error: `Acción desconocida: ${params.action}`, code: "unknown_action" });
  }

  if (!isSafeName(params.owner) || !isSafeName(params.repo)) {
    return sendError(res, 400, {
      error: "Repositorio inválido: owner y repo deben ser nombres de GitHub",
      code: "bad_repo",
    });
  }

  if (params.path?.includes("..")) {
    return sendError(res, 400, { error: "La ruta no puede salirse del repositorio", code: "bad_path" });
  }

  const cacheKey = cacheKeyFor(params);

  // Acierto cacheado: ni se toca GitHub ni se gasta cuota.
  const cached = await getJsonStatus<unknown>(cacheKey);
  if (cached.status === "hit") {
    return sendJson(req, res, 200, cached.value, { cache: "fast" });
  }

  const url = readUrl(params);
  // Sólo si el entorno lo trae: la función está obligada a trabajar sin token.
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || "";
  /**
   * El token se usa sólo con los repositorios de la allowlist.
   *
   * Esta ruta acepta `owner` y `repo` del llamante y no pide sesión. Si el PAT
   * puede leer repositorios privados, atarlo a lo que el llamante pida convierte
   * la ruta en una puerta a todos ellos. Fuera de la allowlist se consulta sin
   * token: un repositorio público sigue respondiendo y uno privado da 404.
   */
  const allowlist = (process.env.GITHUB_REPO_ALLOWLIST || "Alien69Flow/AiTor")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  const mayUseToken = Boolean(token) && allowlist.includes(`${params.owner}/${params.repo}`.toLowerCase());

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "aitor-intel/1.0",
        ...(mayUseToken ? { authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | unknown[];

    if (response.ok) {
      // Un fallo de Redis no puede tumbar una lectura correcta.
      if (CACHE_TTL_SECONDS > 0) {
        try {
          await setJson(cacheKey, payload, CACHE_TTL_SECONDS);
        } catch {
          /* sin caché se sigue sirviendo la respuesta */
        }
      }
      return sendJson(req, res, 200, payload, { cache: "fast" });
    }

    const detail =
      payload && !Array.isArray(payload) && typeof payload.message === "string"
        ? payload.message
        : `HTTP ${response.status}`;

    const rateLimited =
      response.status === 429 ||
      (response.status === 403 && /rate limit/i.test(detail));

    return sendError(res, response.status, {
      error: rateLimited
        ? `GitHub alcanzó su límite de lecturas anónimas (60/hora por IP). ${token ? "" : "Configura GITHUB_TOKEN para ampliarlo."}`.trim()
        : `GitHub respondió ${response.status}: ${detail}`,
      code: rateLimited ? "github_rate_limited" : "github_error",
      action: params.action,
      repository: `${params.owner}/${params.repo}`,
      ...(rateLimited ? { rateLimited: true } : {}),
    });
  } catch (error) {
    return sendError(res, 502, {
      error: `No pude hablar con la API de GitHub: ${
        error instanceof Error ? error.message : "error de red"
      }`,
      code: "github_unreachable",
      action: params.action,
      repository: `${params.owner}/${params.repo}`,
    });
  }
}
