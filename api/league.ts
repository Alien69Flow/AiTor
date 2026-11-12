/**
 * `GET|POST /api/league` — la clasificación real de la pestaña de juegos.
 *
 * Una fila por partida en `game_scores`, agregada por temporada en
 * `game_season_table` (ver `supabase/migrations/20261107210000_game_league.sql`).
 *
 * Lo que el navegador NO decide, y por qué:
 *
 *  - La **temporada** la calcula el servidor en UTC. Si la mandara el cliente,
 *    cualquiera puntuaría en la temporada que quisiera.
 *  - Los **puntos** también: del cliente sólo se aceptan juego y marca, y la
 *    marca se recorta al techo real de cada juego.
 *  - El **reto del día**, que antes se creía a ciegas: ahora se compara la fecha
 *    contra el reloj del servidor y el juego contra la rotación.
 *  - Cada partida gasta un **nonce de un solo uso** emitido aquí. Sin nonce
 *    gastado no hay fila: ni se reenvía la misma marca ni se fabrican diez
 *    partidas con un POST repetido.
 *
 * El tope diario (60 partidas, 100 000 puntos) vive en Postgres, en el trigger
 * `game_scores_guard` de la migración de antifraude, porque una política RLS no
 * puede sumar filas vecinas. Aquí sólo se traduce su error a un 429 legible.
 *
 * Los ayudantes puros se exportan para poder probarlos sin red
 * (`tests/api/league.test.ts`): validación, nonce, reto del día, recorte,
 * puntos y lectura del token.
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
 * una función serverless no puede importar de `src/` —los imports relativos
 * rompen el despliegue de Vercel, ver `api/_venues.ts`— y porque el servidor no
 * debe fiarse de los puntos que calcule el navegador.
 */
export const LEAGUE_POINTS: Record<LeagueGame, (score: number) => number> = {
  impulse: (score) => Math.max(0, Math.round(score)),
  memory: (score) => Math.max(0, Math.round(score)) * 40,
  reactor: (score) => Math.max(0, Math.round(score)),
};

/** Techo diario por jugador, en UTC. Espejo de `game_scores_guard`. */
export const DAILY_RUN_CAP = 60;
export const DAILY_POINTS_CAP = 100_000;
/** Nonces que se pueden pedir al día: sin esto, pedir mil y elegir el mejor sale gratis. */
export const DAILY_NONCE_CAP = 200;
/** Vida de un nonce: lo que tarda una partida larga más el envío. */
export const NONCE_TTL_SECONDS = 600;

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

/** Día en UTC, `YYYY-MM-DD`. El reto cambia a medianoche UTC, no por husos. */
export function dayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Hash estable del día (FNV-1a de 32 bits), espejo de `dailySeed` en `games-hub`.
 *  Sin aleatoriedad: el mismo día tiene que dar el mismo reto en cualquier
 *  equipo y también aquí, en el servidor. */
export function dailySeed(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Los juegos que pueden ser reto del día, en el mismo orden que la pestaña. */
export const DAILY_ROTATION: readonly LeagueGame[] = ["impulse", "memory", "reactor"];

/**
 * Juego del reto para un día `YYYY-MM-DD`.
 *
 * Es la regla que el cliente usaba a solas: el hash del día elige juego del
 * bucle. Repetirla aquí es lo que permite rechazar un `daily` inventado sin
 * creerse lo que manda el navegador.
 */
export function dailyGameFor(day: string): LeagueGame {
  return DAILY_ROTATION[dailySeed(day) % DAILY_ROTATION.length];
}

const NONCE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ¿Tiene forma de uuid v4 emitido por `start_game_run`? */
export function isNonce(value: unknown): value is string {
  return typeof value === "string" && NONCE_PATTERN.test(value);
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
  /** Nonce gastado que autoriza esta fila. */
  nonce: string;
}

/**
 * Valida el cuerpo de una partida. Devuelve el motivo si algo no encaja.
 *
 * `now` se inyecta para poder probar el cambio de día sin esperar a mañana.
 */
export function validateSubmission(body: unknown, now: Date = new Date()): Submission | { error: string } {
  const payload = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (!isLeagueGame(payload.game)) {
    return { error: `game debe ser uno de: ${LEAGUE_GAMES.join(", ")}` };
  }
  if (typeof payload.score !== "number" || !Number.isFinite(payload.score)) {
    return { error: "score debe ser un número" };
  }
  if (!isNonce(payload.nonce)) {
    return { error: "falta el nonce: pide uno con POST /api/league {action:\"start\"}" };
  }

  const today = dayKey(now);
  let daily: string | null = null;
  if (payload.daily !== undefined && payload.daily !== null) {
    if (typeof payload.daily !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(payload.daily)) {
      return { error: "daily debe ser YYYY-MM-DD" };
    }
    // El reto se valida contra el reloj del servidor: ni ayer ni mañana.
    if (payload.daily !== today) {
      return { error: `daily debe ser el reto de hoy (${today})` };
    }
    const expected = dailyGameFor(today);
    if (payload.game !== expected) {
      return { error: `el reto de hoy es ${expected}` };
    }
    daily = payload.daily;
  }

  const score = clampScore(payload.game, payload.score);
  return { game: payload.game, score, points: leaguePoints(payload.game, score), daily, nonce: payload.nonce };
}

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
    /(does not exist|no existe|undefined table|42P01|PGRST204|42883)/i.test(text)
  );
}

function errorText(data: unknown): string {
  return typeof data === "string" ? data : JSON.stringify(data ?? "");
}

/**
 * Traduce un fallo de las funciones de nonce a una respuesta concreta.
 *
 * Sin esto, un tope diario y una migración sin aplicar se verían los dos como
 * un 502 genérico y el jugador no sabría si insistir mañana o avisar al dueño.
 */
function nonceFailure(
  res: VercelResponse,
  result: { ok: boolean; status: number; data: unknown },
  phase: "start" | "consume",
): VercelResponse {
  if (isMissingRelation(result.status, result.data)) {
    return res.status(503).json({
      error: "league_table_missing",
      hint: "Falta aplicar supabase/migrations/20261112150000_game_league_anticheat.sql",
      phase,
    });
  }
  const text = errorText(result.data);
  if (/daily_nonce_cap/.test(text)) {
    return res.status(429).json({ error: "daily_cap", unit: "nonces", limit: DAILY_NONCE_CAP });
  }
  if (/unauthorized/.test(text)) {
    return res.status(401).json({ error: "unauthorized", hint: "Inicia sesión para puntuar" });
  }
  if (/unknown_game/.test(text)) {
    return res.status(400).json({ error: `game debe ser uno de: ${LEAGUE_GAMES.join(", ")}` });
  }
  return res.status(502).json({ error: "league_nonce_failed", phase, status: result.status });
}

/** Info del reto del día tal como la ve el servidor. */
function dailyNow(now: Date = new Date()) {
  const id = dayKey(now);
  return { id, game: dailyGameFor(id) };
}

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

    const rows = (Array.isArray(table.data) ? table.data : []) as Record<string, unknown>[];
    const claims = decodeClaims(bearer(req));
    const userId = typeof claims?.sub === "string" ? claims.sub : null;
    const mine = userId ? rows.find((row) => row.user_id === userId) ?? null : null;

    return res.status(200).json({
      season,
      // La temporada cierra a medianoche UTC del último día del mes.
      endsAt: `${season}-01T00:00:00.000Z`,
      // El reto del día lo publica el servidor: así el cliente no puede elegir
      // uno distinto del que se va a validar al enviar la partida.
      daily: dailyNow(),
      rows: rows.map((row, index) => ({
        rank: index + 1,
        handle: String(row.handle ?? "jugador"),
        points: Number(row.points ?? 0),
        runs: Number(row.runs ?? 0),
        best: Number(row.best ?? 0),
        lastPlayed: row.last_played ?? null,
      })),
      me: mine
        ? {
            rank: rows.indexOf(mine) + 1,
            handle: String(mine.handle ?? "jugador"),
            points: Number(mine.points ?? 0),
            runs: Number(mine.runs ?? 0),
            best: Number(mine.best ?? 0),
          }
        : null,
      signedIn: Boolean(userId),
      total: rows.length,
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

    // Pedir nonce: paso previo obligatorio de cada partida.
    if (payload.action === "start") {
      if (!isLeagueGame(payload.game)) {
        return res.status(400).json({ error: `game debe ser uno de: ${LEAGUE_GAMES.join(", ")}` });
      }
      const started = await rest("rpc/start_game_run", {
        token,
        method: "POST",
        body: JSON.stringify({ p_game: payload.game }),
      });
      if (!started.ok) return nonceFailure(res, started, "start");

      const row = (Array.isArray(started.data) ? started.data[0] : started.data) as
        | Record<string, unknown>
        | null
        | undefined;
      if (!isNonce(row?.nonce)) {
        return res.status(502).json({ error: "nonce_not_issued" });
      }
      return res.status(201).json({
        nonce: row?.nonce,
        expiresAt: row?.expires_at ?? null,
        ttlSeconds: NONCE_TTL_SECONDS,
        game: payload.game,
        season: seasonOf(),
        daily: dailyNow(),
      });
    }

    const submission = validateSubmission(payload);
    if ("error" in submission) return res.status(400).json(submission);

    // Se gasta antes de escribir: así un nonce no puede autorizar dos filas ni
    // por carrera entre dos peticiones simultáneas.
    const consumed = await rest("rpc/consume_game_run", {
      token,
      method: "POST",
      body: JSON.stringify({ p_nonce: submission.nonce, p_game: submission.game }),
    });
    if (!consumed.ok) return nonceFailure(res, consumed, "consume");
    if (consumed.data !== true) {
      return res.status(409).json({
        error: "nonce_invalid",
        hint: "El nonce ya se usó, caducó o no es de este juego: pide otro antes de jugar",
      });
    }

    const season = seasonOf();
    const inserted = await rest("game_scores", {
      token,
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: userId,
        handle: handleFromClaims(claims),
        game: submission.game,
        score: submission.score,
        points: submission.points,
        season,
        daily: submission.daily,
        run_nonce: submission.nonce,
      }),
    });

    if (!inserted.ok) {
      const text = errorText(inserted.data);
      if (isMissingRelation(inserted.status, inserted.data)) {
        return res.status(503).json({
          error: "league_table_missing",
          hint: "Falta aplicar supabase/migrations/20261107210000_game_league.sql y la de antifraude",
          season,
        });
      }
      if (/daily_run_cap/.test(text)) {
        return res.status(429).json({ error: "daily_cap", unit: "runs", limit: DAILY_RUN_CAP, season });
      }
      if (/daily_points_cap/.test(text)) {
        return res
          .status(429)
          .json({ error: "daily_cap", unit: "points", limit: DAILY_POINTS_CAP, season });
      }
      if (/unknown_run_nonce|missing_run_nonce/.test(text)) {
        return res.status(409).json({ error: "nonce_invalid", season });
      }
      return res.status(502).json({
        error: "league_write_failed",
        status: inserted.status,
        detail: typeof inserted.data === "string" ? inserted.data.slice(0, 200) : undefined,
      });
    }

    return res.status(201).json({
      entry: {
        game: submission.game,
        score: submission.score,
        points: submission.points,
        daily: submission.daily,
        season,
      },
      season,
      daily: dailyNow(),
    });
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
