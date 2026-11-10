import { describe, expect, it, vi } from "vitest";
import handler, {
  MAX_SCORE,
  MAX_UNVERIFIED_RUNS_PER_DAY,
  clampScore,
  countsForDaily,
  dateKey,
  decodeClaims,
  handleFromClaims,
  isLeagueGame,
  isMissingRelation,
  leaguePoints,
  seasonOf,
  serverChallenge,
  startOfUtcDay,
  validateSubmission,
} from "./league";
import { dailyChallenge } from "../src/lib/games-hub";

/**
 * La liga decide con datos de otros: temporada, puntos, reto del día y nombre
 * visible. Aquí se fija lo que el navegador no puede saltarse y lo que impide
 * inflar la tabla: puntos del servidor, reto recalculado y testigo de partida.
 */

interface Result {
  status: number;
  body: Record<string, unknown> & {
    rows?: { handle: string; rank: number }[];
    me?: unknown;
    entry?: { points: number; daily: string | null; verified?: boolean };
    nonce?: string | null;
  };
}

type Req = Parameters<typeof handler>[0];
type Res = Parameters<typeof handler>[1];

function call(options: { method?: string; query?: Record<string, string>; body?: unknown; auth?: string }) {
  return new Promise<Result>((resolve) => {
    const req = {
      method: options.method ?? "GET",
      query: options.query ?? {},
      body: options.body,
      headers: options.auth ? { authorization: `Bearer ${options.auth}` } : {},
    } as unknown as Req;
    const res = {
      statusCode: 0,
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this.headers[name] = value;
        return this;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        resolve({ status: this.statusCode, body: payload as Result["body"] });
        return this;
      },
    } as unknown as Res;
    void handler(req, res);
  });
}

/** JWT de mentira: sólo la carga útil importa aquí, la firma la valida Postgres. */
function token(claims: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims)}.firma`;
}

/** Respuesta REST falsa: se enruta por método y trozo de URL. */
function mockRest(respond: (options: { method: string; url: string; body: string | null }) => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) =>
      respond({ method: init?.method ?? "GET", url: String(url), body: typeof init?.body === "string" ? init.body : null }),
    ),
  );
}

const JWT = token({ sub: "user-1", email: "aitor@alienflow.space" });
const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status });

describe("validación de una partida", () => {
  it("acepta los tres juegos y calcula los puntos en el servidor", () => {
    expect(validateSubmission({ game: "impulse", score: 340 })).toEqual({
      game: "impulse",
      score: 340,
      points: 340,
      daily: null,
    });
    const memory = validateSubmission({ game: "memory", score: 3 });
    if (!("error" in memory)) expect(memory.points).toBe(120);
  });

  it("rechaza un juego inventado y una marca que no es número", () => {
    expect(validateSubmission({ game: "tetris", score: 10 })).toEqual({
      error: "game debe ser uno de: impulse, memory, reactor",
    });
    expect(validateSubmission({ game: "impulse", score: "10" })).toEqual({
      error: "score debe ser un número",
    });
  });

  it("recorta la marca y no deja inflar los puntos", () => {
    expect(clampScore("impulse", 10_000_000)).toBe(MAX_SCORE.impulse);
    expect(clampScore("memory", 99)).toBe(MAX_SCORE.memory);
    expect(leaguePoints("memory", 12)).toBe(480);
    expect(leaguePoints("memory", 1e9)).toBeLessThanOrEqual(MAX_SCORE.memory * 40);
    expect(isLeagueGame("reactor")).toBe(true);
    expect(isLeagueGame("Reactor")).toBe(false);
  });
});

describe("reto del día", () => {
  it("el servidor reparte el mismo reto que la web durante 90 días", () => {
    const start = Date.UTC(2026, 0, 1);
    for (let day = 0; day < 90; day++) {
      const date = new Date(start + day * 86_400_000);
      expect(serverChallenge(date)).toEqual(dailyChallenge(date));
    }
  });

  it("sólo cuenta como reto la fecha de hoy en el juego de hoy", () => {
    const today = new Date(Date.UTC(2026, 10, 10, 12, 0));
    const challenge = serverChallenge(today);
    expect(countsForDaily(challenge.game, challenge.id, today)).toBe(challenge.id);
    expect(countsForDaily(challenge.game, "2020-01-01", today)).toBeNull();
    expect(countsForDaily(challenge.game, undefined, today)).toBeNull();
  });

  it("el día y la temporada se leen en UTC", () => {
    const lateNight = new Date(Date.UTC(2026, 10, 7, 23, 59));
    expect(dateKey(lateNight)).toBe("2026-11-07");
    expect(seasonOf(lateNight)).toBe("2026-11");
    expect(startOfUtcDay(lateNight)).toBe("2026-11-07T00:00:00.000Z");
  });
});

describe("temporada y nombre visible", () => {
  it("lee el JWT sin verificarlo y saca un nombre limpio", () => {
    const claims = decodeClaims(token({ sub: "abc", email: "aitor@alienflow.space" }));
    expect(claims?.sub).toBe("abc");
    expect(handleFromClaims(claims)).toBe("aitor");
    expect(handleFromClaims(decodeClaims(token({ user_metadata: { full_name: "Aitor Álvarez" } })))).toBe(
      "AitorAlvarez",
    );
    expect(handleFromClaims(decodeClaims(token({ email: "x@y.z" })))).toBe("jugador");
    expect(handleFromClaims(null)).toBe("jugador");
    expect(decodeClaims("no-es-un-jwt")).toBeNull();
  });
});

describe("ruta de la liga", () => {
  it("una tabla sin migrar es 503, no una clasificación vacía", async () => {
    mockRest(() => json({ message: 'relation "game_season_table" does not exist', code: "42P01" }, 400));
    try {
      const { status, body } = await call({ query: { season: "2026-11" } });
      expect(status).toBe(503);
      expect(body.error).toBe("league_table_missing");
      expect(isMissingRelation(400, { code: "42P01" })).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("devuelve la tabla con puestos, tu fila y el reto del servidor", async () => {
    mockRest(() =>
      json([
        { handle: "aitor", points: 900, runs: 4, best: 420, user_id: "user-1", last_played: "2026-11-07T10:00:00Z" },
        { handle: "nova", points: 1200, runs: 2, best: 700, user_id: "user-2", last_played: null },
      ]),
    );
    try {
      const { status, body } = await call({ query: { season: "2026-11", limit: "10" }, auth: JWT });
      expect(status).toBe(200);
      expect(body.rows?.map((row) => row.handle)).toEqual(["aitor", "nova"]);
      expect(body.me).toMatchObject({ rank: 1, points: 900 });
      expect(body.signedIn).toBe(true);
      expect(body.challenge).toMatchObject({ id: dateKey() });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("sin sesión la tabla es pública pero no hay fila propia", async () => {
    mockRest(() => json([]));
    try {
      const { body } = await call({ query: {} });
      expect(body.signedIn).toBe(false);
      expect(body.me).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("puntuar sin token es 401", async () => {
    const { status, body } = await call({ method: "POST", body: { game: "impulse", score: 10 } });
    expect(status).toBe(401);
    expect(body.error).toBe("unauthorized");
  });

  it("un método que no existe no rompe: 405", async () => {
    const { status } = await call({ method: "DELETE" });
    expect(status).toBe(405);
  });
});

describe("testigo de partida", () => {
  it("abrir un testigo devuelve el nonce, el reto y su caducidad", async () => {
    let created: Record<string, unknown> | null = null;
    mockRest(({ method, url, body }) => {
      if (method === "GET" && url.includes("league_run_tokens?user_id=eq.user-1")) return json([]);
      if (method === "POST" && url.endsWith("league_run_tokens")) {
        created = JSON.parse(String(body));
        return json([{ id: "11111111-1111-1111-1111-111111111111" }], 201);
      }
      return json({ message: "ruta no simulada", url }, 500);
    });
    try {
      const { status, body } = await call({ method: "POST", auth: JWT, body: { intent: "start", game: "memory" } });
      expect(status).toBe(201);
      expect(body.nonce).toBe("11111111-1111-1111-1111-111111111111");
      expect(body.daily).toBe(dateKey());
      expect(created).toMatchObject({ user_id: "user-1", game: "memory", season: seasonOf(), daily: dateKey() });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("no se abren más testigos que partidas caben en el día", async () => {
    mockRest(() => json(Array.from({ length: 40 }, (_, i) => ({ id: `t-${i}` }))));
    try {
      const { status, body } = await call({ method: "POST", auth: JWT, body: { intent: "start", game: "impulse" } });
      expect(status).toBe(429);
      expect(body.error).toBe("daily_run_limit");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("una partida con testigo nuevo se inserta y el testigo se cierra antes", async () => {
    const order: string[] = [];
    let sent: Record<string, unknown> | null = null;
    mockRest(({ method, url, body }) => {
      if (method === "GET" && url.includes("league_run_tokens?id=eq.nonce-1")) {
        return json([
          { id: "nonce-1", user_id: "user-1", game: "memory", expires_at: new Date(Date.now() + 60_000).toISOString(), used_at: null },
        ]);
      }
      if (method === "PATCH" && url.includes("used_at=is.null")) {
        order.push("cerrar");
        return json([{ id: "nonce-1", used_at: new Date().toISOString() }]);
      }
      if (method === "GET" && url.includes("game_scores?user_id=eq.user-1")) return json([]);
      if (method === "POST" && url.endsWith("game_scores")) {
        order.push("insertar");
        sent = JSON.parse(String(body));
        return json([{ id: "row-1" }], 201);
      }
      return json({ message: "ruta no simulada", url }, 500);
    });
    try {
      const { status, body } = await call({
        method: "POST",
        auth: JWT,
        body: { game: "memory", score: 4, nonce: "nonce-1" },
      });
      expect(status).toBe(201);
      expect(body.entry.verified).toBe(true);
      expect(body.entry.points).toBe(160);
      expect(order).toEqual(["cerrar", "insertar"]);
      expect(sent).toMatchObject({ user_id: "user-1", game: "memory", score: 4, points: 160, season: seasonOf() });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("un testigo gastado no deja puntuar dos veces", async () => {
    mockRest(({ url }) => {
      if (url.includes("league_run_tokens?id=eq.nonce-1")) {
        return json([
          {
            id: "nonce-1",
            user_id: "user-1",
            game: "memory",
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            used_at: new Date().toISOString(),
          },
        ]);
      }
      return json({ message: "no debería llegar aquí", url }, 500);
    });
    try {
      const { status, body } = await call({
        method: "POST",
        auth: JWT,
        body: { game: "memory", score: 4, nonce: "nonce-1" },
      });
      expect(status).toBe(409);
      expect(body.error).toBe("run_token_used");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("un testigo de otro juego no vale", async () => {
    mockRest(() =>
      json([
        { id: "nonce-1", user_id: "user-1", game: "reactor", expires_at: new Date(Date.now() + 60_000).toISOString(), used_at: null },
      ]),
    );
    try {
      const { status, body } = await call({
        method: "POST",
        auth: JWT,
        body: { game: "memory", score: 4, nonce: "nonce-1" },
      });
      expect(status).toBe(400);
      expect(body.error).toBe("run_token_game_mismatch");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("sin testigo el cupo baja a tres partidas al día", async () => {
    const today = Array.from({ length: MAX_UNVERIFIED_RUNS_PER_DAY }, (_, i) => ({ id: `r-${i}` }));
    mockRest(({ url }) => {
      if (url.includes("game_scores?user_id=eq.user-1")) return json(today);
      return json({ message: "no debería llegar aquí", url }, 500);
    });
    try {
      const { status, body } = await call({ method: "POST", auth: JWT, body: { game: "impulse", score: 120 } });
      expect(status).toBe(429);
      expect(body.error).toBe("daily_run_limit");
      expect(body.verified).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("un reto inventado se guarda como partida normal", async () => {
    let sent: Record<string, unknown> | null = null;
    mockRest(({ method, url, body }) => {
      if (method === "GET" && url.includes("game_scores?user_id=eq.user-1")) return json([]);
      if (method === "POST" && url.endsWith("game_scores")) {
        sent = JSON.parse(String(body));
        return json([{ id: "row-1" }], 201);
      }
      return json({ message: "ruta no simulada", url }, 500);
    });
    try {
      const { status, body } = await call({
        method: "POST",
        auth: JWT,
        body: { game: "impulse", score: 120, daily: "2020-01-01" },
      });
      expect(status).toBe(201);
      expect(body.entry.daily).toBeNull();
      expect(sent).toMatchObject({ daily: null });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
