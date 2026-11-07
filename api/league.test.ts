import { describe, expect, it, vi } from "vitest";
import handler, {
  MAX_SCORE,
  clampScore,
  decodeClaims,
  handleFromClaims,
  isLeagueGame,
  isMissingRelation,
  leaguePoints,
  seasonOf,
  validateSubmission,
} from "./league";

/**
 * La liga del servidor es la primera cosa de la pestaña de juegos que decide
 * algo con datos de otros: temporada, puntos y nombre visible. Lo que se fija
 * aquí son las dos reglas que el navegador no puede saltarse (temporada y
 * puntos los pone el servidor) y que un fallo de base de datos se cuenta como
 * tal, no como una tabla vacía.
 */

interface Result {
  status: number;
  body: Record<string, unknown> & { rows?: { handle: string; rank: number }[]; me?: unknown; entry?: { points: number } };
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
    const impulse = validateSubmission({ game: "impulse", score: 340 });
    expect(impulse).toEqual({ game: "impulse", score: 340, points: 340, daily: null });

    const memory = validateSubmission({ game: "memory", score: 3 });
    expect("error" in memory).toBe(false);
    if (!("error" in memory)) expect(memory.points).toBe(120);

    const reactor = validateSubmission({ game: "reactor", score: 780, daily: "2026-11-07" });
    expect("error" in reactor).toBe(false);
    if (!("error" in reactor)) {
      expect(reactor.points).toBe(780);
      expect(reactor.daily).toBe("2026-11-07");
    }
  });

  it("rechaza un juego inventado y una marca que no es número", () => {
    expect(validateSubmission({ game: "tetris", score: 10 })).toEqual({
      error: "game debe ser uno de: impulse, memory, reactor",
    });
    expect(validateSubmission({ game: "impulse", score: "10" })).toEqual({
      error: "score debe ser un número",
    });
    expect(validateSubmission(null)).toEqual({
      error: "game debe ser uno de: impulse, memory, reactor",
    });
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

  it("devuelve la tabla con puestos y tu fila", async () => {
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
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("sin sesión la tabla es pública pero no hay fila propia", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })),
    );
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

  it("una marca válida se inserta con los puntos del servidor y la temporada del servidor", async () => {
    const jwt = token({ sub: "user-1", user_metadata: { full_name: "Aitor" } });
    let sent: Record<string, unknown> | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        sent = JSON.parse(String(init.body));
        return new Response(JSON.stringify([{ id: "row-1" }]), { status: 201 });
      }),
    );
    try {
      const { status, body } = await call({
        method: "POST",
        auth: jwt,
        body: { game: "memory", score: 3, daily: "2026-11-07" },
      });
      expect(status).toBe(201);
      expect(body.entry.points).toBe(120);
      expect(sent).toMatchObject({
        user_id: "user-1",
        handle: "Aitor",
        game: "memory",
        score: 3,
        points: 120,
        season: seasonOf(),
        daily: "2026-11-07",
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("un método que no existe no rompe: 405", async () => {
    const { status } = await call({ method: "DELETE" });
    expect(status).toBe(405);
  });
});
