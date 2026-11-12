-- Antifraude de la liga: nonce por partida, tope diario y reto del día.
--
-- El agujero que cierra: `POST /api/league` aceptaba una partida con sólo el
-- juego y la marca. El servidor ya calculaba puntos y temporada, pero nada
-- impedía reenviar la misma marca mil veces ni inventarse el reto del día.
--
-- Se cierra por tres lados, y los tres viven aquí, no en el navegador:
--
--  1. `game_runs` guarda un nonce de un solo uso por partida. Se emite con
--     `start_game_run` y se gasta con `consume_game_run`; sin nonce gastado no
--     hay inserción. El índice único de `game_scores.run_nonce` impide que un
--     mismo nonce autorice dos filas.
--  2. El trigger `game_scores_guard` corta el día: 60 partidas y 100 000
--     puntos por jugador y día UTC. Es el techo de una sesión real, no una
--     regla de juego: no recorta a nadie que juegue de verdad.
--  3. El reto del día lo decide `api/league.ts` comparando fecha y juego
--     contra la rotación; la base sólo acepta lo que esa comprobación deja
--     pasar, porque sin nonce no hay fila.
--
-- Las funciones son `security definer` a propósito: la tabla no se lee ni se
-- escribe directamente, sólo a través de ellas, que sí comprueban `auth.uid()`.

create table if not exists public.game_runs (
  nonce uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  game text not null check (game in ('impulse', 'memory', 'reactor')),
  issued_at timestamptz not null default now(),
  -- Diez minutos: una partida larga más el envío. Pasado eso, el nonce caduca
  -- y no autoriza nada.
  expires_at timestamptz not null default now() + interval '10 minutes',
  used_at timestamptz,
  day date not null default ((now() at time zone 'utc')::date)
);

create index if not exists game_runs_user_day_idx
  on public.game_runs (user_id, day);

alter table public.game_runs enable row level security;

-- Ni lectura ni escritura directa: el navegador no necesita hurgar aquí, y si
-- pudiera escribir nonces la barrera no valdría nada.
revoke all on public.game_runs from anon, authenticated;

-- Qué nonce autorizó cada partida.
alter table public.game_scores add column if not exists run_nonce uuid;

-- Segunda barrera contra el reenvío: aunque alguien saltara la función de
-- consumo, el mismo nonce no puede insertar dos filas.
create unique index if not exists game_scores_run_nonce_key
  on public.game_scores (run_nonce)
  where run_nonce is not null;

/**
 * Emite un nonce para una partida del jugador autenticado.
 *
 * El tope de emisiones (200 al día) no está para molestar: sin él, pedir mil
 * nonces y elegir el mejor resultado posible sería gratis.
 */
create or replace function public.start_game_run(p_game text)
returns table (nonce uuid, expires_at timestamptz, day date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_issued integer;
begin
  if v_user is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if p_game not in ('impulse', 'memory', 'reactor') then
    raise exception 'unknown_game' using errcode = '22023';
  end if;

  select count(*) into v_issued
    from public.game_runs r
   where r.user_id = v_user
     and r.day = ((now() at time zone 'utc')::date);

  if v_issued >= 200 then
    raise exception 'daily_nonce_cap' using errcode = '53400';
  end if;

  return query
    insert into public.game_runs as r (user_id, game)
    values (v_user, p_game)
    returning r.nonce, r.expires_at, r.day;
end;
$$;

/**
 * Gasta un nonce: devuelve `true` sólo la primera vez.
 *
 * El `update ... where used_at is null` es lo que hace la operación atómica:
 * dos peticiones simultáneas con el mismo nonce compiten por la misma fila y
 * sólo una se lo lleva.
 */
create or replace function public.consume_game_run(p_nonce uuid, p_game text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_used uuid;
begin
  if v_user is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  update public.game_runs r
     set used_at = now()
   where r.nonce = p_nonce
     and r.user_id = v_user
     and r.game = p_game
     and r.used_at is null
     and r.expires_at > now()
  returning r.nonce into v_used;

  return v_used is not null;
end;
$$;

grant execute on function public.start_game_run(text) to authenticated;
grant execute on function public.consume_game_run(uuid, text) to authenticated;

/**
 * Portero de `game_scores`: exige nonce gastado y corta el día.
 *
 * Vive en la base y no en la función serverless porque una política RLS no
 * puede contar filas vecinas; un trigger sí. Así el tope se cumple aunque la
 * petición llegue por otro camino. Los códigos de error son estables
 * (`23514` para el nonce, `53400` para el tope) porque `api/league.ts` los
 * traduce a respuestas concretas.
 */
create or replace function public.game_scores_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_runs integer;
  v_points bigint;
begin
  if new.run_nonce is null then
    raise exception 'missing_run_nonce' using errcode = '23514';
  end if;

  if not exists (
    select 1
      from public.game_runs r
     where r.nonce = new.run_nonce
       and r.user_id = new.user_id
       and r.game = new.game
       and r.used_at is not null
  ) then
    raise exception 'unknown_run_nonce' using errcode = '23514';
  end if;

  select count(*), coalesce(sum(s.points), 0)
    into v_runs, v_points
    from public.game_scores s
   where s.user_id = new.user_id
     and s.created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc');

  if v_runs >= 60 then
    raise exception 'daily_run_cap' using errcode = '53400';
  end if;

  if v_points + new.points > 100000 then
    raise exception 'daily_points_cap' using errcode = '53400';
  end if;

  return new;
end;
$$;

drop trigger if exists game_scores_guard on public.game_scores;
create trigger game_scores_guard
  before insert on public.game_scores
  for each row execute function public.game_scores_guard();
