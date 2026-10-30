/**
 * `POST /api/mcp` — servidor MCP de AI-TOR en Vercel.
 *
 * Acepta dos cuerpos:
 *
 *   { "jsonrpc": "2.0", "method": "tools/list" }  ó  { "method": "tools/call", "params": {…} }
 *   { "prompt": "¿dónde está la ISS ahora?" }     → agente con herramientas
 *
 * El cliente del chat llamaba a esta ruta desde el principio y no existía: solo
 * había montaje en el backend Node, que no está desplegado, así que en
 * producción el botón de herramientas MCP daba 404.
 *
 * **Este archivo no importa nada del proyecto a propósito.** La primera versión
 * montaba `src/lib/mcp/…` y el runtime de Vercel devolvió
 * `FUNCTION_INVOCATION_FAILED`, el mismo fallo que documenta
 * `api/predictions.ts`. El código de `src/lib/mcp` sigue siendo la referencia
 * para el navegador y para el backend Node; aquí va la copia ejecutable con las
 * mismas tres herramientas y los mismos topes.
 *
 * Reglas que no se negocian:
 *  - La identidad sale del `Bearer`, verificado contra el proyecto que firma la
 *    sesión. El plan se lee de `profiles.tier` con ese token; nunca del cuerpo.
 *  - `db.select` consulta con el token del llamante, así que el RLS decide qué
 *    filas ve el modelo.
 *  - `GEMINI_API_KEY` vive solo aquí; el navegador recibe texto, nunca la clave.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as satellite from "satellite.js";

export const maxDuration = 60;

// Proyecto de identidad: firma la sesión y tiene `profiles`.
const AUTH_URL =
  process.env.AUTH_SUPABASE_URL ||
  process.env.VITE_AUTH_SUPABASE_URL ||
  "https://pnyigikagdxqaogbiift.supabase.co";

const AUTH_KEY =
  process.env.AUTH_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_AUTH_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_c4VVYw8uPzt7-24KvOre6A_91csa5Xp";

const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/** Repositorio por defecto de las herramientas de GitHub. */
const DEFAULT_OWNER = "Alien69Flow";
const DEFAULT_REPO = "AiTor";

type Tier = "free" | "pro" | "dao";
const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1, dao: 2 };

interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  minTier: Tier;
  inputSchema: Record<string, unknown>;
}

interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
}

const TOOLS: ToolDefinition[] = [
  {
    name: "telemetry.satellites",
    title: "Posiciones de satélites",
    description:
      "Posición actual (latitud, longitud, altitud) de los satélites del catálogo CelesTrak. " +
      'Con `match` se filtra por nombre, p. ej. "ISS" o "STARLINK".',
    minTier: "free",
    inputSchema: {
      type: "object",
      properties: {
        group: { type: "string", enum: ["stations", "active"], default: "stations" },
        match: { type: "string", description: "Filtro por nombre." },
        limit: { type: "integer", default: 10, minimum: 1, maximum: 50 },
      },
    },
  },
  {
    name: "osint.events",
    title: "Eventos OSINT",
    description:
      "Titulares geolocalizados de GDELT con fuente, enlace y tono (-100 a +100). " +
      "Es la misma señal que pinta el globo.",
    minTier: "free",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Consulta GDELT." },
        timespan: { type: "string", enum: ["1h", "6h", "24h", "7d"], default: "24h" },
        limit: { type: "integer", default: 15, minimum: 1, maximum: 50 },
      },
    },
  },
  {
    name: "weather.outlook",
    title: "Previsión y entorno",
    description:
      "Estado actual y próximas horas de un lugar: temperatura, humedad, viento, lluvia, índice de " +
      "secado de la ropa, nieve y cota, oleaje con bandera de baño y polen (Europa). Open-Meteo.",
    minTier: "free",
    inputSchema: {
      type: "object",
      properties: {
        place: { type: "string", description: "Nombre del lugar, p. ej. «Zaragoza»." },
        lat: { type: "number", description: "Latitud, si ya la conoces." },
        lon: { type: "number", description: "Longitud, si ya la conoces." },
      },
    },
  },
  {
    name: "github.repo",
    title: "Leer el repositorio",
    description:
      "Lee el repositorio de AI Tor en GitHub: árbol de ficheros, contenido de un fichero, " +
      "commits, pull requests abiertos o los checks de CI. Es la lectura con la que detecta " +
      "fallos y decide qué mejorar. Necesita sesión iniciada.",
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
        path: { type: "string", description: "Ruta del fichero o carpeta." },
        branch: { type: "string", description: "Rama, etiqueta o commit. Por defecto `main`." },
        owner: { type: "string", description: `Propietario; por defecto ${DEFAULT_OWNER}.` },
        repo: { type: "string", description: `Repositorio; por defecto ${DEFAULT_REPO}.` },
      },
    },
  },
  {
    name: "github.propose",
    title: "Proponer un cambio",
    description:
      "Crea una rama, escribe un fichero y abre un pull request en borrador. Nunca escribe en " +
      "`main`: la mejora queda propuesta para revisión. Requiere plan pro y permiso de escritura " +
      "en el repositorio.",
    minTier: "pro",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Título del pull request y origen de la rama." },
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
  {
    name: "db.select",
    title: "Leer mis datos",
    description:
      "Lee tu perfil y tus créditos. Sólo devuelve filas que tu sesión puede ver según RLS.",
    minTier: "pro",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string", enum: ["profiles", "user_credits"] },
        columns: { type: "string" },
        filters: { type: "object" },
        limit: { type: "integer", default: 10, minimum: 1, maximum: 50 },
      },
      required: ["table"],
    },
  },
];

const READABLE_TABLES: Record<string, string[]> = {
  profiles: ["id", "display_name", "tier", "created_at", "updated_at"],
  user_credits: ["user_id", "paid_tier", "used", "updated_at"],
};

/**
 * Proxy de GitHub: vive en el proyecto de identidad porque es el único que
 * puede validar el JWT del llamante. Aquí sólo viaja la acción; el token de
 * servicio y la allowlist de repositorio se quedan allí.
 */
const GITHUB_PROXY = `${AUTH_URL}/functions/v1/github-proxy`;

const GDELT_DOC = "https://api.gdeltproject.org/api/v2/doc/doc";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const MARINE_URL = "https://marine-api.open-meteo.com/v1/marine";
const AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_HOURS = 6;
const TLE_URL = {
  stations: "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle",
  active: "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle",
} as const;

interface Caller {
  /** `null` en una llamada anónima: sólo alcanza las herramientas gratuitas. */
  userId: string | null;
  token: string | null;
  tier: Tier;
  /** Para el cubo de cuota cuando no hay usuario. */
  ip: string;
}

function json(body: unknown, status = 200) {
  return {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

async function verifiedUserId(token: string): Promise<string | null> {
  try {
    const response = await fetch(`${AUTH_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: AUTH_KEY },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const user = (await response.json()) as { id?: unknown };
    return typeof user.id === "string" ? user.id : null;
  } catch {
    return null;
  }
}

/** Filas del propio usuario. El token del llamante es la única credencial. */
async function selectRows(
  token: string,
  table: string,
  columns: string,
  limit: number,
  filters: Record<string, string>,
): Promise<Record<string, unknown>[]> {
  const url = new URL(`${AUTH_URL}/rest/v1/${table}`);
  url.searchParams.set("select", columns);
  url.searchParams.set("limit", String(limit));
  for (const [column, value] of Object.entries(filters)) {
    url.searchParams.set(column, `eq.${value}`);
  }
  const response = await fetch(url, {
    headers: { apikey: AUTH_KEY, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Supabase respondió ${response.status} en ${table}`);
  const rows = (await response.json()) as Record<string, unknown>[];
  return Array.isArray(rows) ? rows : [];
}

/**
 * Identidad del llamante.
 *
 * Sin cabecera `Authorization` la llamada es **anónima**: plan gratuito y sólo
 * las herramientas públicas. Antes se respondía 401 a todo, así que una visita
 * sin cuenta no podía ni listar herramientas aunque el globo y sus datos sean
 * públicos. Una cabecera presente pero inválida sigue siendo 401: degradar una
 * sesión rota a invitado escondería el fallo.
 */
async function resolveCaller(authorization: string | undefined, ip: string): Promise<Caller | null> {
  if (!authorization) return { userId: null, token: null, tier: "free", ip };
  if (!authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return null;
  const userId = await verifiedUserId(token);
  if (!userId) return null;

  let tier: Tier = "free";
  try {
    const rows = await selectRows(token, "profiles", "tier", 1, { id: userId });
    const value = rows[0]?.tier;
    if (value === "pro" || value === "dao") tier = value;
  } catch {
    // Sin tabla o sin permiso de lectura el plan es el gratuito: un fallo de
    // lectura nunca asciende a nadie.
  }
  return { userId, token, tier, ip };
}

/* -------------------------------- github -------------------------------- */

async function githubCall(caller: Caller, params: Record<string, unknown>): Promise<unknown> {
  if (!caller.token) {
    throw new Error("GitHub necesita una sesión iniciada: el proxy valida tu identidad");
  }
  const response = await fetch(GITHUB_PROXY, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: AUTH_KEY,
      Authorization: `Bearer ${caller.token}`,
    },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(25_000),
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; message?: string }
    | null;

  if (response.status === 404) {
    throw new Error("GitHub: el proxy no está desplegado en el proyecto de identidad (github-proxy).");
  }
  if (!response.ok) {
    throw new Error(`GitHub: ${payload?.error ?? payload?.message ?? `HTTP ${response.status}`}`);
  }
  return payload;
}

/** Nombre de rama a partir del título: `aitor/…-AAAAMMDD`, sin acentos. */
function branchName(title: string, now = new Date()): string {
  const slug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  return `aitor/${slug || "mejora"}-${stamp}`;
}

function targetRepo(args: Record<string, unknown>) {
  const owner =
    typeof args.owner === "string" && args.owner.trim() ? args.owner.trim() : DEFAULT_OWNER;
  const name =
    typeof args.repo === "string" && args.repo.trim() ? args.repo.trim() : DEFAULT_REPO;
  return { owner, repo: name };
}

const READ_ACTIONS = [
  "repo_info",
  "tree",
  "contents",
  "get_file",
  "commits",
  "pull_requests",
  "check_runs",
];

async function runGitRepo(args: Record<string, unknown>, caller: Caller): Promise<ToolResult> {
  const action = typeof args.action === "string" ? args.action : "tree";
  if (!READ_ACTIONS.includes(action)) throw new Error(`Acción de lectura no permitida: ${action}`);
  const { owner, repo } = targetRepo(args);
  const data = await githubCall(caller, {
    action,
    owner,
    repo,
    path: typeof args.path === "string" ? args.path : undefined,
    branch: typeof args.branch === "string" ? args.branch : undefined,
    ref: typeof args.branch === "string" ? args.branch : undefined,
  });
  return ok({ owner, repo, action, data });
}

async function runGitPropose(args: Record<string, unknown>, caller: Caller): Promise<ToolResult> {
  const title = typeof args.title === "string" ? args.title.trim() : "";
  const path = typeof args.path === "string" ? args.path.trim().replace(/^\/+/, "") : "";
  const content = typeof args.content === "string" ? args.content : "";
  if (!title || !path) throw new Error("`title` y `path` son obligatorios");
  if (!content.trim()) throw new Error("`content` está vacío: no hay cambio que proponer");
  if (path.includes("..")) throw new Error("La ruta no puede salirse del repositorio");

  const { owner, repo } = targetRepo(args);
  const base = typeof args.base === "string" && args.base.trim() ? args.base.trim() : "main";
  const head = branchName(title);
  const message =
    typeof args.message === "string" && args.message.trim() ? args.message.trim() : title;
  const body = typeof args.body === "string" ? args.body : "";

  const baseRef = (await githubCall(caller, { action: "get_ref", owner, repo, branch: base })) as {
    object?: { sha?: string };
  };
  const baseSha = baseRef?.object?.sha;
  if (!baseSha) throw new Error(`No pude leer la rama ${base}`);

  await githubCall(caller, {
    action: "create_branch",
    owner,
    repo,
    new_branch: head,
    from_sha: baseSha,
  });

  // Si el fichero ya existe, la API exige su sha para reemplazarlo.
  let existingSha: string | undefined;
  try {
    const existing = (await githubCall(caller, {
      action: "get_file",
      owner,
      repo,
      path,
      branch: base,
    })) as { sha?: string };
    existingSha = existing?.sha;
  } catch {
    existingSha = undefined;
  }

  await githubCall(caller, {
    action: "create_or_update_file",
    owner,
    repo,
    path,
    branch: head,
    content: Buffer.from(content, "utf8").toString("base64"),
    message,
    sha: existingSha,
  });

  const pull = (await githubCall(caller, {
    action: "create_pull_request",
    owner,
    repo,
    head,
    base,
    title,
    body,
    draft: true,
  })) as { number?: number; html_url?: string };

  return ok({
    owner,
    repo,
    branch: head,
    path,
    pullRequest: pull?.number ?? null,
    url: pull?.html_url ?? null,
    draft: true,
  });
}

function asInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function ok(payload: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    structuredContent: payload,
  };
}

function parseTleText(text: string): { name: string; line1: string; line2: string }[] {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const out: { name: string; line1: string; line2: string }[] = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    if (!lines[i + 1].startsWith("1 ") || !lines[i + 2].startsWith("2 ")) continue;
    out.push({ name: lines[i], line1: lines[i + 1], line2: lines[i + 2] });
  }
  return out;
}

type ParsedTle = { name: string; line1: string; line2: string };

function positionOf(tle: ParsedTle, date: Date): { lat: number; lon: number; altKm: number } | null {
  try {
    const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
    if (!satrec || (satrec as { error?: number }).error) return null;
    const pv = satellite.propagate(satrec, date);
    if (!pv || typeof pv.position === "boolean" || !pv.position) return null;
    const geo = satellite.eciToGeodetic(
      pv.position as satellite.EciVec3<number>,
      satellite.gstime(date),
    );
    const lat = satellite.degreesLat(geo.latitude);
    const lon = satellite.degreesLong(geo.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon, altKm: geo.height };
  } catch {
    return null;
  }
}

async function runSatellites(args: Record<string, unknown>): Promise<ToolResult> {
  const group = args.group === "active" ? "active" : "stations";
  const match = typeof args.match === "string" ? args.match.trim().toUpperCase() : "";
  const limit = asInt(args.limit, 10, 1, 50);

  const response = await fetch(TLE_URL[group], { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`CelesTrak respondió ${response.status}`);

  const catalogue = parseTleText(await response.text());
  if (catalogue.length === 0) throw new Error("CelesTrak devolvió un catálogo vacío");

  const now = new Date();
  const selected = (match ? catalogue.filter((tle) => tle.name.toUpperCase().includes(match)) : catalogue)
    .slice(0, limit);

  const satellites = selected
    .map((tle) => {
      const position = positionOf(tle, now);
      if (!position) return null;
      return {
        name: tle.name,
        lat: Number(position.lat.toFixed(4)),
        lon: Number(position.lon.toFixed(4)),
        altKm: Number(position.altKm.toFixed(1)),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return ok({
    source: "celestrak.org",
    group,
    at: now.toISOString(),
    catalogSize: catalogue.length,
    satellites,
  });
}

async function runOsint(args: Record<string, unknown>): Promise<ToolResult> {
  const query =
    typeof args.query === "string" && args.query.trim()
      ? args.query.trim()
      : "(conflict OR strike OR missile OR sanctions OR election OR market OR inflation OR crypto OR UAP OR satellite)";
  const timespan = ["1h", "6h", "24h", "7d"].includes(String(args.timespan))
    ? String(args.timespan)
    : "24h";
  const limit = asInt(args.limit, 15, 1, 50);

  const url =
    `${GDELT_DOC}?query=${encodeURIComponent(query)}` +
    `&mode=artlist&format=json&sort=hybridrel&timespan=${timespan}&maxrecords=${limit * 2}`;

  const response = await fetch(url, { signal: AbortSignal.timeout(14_000) });
  if (response.status === 429) {
    throw new Error("GDELT está limitando peticiones (429); reintenta en unos segundos");
  }
  if (!response.ok) throw new Error(`GDELT respondió ${response.status}`);

  const payload = (await response.json()) as {
    articles?: { title?: string; url?: string; domain?: string; seendate?: string; tone?: string | number }[];
  };

  const articles = (payload.articles ?? [])
    .filter((article) => (article.title ?? "").trim().length > 8)
    .slice(0, limit)
    .map((article) => {
      const stamp = article.seendate ?? "";
      const date =
        stamp.length >= 13
          ? new Date(
              `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T` +
                `${stamp.slice(9, 11)}:${stamp.slice(11, 13)}:00Z`,
            )
          : new Date(0);
      const rawTone =
        typeof article.tone === "string" ? Number(article.tone.split(",")[0]) : Number(article.tone);
      return {
        title: (article.title ?? "").trim(),
        source: article.domain ?? "GDELT",
        url: article.url ?? "https://www.gdeltproject.org",
        timestamp: Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString(),
        tone: Number.isFinite(rawTone) ? rawTone : null,
      };
    });

  return ok({ source: "gdeltproject.org", timespan, count: articles.length, articles });
}

/* ------------------------------- entorno ------------------------------- */

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Mismos umbrales que `src/lib/environment-metrics.ts`, copiados aquí. */
function dryingIndexOf(
  temperatureC: number,
  humidityPercent: number,
  windKmh: number,
  precipitationMm: number,
): number {
  if (!Number.isFinite(temperatureC) || !Number.isFinite(humidityPercent)) return 0;
  if (precipitationMm > 0.1) return 0;
  const dryness = Math.min(100, Math.max(0, 100 - humidityPercent)) * 0.5;
  const wind = (Math.min(40, Math.max(0, Number.isFinite(windKmh) ? windKmh : 0)) / 40) * 25;
  const warmth = Math.min(1, Math.max(0, (temperatureC - 5) / 30)) * 25;
  return Math.round(Math.min(100, Math.max(0, dryness + wind + warmth)));
}

function dryingVerdictOf(index: number): string {
  if (index === 0) return "No se seca: está lloviendo.";
  if (index >= 70) return "Se seca sin problema.";
  if (index >= 40) return "Se seca despacio.";
  return "Casi no se seca.";
}

function seaFlagOf(waveHeightM: number): "verde" | "amarilla" | "roja" {
  if (!Number.isFinite(waveHeightM)) return "amarilla";
  if (waveHeightM >= 2) return "roja";
  if (waveHeightM >= 1) return "amarilla";
  return "verde";
}

const POLLEN_LABELS: [string, string][] = [
  ["grass_pollen", "gramíneas"],
  ["olive_pollen", "olivo"],
  ["birch_pollen", "abedul"],
  ["alder_pollen", "aliso"],
  ["ragweed_pollen", "ambrosía"],
];

function pollenLevelOf(grains: number): number {
  if (!Number.isFinite(grains) || grains < 1) return 0;
  if (grains < 10) return 1;
  if (grains < 50) return 2;
  return 3;
}

interface WeatherCurrent {
  time?: string;
  [key: string]: unknown;
}

interface WeatherResponse {
  current?: WeatherCurrent;
  hourly?: { time?: string[]; precipitation_probability?: (number | null)[]; precipitation?: (number | null)[] };
}

/** Una fuente opcional caída no puede tumbar la herramienta. */
async function optionalWeather(url: string): Promise<WeatherResponse | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return null;
    return (await response.json()) as WeatherResponse;
  } catch {
    return null;
  }
}

async function runWeather(args: Record<string, unknown>): Promise<ToolResult> {
  let lat = asNumber(args.lat);
  let lon = asNumber(args.lon);
  let name = typeof args.place === "string" ? args.place.trim() : "";

  if (lat === null || lon === null) {
    if (!name) throw new Error("Indica `place` (nombre) o `lat` + `lon`");
    const response = await fetch(
      `${GEOCODING_URL}?name=${encodeURIComponent(name)}&count=1&language=es&format=json`,
      { signal: AbortSignal.timeout(12_000) },
    );
    if (!response.ok) throw new Error(`El buscador de lugares respondió ${response.status}`);
    const payload = (await response.json()) as {
      results?: { name?: string; latitude?: number; longitude?: number; country_code?: string }[];
    };
    const hit = payload.results?.[0];
    if (!hit || typeof hit.latitude !== "number" || typeof hit.longitude !== "number") {
      throw new Error(`No encuentro «${name}»; prueba con otro nombre o con coordenadas`);
    }
    lat = hit.latitude;
    lon = hit.longitude;
    name = hit.country_code ? `${hit.name ?? name} (${hit.country_code})` : (hit.name ?? name);
  }

  const currentFields =
    "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,snow_depth,freezing_level_height";
  const response = await fetch(
    `${FORECAST_URL}?latitude=${lat}&longitude=${lon}&current=${currentFields}` +
      `&hourly=precipitation_probability,precipitation&forecast_hours=${WEATHER_HOURS}&timezone=UTC`,
    { signal: AbortSignal.timeout(12_000) },
  );
  if (!response.ok) throw new Error(`Open-Meteo respondió ${response.status}`);
  const forecast = (await response.json()) as WeatherResponse;
  const now = forecast.current;
  if (!now) throw new Error("Open-Meteo no devolvió el estado actual");

  const temperatureC = asNumber(now.temperature_2m) ?? 0;
  const humidityPercent = asNumber(now.relative_humidity_2m) ?? 0;
  const windKmh = asNumber(now.wind_speed_10m) ?? 0;
  const precipitationMm = asNumber(now.precipitation) ?? 0;
  const index = dryingIndexOf(temperatureC, humidityPercent, windKmh, precipitationMm);

  const [marine, air] = await Promise.all([
    optionalWeather(
      `${MARINE_URL}?latitude=${lat}&longitude=${lon}` +
        `&current=wave_height,swell_wave_height,sea_surface_temperature&timezone=UTC`,
    ),
    optionalWeather(
      `${AIR_QUALITY_URL}?latitude=${lat}&longitude=${lon}` +
        `&current=grass_pollen,olive_pollen,birch_pollen,alder_pollen,ragweed_pollen&timezone=UTC`,
    ),
  ]);

  let pollen: { species: string; grains: number; level: number } | null = null;
  for (const [key, label] of POLLEN_LABELS) {
    const value = asNumber(air?.current?.[key]);
    if (value === null) continue;
    if (!pollen || value > pollen.grains) {
      pollen = { species: label, grains: value, level: pollenLevelOf(value) };
    }
  }

  const waveHeightM = asNumber(marine?.current?.wave_height);
  const hourlyTime = forecast.hourly?.time ?? [];
  const probabilities = forecast.hourly?.precipitation_probability ?? [];
  const precipitations = forecast.hourly?.precipitation ?? [];
  const nextHours = hourlyTime.slice(0, WEATHER_HOURS).map((time, i) => ({
    time,
    precipitationProbability: asNumber(probabilities[i]),
    precipitationMm: asNumber(precipitations[i]),
  }));

  return ok({
    source: "open-meteo.com",
    place: { lat, lon, name: name || `${lat}, ${lon}` },
    observedAt: now.time ?? null,
    now: {
      temperatureC,
      humidityPercent,
      windKmh,
      precipitationMm,
      precipitationProbability: nextHours[0]?.precipitationProbability ?? null,
    },
    drying: { index, verdict: dryingVerdictOf(index) },
    snow: {
      snowDepthCm: Math.round((asNumber(now.snow_depth) ?? 0) * 100),
      freezingLevelM: asNumber(now.freezing_level_height),
    },
    sea:
      waveHeightM === null
        ? { available: false, note: "Open-Meteo Marine no cubre este punto (tierra adentro)." }
        : {
            available: true,
            waveHeightM,
            swellHeightM: asNumber(marine?.current?.swell_wave_height),
            seaTemperatureC: asNumber(marine?.current?.sea_surface_temperature),
            flag: seaFlagOf(waveHeightM),
            flagNote: "La bandera se deduce del oleaje; en playa manda la del socorrista.",
          },
    pollen: pollen
      ? { available: true, ...pollen, unit: "granos/m³" }
      : { available: false, note: "CAMS sólo publica recuentos de polen en Europa." },
    nextHours,
  });
}

async function runDbSelect(args: Record<string, unknown>, caller: Caller): Promise<ToolResult> {
  const table = String(args.table ?? "");
  const allowed = READABLE_TABLES[table];
  if (!allowed) throw new Error(`Tabla no permitida: ${table}`);

  const requestedColumns =
    typeof args.columns === "string" && args.columns.trim()
      ? args.columns.split(",").map((column) => column.trim()).filter(Boolean)
      : [...allowed];
  const unknown = requestedColumns.filter((column) => !allowed.includes(column));
  if (unknown.length > 0) {
    throw new Error(`Columnas no permitidas en ${table}: ${unknown.join(", ")}`);
  }

  const filters: Record<string, string> = {};
  const raw = args.filters;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!allowed.includes(key)) throw new Error(`No se puede filtrar ${table} por ${key}`);
      if (value === null || value === undefined) continue;
      filters[key] = String(value);
    }
  }

  if (!caller.token) throw new Error("Necesitas iniciar sesión para leer tus datos");

  const limit = asInt(args.limit, 10, 1, 50);
  const rows = await selectRows(caller.token, table, requestedColumns.join(","), limit, filters);
  return ok({ table, columns: requestedColumns, count: rows.length, rows });
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
  caller: Caller,
): Promise<ToolResult> {
  const tool = TOOLS.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`Herramienta desconocida: ${name}`);
  if (TIER_RANK[caller.tier] < TIER_RANK[tool.minTier]) {
    throw new Error(`La herramienta ${name} requiere plan ${tool.minTier}`);
  }

  try {
    if (name === "telemetry.satellites") return await runSatellites(args);
    if (name === "osint.events") return await runOsint(args);
    if (name === "weather.outlook") return await runWeather(args);
    if (name === "github.repo") return await runGitRepo(args, caller);
    if (name === "github.propose") return await runGitPropose(args, caller);
    return await runDbSelect(args, caller);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error de la herramienta";
    // Igual que el registro local: el fallo se devuelve como contenido para que
    // el modelo lo explique, no como excepción de protocolo.
    return { content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true };
  }
}

/* ------------------------------ protocolo ------------------------------ */

function handleJsonRpc(
  body: { id?: string | number | null; method?: string; params?: Record<string, unknown> },
  caller: Caller,
) {
  const id = body.id ?? null;
  // Las herramientas de GitHub hablan por un proxy que valida la identidad: a
  // un invitado no se le ofrecen, porque listarlas sería prometer algo que no
  // puede ejecutar.
  const visible = TOOLS.filter(
    (tool) =>
      TIER_RANK[tool.minTier] <= TIER_RANK[caller.tier] &&
      (caller.userId !== null || !tool.name.startsWith("github.")),
  );

  switch (body.method) {
    case "initialize":
      return json({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: { name: "aitor-mcp", version: "1.0.0" },
          capabilities: { tools: {} },
        },
      });
    case "ping":
      return json({ jsonrpc: "2.0", id, result: {} });
    case "tools/list":
      return json({ jsonrpc: "2.0", id, result: { tools: visible } });
    case "tools/call": {
      const name = String(body.params?.name ?? "");
      const args = (body.params?.arguments ?? {}) as Record<string, unknown>;
      // `.catch` no es decorativo: el rechazo por plan insuficiente sale de
      // `callTool` antes de su propio try, y sin capturarlo la promesa quedaba
      // sin manejar y el handler terminaba en un 500 sin JSON-RPC de vuelta.
      return callTool(name, args, caller)
        .then((result) => json({ jsonrpc: "2.0", id, result }))
        .catch((error: unknown) =>
          json({
            jsonrpc: "2.0",
            id,
            error: {
              code: -32603,
              message: error instanceof Error ? error.message : "Error de la herramienta",
            },
          }),
        );
    }
    default:
      return Promise.resolve(
        json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Método no soportado: ${body.method}` } }),
      );
  }
}

/* -------------------------------- gemini -------------------------------- */

const NOT_A_CHAT_MODEL = /embedding|imagen|image|tts|veo|robotics|vision|learnlm/i;

function pickModel(names: string[]): string | null {
  const usable = names
    .map((name) => name.replace(/^models\//, ""))
    .filter((name) => !NOT_A_CHAT_MODEL.test(name));
  if (usable.length === 0) return null;
  const score = (name: string) => {
    let value = 0;
    if (/flash/i.test(name)) value += 4;
    if (/lite/i.test(name)) value += 1;
    if (/preview|exp/i.test(name)) value -= 2;
    const version = /gemini-(\d+)(?:\.(\d+))?/i.exec(name);
    if (version) value += Number(version[1]) * 2 + Number(version[2] ?? 0) / 10;
    return value;
  };
  return usable.sort((a, b) => score(b) - score(a))[0] ?? null;
}

const schemaTypes: Record<string, string> = {
  string: "STRING",
  number: "NUMBER",
  integer: "INTEGER",
  boolean: "BOOLEAN",
  array: "ARRAY",
  object: "OBJECT",
};

function toGeminiSchema(property: Record<string, unknown>): Record<string, unknown> {
  const schema: Record<string, unknown> = { type: schemaTypes[String(property.type)] ?? "STRING" };
  if (property.description) schema.description = property.description;
  if (property.enum) schema.enum = property.enum;
  return schema;
}

function geminiTools(tools: ToolDefinition[]) {
  return [
    {
      functionDeclarations: tools.map((tool) => {
        const properties = (tool.inputSchema.properties ?? {}) as Record<string, Record<string, unknown>>;
        const parameters: Record<string, unknown> = {
          type: "OBJECT",
          properties: Object.fromEntries(
            Object.entries(properties).map(([key, value]) => [key, toGeminiSchema(value)]),
          ),
        };
        if (Array.isArray(tool.inputSchema.required) && tool.inputSchema.required.length) {
          parameters.required = tool.inputSchema.required;
        }
        return { name: tool.name, description: tool.description, parameters };
      }),
    },
  ];
}

/** Un modelo Flash utilizable; se descubre para no fijar uno que caduque. */
async function resolveModel(): Promise<string> {
  const response = await fetch(`${GEMINI_BASE}/models`, {
    headers: { "x-goog-api-key": GEMINI_KEY },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Gemini /models respondió ${response.status}`);
  const payload = (await response.json()) as {
    models?: { name: string; supportedGenerationMethods?: string[] }[];
  };
  const names = (payload.models ?? [])
    .filter((model) => (model.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((model) => model.name);
  const chosen = pickModel(names);
  if (!chosen) throw new Error("La cuenta no expone ningún modelo de chat");
  return chosen;
}

interface GeminiPart {
  text?: string;
  functionCall?: { name?: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

async function generate(model: string, body: Record<string, unknown>) {
  const response = await fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": GEMINI_KEY },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Gemini ${response.status}: ${detail.slice(0, 200)}`);
  }
  const payload = (await response.json()) as {
    candidates?: { content?: { role?: string; parts?: GeminiPart[] } }[];
  };
  const content = payload.candidates?.[0]?.content;
  if (!content?.parts?.length) throw new Error("Gemini devolvió una respuesta sin partes");
  return content.parts;
}

const MAX_ROUNDS = 3;

async function runAgent(prompt: string, caller: Caller) {
  const model = await resolveModel();
  const visible = TOOLS.filter((tool) => TIER_RANK[tool.minTier] <= TIER_RANK[caller.tier]);
  const contents: { role: string; parts: GeminiPart[] }[] = [{ role: "user", parts: [{ text: prompt }] }];
  const toolCalls: { name: string; args: Record<string, unknown>; isError: boolean }[] = [];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const body: Record<string, unknown> = {
      contents,
      tools: geminiTools(visible),
      systemInstruction: {
        parts: [
          {
            text:
              "Eres el operador de AI-TOR. Usa las herramientas cuando necesites telemetría " +
              "orbital o eventos OSINT, y cita siempre la fuente y la hora del dato. Si una " +
              "herramienta falla, explícalo en vez de estimar cifras.",
          },
        ],
      },
    };

    const parts = await generate(model, body);
    const calls = parts.filter((part) => part.functionCall?.name);

    if (calls.length === 0) {
      return {
        answer: parts.map((part) => part.text ?? "").join("").trim(),
        toolCalls,
        model,
      };
    }

    contents.push({ role: "model", parts });
    const responses: GeminiPart[] = [];

    for (const part of calls) {
      const name = part.functionCall?.name as string;
      const args = part.functionCall?.args ?? {};
      const result = await callTool(name, args, caller);
      toolCalls.push({ name, args, isError: result.isError === true });
      responses.push({
        functionResponse: {
          name,
          response: result.structuredContent ?? { text: result.content[0]?.text ?? "" },
        },
      });
    }

    contents.push({ role: "user", parts: responses });
  }

  return { answer: "Se agotaron las rondas de herramientas sin respuesta final.", toolCalls, model };
}

/* ------------------------- cuota por usuario ------------------------- */

const BUCKETS = new Map<string, number[]>();

function withinQuota(userId: string): boolean {
  const now = Date.now();
  const hits = (BUCKETS.get(userId) ?? []).filter((at) => now - at < 60_000);
  if (hits.length >= 10) {
    BUCKETS.set(userId, hits);
    return false;
  }
  hits.push(now);
  BUCKETS.set(userId, hits);
  if (BUCKETS.size > 5_000) BUCKETS.clear();
  return true;
}

/* ------------------------------- handler ------------------------------- */

export default async function mcp(req: VercelRequest, res: VercelResponse) {
  const send = (result: { status: number; headers: Record<string, string>; body: string }) => {
    res.status(result.status);
    for (const [key, value] of Object.entries(result.headers)) res.setHeader(key, value);
    res.send(result.body);
  };

  if (req.method === "OPTIONS") {
    res.status(204);
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "authorization, content-type");
    res.setHeader("access-control-allow-methods", "POST, OPTIONS");
    return res.end();
  }
  if (req.method !== "POST") return send(json({ error: "Usa POST" }, 405));

  const forwarded = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  const caller = await resolveCaller(req.headers.authorization, ip);
  if (!caller) return send(json({ error: "No autorizado" }, 401));

  const body = (typeof req.body === "string" ? safeParse(req.body) : req.body) as
    | { id?: string | number | null; method?: string; params?: Record<string, unknown>; prompt?: unknown }
    | null;

  if (!body || typeof body !== "object") return send(json({ error: "El cuerpo debe ser JSON" }, 400));

  if (typeof body.prompt === "string" && body.prompt.trim()) {
    // El bucle del modelo gasta la cuota de una clave compartida, así que no se
    // abre a invitados: sin identidad no hay a quién cobrarle el turno.
    if (!caller.userId) {
      return send(json({ error: "Inicia sesión para usar el agente MCP" }, 401));
    }
    if (!GEMINI_KEY) {
      return send(json({ error: "GEMINI_API_KEY no está configurada en el despliegue" }, 501));
    }
    if (!withinQuota(caller.userId)) {
      return send(json({ error: "Demasiadas peticiones por minuto; reintenta en unos segundos" }, 429));
    }
    try {
      return send(json(await runAgent(body.prompt.trim().slice(0, 4000), caller)));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error del agente";
      return send(json({ error: message }, /Límite|quota|429/i.test(message) ? 429 : 502));
    }
  }

  if (body.method) {
    // Listar y ejecutar herramientas gratuitas no gasta credenciales, pero
    // tampoco regala un ariete: el anónimo tiene su propio cubo por IP.
    if (!caller.userId && !withinQuota(`anon:${caller.ip}`)) {
      return send(json({ error: "Demasiadas peticiones; reintenta en unos segundos" }, 429));
    }
    return send(await handleJsonRpc(body, caller));
  }

  return send(json({ error: "Se esperaba una petición JSON-RPC o { prompt }" }, 400));
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
