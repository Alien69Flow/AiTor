import { describe, expect, it, vi } from "vitest";
import handler, {
  DAILY_ROTATION,
  DAILY_RUN_CAP,
  MAX_SCORE,
  clampScore,
  dailyGameFor,
  dayKey,
  decodeClaims,
  handleFromClaims,
  isLeagueGame,
  isMissingRelation,
  isNonce,
  leaguePoints,
  seasonOf,
  validateSubmission,
} from "../../api/league";

/**
 * La liga del servidor es la primera cosa de la pestaña de juegos que decide
 * algo con datos de otros: temporada, puntos y nombre visible. Lo que se fija
 * aquí son las reglas que el navegador no puede saltarse: temporada y puntos
 * los pone el servidor, el reto del día se compara con su reloj, y cada partida
 * se registra con una única llamada a `record_game_run`, que gasta el nonce y
 * escribe la fila en la misma transacción.
 */

interface Result {
  status: number;
  body: Record<string, unknown> & {
    rows?: { handle: string; rank: number }[];
    me?: unknown;
    entry?: { points: number; season?: string };
    nonce?: string;
    unit?: string;
    error?: string;
  };
}

type Req = Parameters<typeof handler>[0];
type Res = Parameters<typeof handler>[1];
/** Un uuid válido, del estilo que devuelve `start_game_run`. */
const NONCE = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

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
      payload: undefined as unknown,
      setHeader(name: string, value: string) {
        this.headers[name] = value;
        return this;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.payload = payload;
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

describe("validación de una partida", () => {
  it("acepta los tres juegos y calcula los puntos en el servidor", () => {
    const impulse = validateSubmission({ game: "impulse", score: 340, nonce: NONCE });
    expect(impulse).toEqual({ game: "impulse", score: 340, points: 340, daily: null, nonce: NONCE });

    const memory = validateSubmission({ game: "memory", score: 3, nonce: NONCE });
    expect("error" in memory).toBe(false);
    if (!("error" in memory)) expect(memory.points).toBe(120);

    const reactor = validateSubmission({ game: "reactor", score: 780, nonce: NONCE });
    expect("error" in reactor).toBe(false);
    if (!("error" in reactor)) expect(reactor.points).toBe(780);
  });

  it("rechaza un juego inventado y una marca que no es número", () => {
    expect(validateSubmission({ game: "tetris", score: 10, nonce: NONCE })).toEqual({
      error: "game debe ser uno de: impulse, memory, reactor",
    });
    expect(validateSubmission({ game: "impulse", score: "10", nonce: NONCE })).toEqual({
      error: "score debe ser un número",
    });
    expect(validateSubmission(null)).toEqual({ error: "game debe ser uno de: impulse, memory, reactor" });
  });

  it("sin nonce no hay partida: es el paso previo obligatorio", () => {
    const missing = validateSubmission({ game: "impulse", score: 10 });
    expect("error" in missing).toBe(true);
    if ("error" in missing) expect(missing.error).toContain("nonce");
    const invented = validateSubmission({ game: "impulse", score: 10, nonce: "no-es-un-nonce" });
    expect("error" in invented).toBe(true);
    expect(isNonce(NONCE)).toBe(true);
    expect(isNonce("123")).toBe(false);
    expect(isNonce(undefined)).toBe(false);
  });

  it("recorta la marca al techo real de cada juego", () => {
    expect(clampScore("impulse", 10_000_000)).toBe(MAX_SCORE.impulse);
    expect(clampScore("memory", 99)).toBe(MAX_SCORE.memory);
    expect(clampScore("reactor", -10)).toBe(0);
    expect(clampScore("reactor", 12.6)).toBe(13);
    expect(isLeagueGame("reactor")).toBe(true);
    expect(isLeagueGame("Reactor")).toBe(false);
  });

  it("los puntos no se pueden inflar desde fuera", () => {
    // La memoria pesa por rondas: 12 rondas no pueden dar 12 puntos, dan 480.
    expect(leaguePoints("memory", 12)).toBe(480);
    expect(leaguePoints("memory", 1e9)).toBeLessThanOrEqual(MAX_SCORE.memory * 40);
    expect(leaguePoints("reactor", 780)).toBe(780);
  });
});

describe("reto del día en el servidor", () => {
  const day = "2026-11-12";

  it("el día y el juego salen del hash, iguales para todos", () => {
    expect(dayKey(new Date(Date.UTC(2026, 10, 12, 23, 59)))).toBe(day);
    expect(dayKey(new Date(Date.UTC(2026, 10, 13, 0, 1)))).toBe("2026-11-13");
    expect(dailyGameFor(day)).toBe(dailyGameFor(day));
    expect(DAILY_ROTATION).toContain(dailyGameFor(day));
  });

  it("acepta el reto del día sólo si es hoy y del juego que toca", () => {
    const now = new Date(Date.UTC(2026, 10, 12, 10, 0));
    const game = dailyGameFor(day);
    const ok = validateSubmission({ game, score: 5, nonce: NONCE, daily: day }, now);
    expect("error" in ok).toBe(false);
    if (!("error" in ok)) expect(ok.daily).toBe(day);

    // El mismo día, otro juego: no es el reto.
    const other = DAILY_ROTATION.find((entry) => entry !== game) ?? "impulse";
    const wrongGame = validateSubmission({ game: other, score: 5, nonce: NONCE, daily: day }, now);
    expect("error" in wrongGame).toBe(true);
    if ("error" in wrongGame) expect(wrongGame.error).toContain(game);

    // Firmar el reto de ayer para hoy tampoco cuela.
    const yesterday = validateSubmission(
      { game, score: 5, nonce: NONCE, daily: "2026-11-11" },
      now,
    );
    expect("error" in yesterday).toBe(true);
    if ("error" in yesterday) expect(yesterday.error).toContain(day);
  });
});

describe("temporada y nombre visible", () => {
  it("la temporada es el mes en UTC", () => {
    expect(seasonOf(new Date(Date.UTC(2026, 10, 7, 23, 59)))).toBe("2026-11");
    expect(seasonOf(new Date(Date.UTC(2026, 0, 1, 0, 0)))).toBe("2026-01");
  });

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
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ message: 'relation "game_season_table" does not exist', code: "42P01" }), {
          status: 400,
        }),
      ),
    );
    try {
      const { status, body } = await call({ query: { season: "2026-11" } });
      expect(status).toBe(503);
      expect(body.error).toBe("league_table_missing");
      expect(isMissingRelation(400, { code: "42P01" })).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("devuelve la tabla con puestos, tu fila y el reto del día", async () => {
    const jwt = token({ sub: "user-1", email: "aitor@alienflow.space" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            { handle: "aitor", points: 900, runs: 4, best: 420, user_id: "user-1", last_played: "2026-11-07T10:00:00Z" },
            { handle: "nova", points: 1200, runs: 2, best: 700, user_id: "user-2", last_played: null },
          ]),
          { status: 200 },
        ),
      ),
    );
    try {
      const { status, body } = await call({ query: { season: "2026-11", limit: "10" }, auth: jwt });
      expect(status).toBe(200);
      expect(body.rows?.map((row) => row.handle)).toEqual(["aitor", "nova"]);
      expect(body.rows?.[0].rank).toBe(1);
      expect(body.me).toMatchObject({ rank: 1, points: 900 });
      expect(body.signedIn).toBe(true);
      // El reto lo publica el servidor: el cliente no lo elige.
      expect(body).toMatchObject({ daily: { id: dayKey(), game: dailyGameFor(dayKey()) } });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("sin sesión la tabla es pública pero no hay fila propia", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })));
    try {
      const { body } = await call({ query: {} });
      expect(body.signedIn).toBe(false);
      expect(body.me).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("puntuar sin token es 401", async () => {
    const { status, body } = await call({ method: "POST", body: { game: "impulse", score: 10, nonce: NONCE } });
    expect(status).toBe(401);
    expect(body.error).toBe("unauthorized");
  });

  it("pedir nonce lo emite con su caducidad", async () => {
    const jwt = token({ sub: "user-1" });
    let asked: Record<string, unknown> | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        asked = JSON.parse(String(init.body));
        return new Response(JSON.stringify([{ nonce: NONCE, expires_at: "2026-11-12T14:20:00Z" }]), {
          status: 201,
        });
      }),
    );
    try {
      const { status, body } = await call({ method: "POST", auth: jwt, body: { action: "start", game: "reactor" } });
      expect(status).toBe(201);
      expect(body.nonce).toBe(NONCE);
      expect(asked).toEqual({ p_game: "reactor" });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("una marca sin nonce no llega a la base", async () => {
    const jwt = token({ sub: "user-1" });
    const spy = vi.fn(async () => new Response("true", { status: 200 }));
    vi.stubGlobal("fetch", spy);
    try {
      const { status } = await call({ method: "POST", auth: jwt, body: { game: "impulse", score: 10 } });
      expect(status).toBe(400);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("guarda la partida en UNA sola llamada a record_game_run", async () => {
    const jwt = token({ sub: "user-1", user_metadata: { full_name: "Aitor" } });
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url: String(url), body: JSON.parse(String(init.body)) });
        return new Response(
          JSON.stringify([
            { id: "row-1", game: "memory", score: 3, points: 480, daily: null, season: seasonOf() },
          ]),
          { status: 201 },
        );
      }),
    );
    try {
      const { status, body } = await call({ method: "POST", auth: jwt, body: { game: "memory", score: 3, nonce: NONCE } });
      expect(status).toBe(201);
      // Ni consume ni insert por separado: una sola puerta.
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toContain("rpc/record_game_run");
      expect(calls[0].body).toEqual({
        p_nonce: NONCE,
        p_game: "memory",
        p_score: 3,
        p_daily: null,
        p_handle: "Aitor",
      });
      // Los puntos que cuentan son los de la base, no los que calculó la ruta.
      expect(body.entry?.points).toBe(480);
      expect(body.entry?.season).toBe(seasonOf());
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("un nonce ya gastado es 409 y no escribe nada", async () => {
    const jwt = token({ sub: "user-1" });
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return new Response(JSON.stringify({ code: "23514", message: "nonce_invalid" }), { status: 400 });
      }),
    );
    try {
      const { status, body } = await call({
        method: "POST",
        auth: jwt,
        body: { game: "impulse", score: 10, nonce: NONCE },
      });
      expect(status).toBe(409);
      expect(body.error).toBe("nonce_invalid");
      expect(calls).toBe(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("un nonce de otro juego también es 409", async () => {
    const jwt = token({ sub: "user-1" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ code: "23514", message: "unknown_run_nonce" }), { status: 400 }),
      ),
    );
    try {
      const { status } = await call({
        method: "POST",
        auth: jwt,
        body: { game: "reactor", score: 10, nonce: NONCE },
      });
      expect(status).toBe(409);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("los puntos que no cuadran son 409, no un 502", async () => {
    const jwt = token({ sub: "user-1" });
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return new Response(JSON.stringify({ code: "23514", message: "points_mismatch" }), { status: 400 });
      }),
    );
    try {
      const { status, body } = await call({
        method: "POST",
        auth: jwt,
        body: { game: "memory", score: 3, nonce: NONCE },
      });
      // El trigger de la #85 rechaza la fila y el nonce ya está gastado: 409
      // con salida concreta, no el 502 genérico de league_write_failed.
      expect(status).toBe(409);
      expect(body.error).toBe("points_mismatch");
      expect(String(body.hint)).toContain("nonce");
      expect(calls).toBe(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("el tope diario del trigger llega como 429 con su límite", async () => {
    const jwt = token({ sub: "user-1" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ code: "53400", message: "daily_run_cap" }), { status: 400 }),
      ),
    );
    try {
      const { status, body } = await call({
        method: "POST",
        auth: jwt,
        body: { game: "impulse", score: 10, nonce: NONCE },
      });
      expect(status).toBe(429);
      expect(body).toMatchObject({ error: "daily_cap", unit: "runs", limit: DAILY_RUN_CAP });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("si falta la RPC, 503 con el nombre de la migración", async () => {
    const jwt = token({ sub: "user-1" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ code: "42883", message: "function public.record_game_run does not exist" }), {
          status: 404,
        }),
      ),
    );
    try {
      const { status, body } = await call({
        method: "POST",
        auth: jwt,
        body: { game: "impulse", score: 10, nonce: NONCE },
      });
      expect(status).toBe(503);
      expect(String(body.hint)).toContain("20261113120000");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("un método que no existe no rompe: 405", async () => {
    const { status } = await call({ method: "DELETE" });
    expect(status).toBe(405);
  });
});
