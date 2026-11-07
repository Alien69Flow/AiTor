/**
 * `GET|POST /api/league` — la clasificación real de la pestaña de juegos.
 *
 * Hasta ahora la liga vivía en `localStorage`: cada visitante veía su propia
 * lista y nadie competía con nadie. Aquí está el lado servidor: una fila por
 * partida en `game_scores`, tabla agregada por temporada en `game_season_table`
 * (ver `supabase/migrations/20261107210000_game_league.sql`).
 *
 * Dos reglas que no se negocian desde el navegador:
 *
 *  - La **temporada** la calcula el servidor en UTC. Si la mandara el cliente,
 *    cualquiera podría puntuar en la temporada que quisiera.
 *  - Los **puntos** también: del cliente sólo se acepta el juego y la marca, y
 *    la marca se recorta al máximo real de cada juego.
 *
 * Los ayudantes puros se exportan para poder probarlos sin red
 * (`api/league.test.ts`): validación, recorte, puntos y lectura del token.
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
    const submission = validateSubmission(body);
    if ("error" in submission) return res.status(400).json(submission);

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
      }),
    });

    if (!inserted.ok) {
      if (isMissingRelation(inserted.status, inserted.data)) {
        return res.status(503).json({
          error: "league_table_missing",
          hint: "Falta aplicar supabase/migrations/20261107210000_game_league.sql",
          season,
        });
      }
      return res.status(502).json({
        error: "league_write_failed",
        status: inserted.status,
        detail: typeof inserted.data === "string" ? inserted.data.slice(0, 200) : undefined,
      });
    }

    return res.status(201).json({
      entry: { ...submission, season },
      season,
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
