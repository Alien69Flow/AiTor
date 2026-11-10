/**
 * `GET|POST /api/league` — la clasificación real de la pestaña de juegos.
 *
 * Una fila por partida en `game_scores`; la tabla agregada por temporada es
 * `game_season_table` (ver `supabase/migrations/20261107210000_game_league.sql`).
 *
 * Reglas que no se negocian desde el navegador:
 *
 *  - La **temporada** la calcula el servidor en UTC.
 *  - Los **puntos** también: del cliente sólo se acepta el juego y la marca, y
 *    la marca se recorta al techo real de cada juego.
 *  - El **reto del día** se recalcula aquí (`serverChallenge`): si el cliente
 *    dice otra fecha, la partida cuenta como normal y no como reto.
 *  - Cada partida enviada consume un **testigo** que se abrió antes de jugar
 *    (`intent: "start"`), caduca en dos horas y sólo vale una vez. Sin testigo
 *    el cupo diario baja a tres partidas.
 *
 * El testigo no convierte la marca en una prueba criptográfica —el motor corre
 * en el navegador— pero sí impide mandar puntuaciones en bucle: cada envío
 * gasta algo que alguien tuvo que abrir antes, y queda registrado cuántas
 * partidas se abren por día.
 *
 * Todo vive en este fichero a propósito: Vercel no bundlea imports relativos
 * entre ficheros de `api/` (ver el comentario de `_venues.ts`), así que un
 * módulo auxiliar aquí respondería 500 en producción.
 *
 * Los ayudantes puros se exportan para poder probarlos sin red
 * (`api/league.test.ts`).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

export const maxDuration = 20;

// Proyecto de identidad: el mismo que firma la sesión del chat y guarda
// `profiles`. La liga cuelga de `auth.users`, así que no hay que cruzar
// proyectos ni inventar un identificador paralelo.
const AUTH_URL =
  process.env.AUTH_SUPABASE_URL ||
  process.env.VITE_AUTH_SUPABASE_URL ||
  "https://pnyigikagdxqaogbiift.supabase.co";

const AUTH_KEY =
  process.env.AUTH_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_AUTH_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_c4VVYw8uPzt7-24KvOre6A_91csa5Xp";

export const LEAGUE_GAMES = ["impulse", "memory", "reactor"] as const;
export type LeagueGame = (typeof LEAGUE_GAMES)[number];

/**
 * Techo de marca por juego, para que una petición fabricada no envíe 10^9.
 *
 * No es una regla de juego —no recorta a nadie que juegue de verdad—: es el
 * límite de lo que el motor puede producir en una sesión larga.
 */
export const MAX_SCORE: Record<LeagueGame, number> = {
  impulse: 20_000,
  // La memoria puntúa en rondas y una partida perfecta son 12.
  memory: 12,
  reactor: 2_000,
};

/**
 * Puntos de liga por partida.
 *
 * Espejo de `HUB_POINTS_PER_GAME` en `src/lib/games-hub.ts`. Vive aquí porque
 * una función serverless no puede importar de `src/` y porque el servidor no
 * debe fiarse de los puntos que calcule el navegador.
 */
export const LEAGUE_POINTS: Record<LeagueGame, (score: number) => number> = {
  impulse: (score) => Math.max(0, Math.round(score)),
  memory: (score) => Math.max(0, Math.round(score)) * 40,
  reactor: (score) => Math.max(0, Math.round(score)),
};

/* ----------------------------- reto del día ------------------------------ */

export type ChallengeGame = LeagueGame;

/** Mismo valor que `MEMORY_NODES` en `src/lib/mini-games.ts`. */
const MEMORY_NODES = 6;

export interface ServerChallenge {
  id: string;
  game: ChallengeGame;
  label: string;
  detail: string;
  tolerance?: number;
  speed?: number;
  nodeCount?: number;
  seconds?: number;
  rounds?: number;
}

type Variant = Omit<ServerChallenge, "id" | "game">;

const IMPULSE_CHALLENGES: Variant[] = [
  { label: "Pulso estrecho", detail: "La ventana de acierto baja a 6 puntos.", tolerance: 6 },
  { label: "Pulso rápido", detail: "El indicador corre un 40 % más.", speed: 1.4 },
  { label: "Pulso paciente", detail: "Ventana de 6 y velocidad normal: no vale mirar el centro.", tolerance: 6 },
];

const MEMORY_CHALLENGES: Variant[] = [
  { label: "Cinco nodos", detail: "Un nodo menos: la secuencia se repite peor.", nodeCount: 5 },
  { label: "Cuatro nodos", detail: "Cuatro nodos y secuencias más largas de lo normal.", nodeCount: 4 },
  { label: "Memoria completa", detail: "Los seis nodos, sin ayudas.", nodeCount: MEMORY_NODES },
];

const REACTOR_CHALLENGES: Variant[] = [
  { label: "Reactor rápido", detail: "Cinco segundos por ronda: la suma tiene que salir de vista.", seconds: 5 },
  { label: "Reactor largo", detail: "Diez rondas seguidas; el tiempo es el normal.", rounds: 10 },
  { label: "Reactor doble presión", detail: "Diez rondas de cinco segundos: no hay margen para contar con los dedos.", seconds: 5, rounds: 10 },
];

const ROTATION: ChallengeGame[] = ["impulse", "memory", "reactor"];

/** Día en UTC, `YYYY-MM-DD`. El reto cambia a medianoche UTC. */
export function dateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Hash estable del día (FNV-1a de 32 bits), sin dependencias ni azar. */
export function dailySeed(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** El reto de una fecha: el mismo para todo el mundo y para siempre. */
export function serverChallenge(date: Date = new Date()): ServerChallenge {
  const id = dateKey(date);
  const seed = dailySeed(id);
  const game = ROTATION[seed % ROTATION.length];
  const pool =
    game === "impulse" ? IMPULSE_CHALLENGES : game === "memory" ? MEMORY_CHALLENGES : REACTOR_CHALLENGES;
  const variant = pool[Math.floor(seed / 7) % pool.length];
  return { id, game, ...variant };
}

/**
 * ¿La partida dice ser del reto correcto?
 *
 * Sólo hay una respuesta válida por día: la fecha de hoy, en el juego que toca.
 * Cualquier otra cosa se guarda como partida normal, sin marca de reto.
 */
export function countsForDaily(game: LeagueGame, daily: unknown, date: Date = new Date()): string | null {
  const challenge = serverChallenge(date);
  if (typeof daily !== "string" || daily !== challenge.id) return null;
  return game === challenge.game ? challenge.id : null;
}

/** Tope de partidas enviadas en un día cuando hay testigo. */
export const MAX_VERIFIED_RUNS_PER_DAY = 40;
/** Sin testigo (cliente antiguo o script) el margen es mínimo. */
export const MAX_UNVERIFIED_RUNS_PER_DAY = 3;

/** Cuánto vive un testigo desde que se abre. */
export const RUN_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

/** Inicio del día UTC, en ISO, para contar las partidas de hoy. */
export function startOfUtcDay(date: Date = new Date()): string {
  return `${dateKey(date)}T00:00:00.000Z`;
}

/* ------------------------------- marcas ---------------------------------- */

export function isLeagueGame(value: unknown): value is LeagueGame {
  return typeof value === "string" && (LEAGUE_GAMES as readonly string[]).includes(value);
}

/** Recorta una marca al rango real del juego. */
export function clampScore(game: LeagueGame, raw: unknown): number {
  const value = typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : 0;
  return Math.max(0, Math.min(MAX_SCORE[game], value));
}

export function leaguePoints(game: LeagueGame, score: number): number {
  return Math.max(0, Math.min(MAX_SCORE[game] * 40, LEAGUE_POINTS[game](score)));
}

/** Temporada de una fecha, en UTC y por meses: `YYYY-MM`. */
export function seasonOf(date: Date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

/**
 * Nombre visible del jugador, sacado del token **sin verificarlo**.
 *
 * La verificación la hace Postgres con la política `auth.uid() = user_id` al
 * insertar; aquí el nombre es sólo una etiqueta de la tabla. Aun así se sanea:
 * se queda con letras, números y tres separadores, y nunca pasa de 24.
 */
export function handleFromClaims(claims: Record<string, unknown> | null): string {
  if (!claims) return "jugador";
  const metadata = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const candidates = [metadata.full_name, metadata.name, metadata.user_name, claims.email];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const base = candidate.includes("@") ? candidate.split("@")[0] : candidate;
    const clean = base
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .slice(0, 24);
    if (clean.length >= 2) return clean;
  }
  return "jugador";
}

/** Carga útil de un JWT, sin comprobar la firma. `null` si no es un JWT. */
export function decodeClaims(token: string | undefined | null): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
    const json = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export interface Submission {
  game: LeagueGame;
  score: number;
  points: number;
  daily: string | null;
}

/** Valida el cuerpo de una partida. Devuelve el motivo si algo no encaja. */
export function validateSubmission(body: unknown): Submission | { error: string } {
  const payload = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (!isLeagueGame(payload.game)) {
    return { error: `game debe ser uno de: ${LEAGUE_GAMES.join(", ")}` };
  }
  if (typeof payload.score !== "number" || !Number.isFinite(payload.score)) {
    return { error: "score debe ser un número" };
  }
  const daily =
    typeof payload.daily === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.daily)
      ? payload.daily
      : null;
  const score = clampScore(payload.game, payload.score);
  return { game: payload.game, score, points: leaguePoints(payload.game, score), daily };
}

/* --------------------------------- red ----------------------------------- */

function bearer(req: VercelRequest): string {
  const header = req.headers.authorization;
  return typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : "";
}

async function rest(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const { token, ...restInit } = init;
  const response = await fetch(`${AUTH_URL}/rest/v1/${path}`, {
    ...restInit,
    headers: {
      apikey: AUTH_KEY,
      Authorization: `Bearer ${token || AUTH_KEY}`,
      "content-type": "application/json",
      ...(restInit.headers as Record<string, string> | undefined),
    },
    signal: AbortSignal.timeout(8_000),
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: response.ok, status: response.status, data };
}

/** ¿El error es «esa tabla/vista no existe»? Es el estado previo a la migración. */
export function isMissingRelation(status: number, data: unknown): boolean {
  const text = typeof data === "string" ? data : JSON.stringify(data ?? "");
  return (
    (status === 404 || status === 400) &&
    /(does not exist|no existe|undefined table|42P01|PGRST204)/i.test(text)
  );
}

function rows(data: unknown): Record<string, unknown>[] {
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}

const TOKEN_MISSING = {
  error: "league_tokens_missing",
  hint: "Falta aplicar supabase/migrations/20261110130000_league_run_tokens.sql",
};

/** Abre un testigo de partida: se pide antes de jugar, no después. */
async function openRun(res: VercelResponse, token: string, userId: string, payload: Record<string, unknown>) {
  const game = payload.game;
  if (!isLeagueGame(game)) {
    return res.status(400).json({ error: `game debe ser uno de: ${LEAGUE_GAMES.join(", ")}` });
  }

  const now = new Date();
  const challenge = serverChallenge(now);
  const season = seasonOf(now);

  const opened = await rest(
    `league_run_tokens?user_id=eq.${userId}&created_at=gte.${encodeURIComponent(startOfUtcDay(now))}` +
      `&select=id&limit=100`,
    { token },
  );
  if (!opened.ok) {
    if (isMissingRelation(opened.status, opened.data)) return res.status(503).json(TOKEN_MISSING);
    return res.status(502).json({ error: "league_unavailable" });
  }
  if (rows(opened.data).length >= MAX_VERIFIED_RUNS_PER_DAY) {
    return res.status(429).json({
      error: "daily_run_limit",
      limit: MAX_VERIFIED_RUNS_PER_DAY,
      hint: "Has abierto el máximo de partidas de hoy. Vuelve mañana (UTC).",
    });
  }

  const expiresAt = new Date(now.getTime() + RUN_TOKEN_TTL_MS).toISOString();
  const created = await rest("league_run_tokens", {
    token,
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ user_id: userId, game, season, daily: challenge.id, expires_at: expiresAt }),
  });
  if (!created.ok) {
    if (isMissingRelation(created.status, created.data)) return res.status(503).json(TOKEN_MISSING);
    return res.status(502).json({ error: "league_write_failed" });
  }

  const row = rows(created.data)[0];
  return res.status(201).json({
    nonce: typeof row?.id === "string" ? row.id : null,
    game,
    season,
    daily: challenge.id,
    expiresAt,
    challenge,
  });
}

/** Envía una partida: consume el testigo, cuenta el día y delega los puntos. */
async function submitRun(res: VercelResponse, token: string, userId: string, payload: Record<string, unknown>) {
  const submission = validateSubmission(payload);
  if ("error" in submission) return res.status(400).json(submission);

  const now = new Date();
  const nonce = typeof payload.nonce === "string" ? payload.nonce : "";
  let verified = false;

  if (nonce) {
    if (!/^[0-9a-f-]{36}$/i.test(nonce)) {
      return res.status(400).json({ error: "run_token_invalid" });
    }
    const found = await rest(
      `league_run_tokens?id=eq.${nonce}&select=id,user_id,game,expires_at,used_at`,
      { token },
    );
    if (!found.ok) {
      if (isMissingRelation(found.status, found.data)) return res.status(503).json(TOKEN_MISSING);
      return res.status(502).json({ error: "league_unavailable" });
    }
    const row = rows(found.data)[0];
    if (!row || row.user_id !== userId) return res.status(400).json({ error: "run_token_invalid" });
    if (row.used_at) return res.status(409).json({ error: "run_token_used" });
    if (row.game !== submission.game) return res.status(400).json({ error: "run_token_game_mismatch" });
    const expiresAt = Date.parse(String(row.expires_at));
    if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
      return res.status(409).json({ error: "run_token_expired" });
    }

    // Cierre atómico: sólo gana quien encuentra el testigo aún libre.
    const closed = await rest(`league_run_tokens?id=eq.${nonce}&used_at=is.null`, {
      token,
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ used_at: now.toISOString() }),
    });
    if (!closed.ok) return res.status(502).json({ error: "league_write_failed" });
    if (rows(closed.data).length === 0) return res.status(409).json({ error: "run_token_used" });
    verified = true;
  }

  // Cupo del día: contar lo ya enviado, con o sin testigo.
  const counted = await rest(
    `game_scores?user_id=eq.${userId}&created_at=gte.${encodeURIComponent(startOfUtcDay(now))}` +
      `&select=id&limit=100`,
    { token },
  );
  if (!counted.ok) {
    if (isMissingRelation(counted.status, counted.data)) {
      return res.status(503).json({
        error: "league_table_missing",
        hint: "Falta aplicar supabase/migrations/20261107210000_game_league.sql",
      });
    }
    return res.status(502).json({ error: "league_unavailable" });
  }
  const limit = verified ? MAX_VERIFIED_RUNS_PER_DAY : MAX_UNVERIFIED_RUNS_PER_DAY;
  if (rows(counted.data).length >= limit) {
    return res.status(429).json({ error: "daily_run_limit", limit, verified });
  }

  const daily = countsForDaily(submission.game, payload.daily, now);
  const season = seasonOf(now);
  const inserted = await rest("game_scores", {
    token,
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: userId,
      handle: handleFromClaims(decodeClaims(token)),
      game: submission.game,
      score: submission.score,
      points: submission.points,
      season,
      daily,
    }),
  });

  if (!inserted.ok) {
    if (isMissingRelation(inserted.status, inserted.data)) {
      return res.status(503).json({
        error: "league_table_missing",
        hint: "Falta aplicar supabase/migrations/20261107210000_game_league.sql",
      });
    }
    return res.status(502).json({
      error: "league_write_failed",
      status: inserted.status,
      detail: typeof inserted.data === "string" ? inserted.data.slice(0, 200) : undefined,
    });
  }

  return res.status(201).json({ entry: { ...submission, daily, season, verified }, season });
}

/* -------------------------------- handler -------------------------------- */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    const season =
      typeof req.query.season === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.season)
        ? req.query.season
        : seasonOf();
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) ? Math.min(50, Math.max(3, Math.round(rawLimit))) : 25;

    const table = await rest(
      `game_season_table?select=handle,points,runs,best,user_id,last_played` +
        `&season=eq.${season}&order=points.desc,runs.asc&limit=${limit}`,
    );

    if (!table.ok) {
      if (isMissingRelation(table.status, table.data)) {
        return res.status(503).json({
          error: "league_table_missing",
          hint: "Falta aplicar supabase/migrations/20261107210000_game_league.sql",
          season,
        });
      }
      return res.status(502).json({ error: "league_unavailable", season });
    }

    const list = rows(table.data);
    const claims = decodeClaims(bearer(req));
    const userId = typeof claims?.sub === "string" ? claims.sub : null;
    const mine = userId ? list.find((row) => row.user_id === userId) ?? null : null;

    return res.status(200).json({
      season,
      // La temporada cierra a medianoche UTC del último día del mes.
      endsAt: `${season}-01T00:00:00.000Z`,
      // El reto que el servidor va a validar al puntuar, para que la interfaz
      // no tenga que adivinarlo.
      challenge: serverChallenge(),
      rows: list.map((row, index) => ({
        rank: index + 1,
        handle: String(row.handle ?? "jugador"),
        points: Number(row.points ?? 0),
        runs: Number(row.runs ?? 0),
        best: Number(row.best ?? 0),
        lastPlayed: row.last_played ?? null,
      })),
      me: mine
        ? {
            rank: list.indexOf(mine) + 1,
            handle: String(mine.handle ?? "jugador"),
            points: Number(mine.points ?? 0),
            runs: Number(mine.runs ?? 0),
            best: Number(mine.best ?? 0),
          }
        : null,
      signedIn: Boolean(userId),
      total: list.length,
    });
  }

  if (req.method === "POST") {
    const token = bearer(req);
    const claims = decodeClaims(token);
    const userId = typeof claims?.sub === "string" ? claims.sub : null;
    if (!userId) {
      return res.status(401).json({ error: "unauthorized", hint: "Inicia sesión para puntuar" });
    }

    const body = typeof req.body === "string" ? safeJson(req.body) : req.body;
    const payload = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

    if (payload.intent === "start") return openRun(res, token, userId, payload);
    return submitRun(res, token, userId, payload);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "method_not_allowed" });
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
