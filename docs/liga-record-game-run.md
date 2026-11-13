# Migración `record_game_run`: una sola puerta de escritura en la liga

**Fecha:** 2026-11-13 · **Estado:** implementada en la PR #87 (`fix/liga-record-run`, `a2437a1`), pendiente de revisión y de `supabase db push` · **Ámbito:** esquema + `api/league.ts` + `tests/api/league.test.ts`.

Este documento fija el contrato: qué hace la migración, cómo cambia la ruta, cómo se actualizan las pruebas y en qué orden se despliega. La implementación ya existe en la PR; lo de aquí es la referencia para revisarla y para no improvisar si hay que rehacerla.

## El problema, en una frase

El registro eran **dos viajes**: `rpc/consume_game_run` y después `POST game_scores`. Si el insert fallaba entre medias, el nonce se gastaba y la partida se perdía; y como `consume_game_run` estaba concedida a `authenticated` y la política `players insert their own runs` seguía viva, el cliente podía hacer ambos pasos sin jugar.

La solución no es «un insert más seguro», es **una sola función que hace las dos cosas**: si algo falla, el `raise` revierte también el consumo del nonce. Eso es lo que garantiza que no se queme el nonce ni se pierda la partida.

---

## 1. Migración `supabase/migrations/20261113120000_game_league_record_run.sql`

### 1.1 Permisos: cerrar la tabla

```sql
-- 1. La tabla deja de aceptar escrituras directas.
drop policy if exists "players insert their own runs" on public.game_scores;
revoke insert on public.game_scores from anon, authenticated;

-- 2. El consumo del nonce deja de ser una herramienta del cliente.
revoke all on function public.consume_game_run(uuid, text) from public, anon, authenticated;
```

Comprobación de firma antes de aplicar: la función tiene que existir como `consume_game_run(uuid, text)` (la de `20261112150000`). Si el `revoke` no casa, no falla: simplemente no revoca nada y el agujero sigue abierto. Verificarlo con:

```sql
select p.oid::regprocedure
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'consume_game_run';
```

### 1.2 La RPC

```sql
create or replace function public.record_game_run(
  p_nonce uuid,
  p_game text,
  p_score integer,
  p_daily date,
  p_handle text
)
returns table (id uuid, game text, score integer, points integer, daily date, season text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_score integer;
  v_points integer;
  v_handle text;
  v_season text := to_char((now() at time zone 'utc'), 'YYYY-MM');
  v_id uuid;
begin
  if v_user is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if p_game not in ('impulse', 'memory', 'reactor') then
    raise exception 'unknown_game' using errcode = '22023';
  end if;

  -- Misma tabla que `LEAGUE_POINTS` + `MAX_SCORE` en api/league.ts.
  v_score := least(
    greatest(coalesce(p_score, 0), 0),
    case p_game when 'impulse' then 20000 when 'memory' then 12 else 2000 end
  );
  v_points := case p_game when 'memory' then v_score * 40 else v_score end;

  -- Etiqueta visible: letras, numeros y tres separadores, entre 2 y 32.
  v_handle := left(regexp_replace(coalesce(p_handle, ''), '[^a-zA-Z0-9._-]', '', 'g'), 32);
  if length(v_handle) < 2 then
    v_handle := 'jugador';
  end if;

  -- Consumo: si ya se uso, caduco o no es de este juego, no hay fila.
  if not public.consume_game_run(p_nonce, p_game) then
    raise exception 'nonce_invalid' using errcode = '23514';
  end if;

  insert into public.game_scores as s
    (user_id, handle, game, score, points, season, daily, run_nonce)
  values
    (v_user, v_handle, p_game, v_score, v_points, v_season, p_daily, p_nonce)
  returning s.id into v_id;

  return query
    select s.id, s.game, s.score, s.points, s.daily, s.season
      from public.game_scores s
     where s.id = v_id;
end;
$$;

revoke all on function public.record_game_run(uuid, text, integer, date, text) from public, anon;
grant execute on function public.record_game_run(uuid, text, integer, date, text) to authenticated;
```

### 1.3 Por qué esto no quema el nonce

La función es **una sola sentencia** desde el punto de vista del cliente. `consume_game_run` escribe `used_at`; cualquier `raise` posterior (tope diario, `points_mismatch`, `daily_not_today`, violación de índice) aborta la sentencia y **revierte también ese `used_at`**. Consecuencias, que son el motivo de la migración:

- `daily_run_cap` / `daily_points_cap` → 429 y el nonce **sigue válido** dentro de su TTL de 10 minutos.
- `points_mismatch` → 409 y el nonce **también sigue válido**.
- Solo se gasta cuando la fila entra de verdad.

> Ojo: esto **cambia** el comportamiento anterior y deja desfasados dos textos de la PR: el comentario de la prueba `los puntos que no cuadran son 409` («el nonce ya está gastado») y el `hint` del 409 (`pide un nonce nuevo y vuelve a jugarla`). Ambos deberían decir que la partida no se ha contado y que el nonce se puede reintentar. Es corrección de texto, no de lógica.

### 1.4 Errores y su traducción

| `raise` / error | SQLSTATE | Lo que ve el cliente |
|---|---|---|
| `unauthorized` (sin `auth.uid()`) | `28000` | 401 `unauthorized` |
| `unknown_game` | `22023` | 400 con la lista de juegos |
| `nonce_invalid` | `23514` | 409 `nonce_invalid` |
| `daily_run_cap` (trigger) | `53400` | 429 `daily_cap` `unit: runs` |
| `daily_points_cap` (trigger) | `53400` | 429 `daily_cap` `unit: points` |
| `daily_not_today` (trigger) | `23514` | 400 `daily debe ser el reto de hoy` |
| `points_mismatch` (trigger) | `23514` | 409 `points_mismatch` |
| función ausente | `42883` | 503 con el nombre de la migración |

El trigger `game_scores_guard` sigue enganchado: es la red de seguridad si alguien escribe por otra vía. Los topes diarios siguen viviendo ahí porque una política RLS no puede sumar filas vecinas.

---

## 2. `api/league.ts`: el diff exacto

### 2.1 Lo que no cambia

`GET`, `POST {action:"start"}`, `clampScore`, `leaguePoints`, `validateSubmission`, `dailyGameFor`, `handleFromClaims`, `decodeClaims`, `isMissingRelation` y los topes exportados se quedan igual. El cliente (`GamesTab`) solo mira `response.ok`, así que la pestaña no se toca.

Sí cambia la cabecera del fichero: donde decía que la ruta gasta el nonce en dos viajes, ahora explica que hay una sola puerta y que el consumo ocurre dentro de la RPC.

### 2.2 El helper de errores

Deja de ser solo de nonces y pasa a traducir todo lo que puede devolver la RPC:

```diff
-function nonceFailure(
+function leagueFailure(
   res: VercelResponse,
   result: { ok: boolean; status: number; data: unknown },
-  phase: "start" | "consume",
+  phase: "start" | "record",
+  season?: string,
 ): VercelResponse {
   if (isMissingRelation(result.status, result.data)) {
-    return res.status(503).json({
-      error: "league_table_missing",
-      hint: "Falta aplicar supabase/migrations/20261112150000_game_league_anticheat.sql",
-      phase,
-    });
+    return res.status(503).json({ error: "league_table_missing", hint: MISSING_HINT, phase });
   }
   const text = errorText(result.data);
   if (/daily_nonce_cap/.test(text)) {
     return res.status(429).json({ error: "daily_cap", unit: "nonces", limit: DAILY_NONCE_CAP });
   }
+  if (/daily_run_cap/.test(text)) {
+    return res.status(429).json({ error: "daily_cap", unit: "runs", limit: DAILY_RUN_CAP, season });
+  }
+  if (/daily_points_cap/.test(text)) {
+    return res.status(429).json({ error: "daily_cap", unit: "points", limit: DAILY_POINTS_CAP, season });
+  }
+  if (/daily_not_today/.test(text)) {
+    return res.status(400).json({ error: "daily debe ser el reto de hoy" });
+  }
+  if (/nonce_invalid|unknown_run_nonce|missing_run_nonce/.test(text)) {
+    return res.status(409).json({ error: "nonce_invalid", hint: "…", phase });
+  }
+  if (/points_mismatch/.test(text)) {
+    return res.status(409).json({ error: "points_mismatch", hint: "…", season });
+  }
   if (/unauthorized/.test(text)) {
     return res.status(401).json({ error: "unauthorized", hint: "Inicia sesión para puntuar" });
   }
+  if (/unknown_game/.test(text)) {
+    return res.status(400).json({ error: `game debe ser uno de: ${LEAGUE_GAMES.join(", ")}` });
+  }
-  return res.status(502).json({ error: "league_nonce_failed", phase, status: result.status });
+  return res.status(502).json({
+    error: "league_write_failed",
+    phase,
+    status: result.status,
+    detail: typeof result.data === "string" ? result.data.slice(0, 200) : undefined,
+  });
 }
```

Y una constante nueva, para que el 503 diga **todas** las migraciones que pueden faltar:

```ts
const MISSING_HINT =
  "Falta aplicar supabase/migrations/20261107210000_game_league.sql, la de antifraude " +
  "(20261112150000) y la de record_game_run (20261113120000)";
```

### 2.3 El POST: de dos viajes a uno

Se borra el bloque de consumo + el insert, y en su lugar va una sola llamada:

```diff
-    const consumed = await rest("rpc/consume_game_run", {
-      token,
-      method: "POST",
-      body: JSON.stringify({ p_nonce: submission.nonce, p_game: submission.game }),
-    });
-    if (!consumed.ok) return nonceFailure(res, consumed, "consume");
-    if (consumed.data !== true) {
-      return res.status(409).json({ error: "nonce_invalid", hint: "…" });
-    }
-
-    const season = seasonOf();
-    const inserted = await rest("game_scores", { token, method: "POST", … });
-    if (!inserted.ok) { /* mapa de errores del trigger */ }
+    // Una sola llamada: consume el nonce, recorta la marca, calcula puntos e
+    // inserta, todo en la misma transacción dentro de Postgres.
+    const season = seasonOf();
+    const recorded = await rest("rpc/record_game_run", {
+      token,
+      method: "POST",
+      body: JSON.stringify({
+        p_nonce: submission.nonce,
+        p_game: submission.game,
+        p_score: submission.score,
+        p_daily: submission.daily,
+        p_handle: handleFromClaims(claims),
+      }),
+    });
+    if (!recorded.ok) return leagueFailure(res, recorded, "record", season);
+
+    const stored = (Array.isArray(recorded.data) ? recorded.data[0] : recorded.data) as
+      | Record<string, unknown>
+      | null
+      | undefined;
```

Y la respuesta usa **los puntos que escribió la base**, no los que calculó la ruta:

```diff
       entry: {
         game: submission.game,
         score: submission.score,
-        points: submission.points,
+        points: typeof stored?.points === "number" ? stored.points : submission.points,
         daily: submission.daily,
-        season,
+        season: typeof stored?.season === "string" ? stored.season : season,
       },
```

`submission.points` sigue calculándose en la ruta, pero solo como respaldo si la RPC devuelve algo inesperado; el número que cuenta es el de Postgres. Ahí está la diferencia entre «el servidor valida» y «el servidor decide».

---

## 3. `tests/api/league.test.ts`

### 3.1 Qué se borra

- `gasta el nonce y guarda la fila con los puntos del servidor`: mockeaba **dos** llamadas y comprobaba el cuerpo del insert directo en `game_scores`. Ese camino ya no existe y la prueba desaparece con él.
- El ramal `if (String(url).includes("rpc/consume_game_run"))` de los mocks de tope y de nonce gastado.
- La prueba del 503 por `game_season_table` se queda: el `GET` no cambia.

### 3.2 La prueba que la sustituye

Es la prueba central de la migración: **una sola llamada**, con el cuerpo exacto de la RPC, y los puntos tomados de la respuesta de la base (480, no los 120 que calcula la ruta para 3 rondas).

```ts
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
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("rpc/record_game_run");
    expect(calls[0].body).toEqual({
      p_nonce: NONCE,
      p_game: "memory",
      p_score: 3,
      p_daily: null,
      p_handle: "Aitor",
    });
    expect(body.entry?.points).toBe(480);
    expect(body.entry?.season).toBe(seasonOf());
  } finally {
    vi.unstubAllGlobals();
  }
});
```

### 3.3 Casos de error que hay que cubrir

| Prueba | Mock | Espera |
|---|---|---|
| nonce ya gastado | `{code:"23514", message:"nonce_invalid"}` 400 | 409 `nonce_invalid`, `calls === 1` |
| nonce de otro juego | `unknown_run_nonce` 400 | 409 |
| puntos que no cuadran | `points_mismatch` 400 | 409 `points_mismatch` |
| tope de partidas | `daily_run_cap` 400 | 429 `{unit: "runs", limit: DAILY_RUN_CAP}` |
| falta la función | `42883` + `function public.record_game_run does not exist`, 404 | 503 y el hint contiene `20261113120000` |
| sin token | — | 401 |
| sin nonce | — | 400 sin llamar a `fetch` |

La de `42883` es la que protege el orden de despliegue: si se mergea el código antes de aplicar la migración, la ruta responde 503 con el nombre exacto del fichero que falta, en vez de un 502 mudo.

---

## 4. Orden de despliegue y rollback

Es un par, y el orden importa:

1. `supabase db push --project-ref pnyigikagdxqaogbiift` (aplica `20261113090000` y `20261113120000`).
2. Merge de la PR y despliegue de Vercel.

Estados intermedios, aceptables pero conviene conocerlos:

- **Solo código**: `record_game_run` no existe → 503 `league_table_missing` con el nombre de la migración en cada envío. El juego sigue funcionando; la liga no puntúa.
- **Solo migración**: el insert directo ya no tiene permiso y el código viejo intenta `rpc/consume_game_run`, que ya no puede ejecutar → 502/503. Igual de inofensivo, pero más ruidoso.

No hay pérdida de partidas en ninguno de los dos: el perfil y el historial viven en el navegador (`src/lib/games-hub.ts`) y no dependen de la liga.

**Rollback**: `create policy "players insert their own runs" …` y `grant execute on function public.consume_game_run(uuid, text) to authenticated;` restauran el camino viejo. `drop function public.record_game_run(uuid, text, integer, date, text);` quita la nueva. Con el código nuevo desplegado, el rollback deja la liga en 503; por eso el orden natural es código viejo + base nueva, nunca al revés.

---

## 5. Verificación

### 5.1 En local (necesita Docker)

```bash
supabase start
supabase db reset                 # aplica todas las migraciones
supabase test db                  # pgTAP existente (supabase/tests/)
```

Prueba manual del cierre, con una sesión normal:

```sql
-- 1) el cliente ya no puede escribir: 42501 permission denied
insert into public.game_scores (user_id, handle, game, score, points, season)
values ('<UID>', 'x', 'impulse', 1, 1, to_char(now() at time zone 'utc','YYYY-MM'));

-- 2) el cliente tampoco puede gastar el nonce por su cuenta: 42501
select public.consume_game_run('<NONCE>'::uuid, 'impulse');

-- 3) la RPC sí, y devuelve la fila con los puntos de la base
select * from public.record_game_run('<NONCE>'::uuid, 'memory', 3, null, 'tester');
-- 480 puntos, no 120

-- 4) reutilizar el nonce: 23514 nonce_invalid
```

### 5.2 Lo que falta y conviene añadir

- **pgTAP de `record_game_run`** en `supabase/tests/`: nonce válido, nonce repetido, nonce caducado, `daily_run_cap` y comprobación de que tras un fallo el nonce **sigue** con `used_at is null`. Esto último es la prueba de la garantía transaccional y hoy no existe.
- **El job `supabase test db`** del bloque M de la issue #86: sin él, todo lo anterior sigue siendo manual.

---

## 6. Límites conocidos de esta migración

- `record_game_run` **no impide** que alguien con sesión y un script pida 200 nonces y registre 60 partidas al día con la marca máxima. Cierra el camino directo, no la automatización.
- El `SELECT` sigue siendo público y `game_season_table` expone `user_id` (bloque J de la issue #86).
- El saneado de `handle` está duplicado en TS (máximo 24) y en SQL (máximo 32). Es intencionado —la API no puede fiarse del cliente y la base no puede fiarse de la API—, pero conviene saberlo al tocar uno de los dos.
- Los tests del CI son **advisory** en `main`: hay que mirar el run, no solo el check verde (bloque D).

## Referencias

- Implementación: PR #87, `supabase/migrations/20261113120000_game_league_record_run.sql`, `api/league.ts`, `tests/api/league.test.ts`.
- Base previa: `20261107210000_game_league.sql` (tabla y vista) y `20261112150000_game_league_anticheat.sql` (nonces).
- Trigger que sigue de red: `20261113090000_game_scores_points_guard.sql`.
- Pruebas pgTAP actuales: `supabase/tests/game_scores_guard.sql` (PR #88).
- Issue con el bloque «Siguiente PR acordada»: #86.
