-- Un solo baremo para la liga: `public.league_score`.
--
-- El calculo estaba duplicado en dos sitios que no se despliegan a la vez:
--
--   · `game_scores_guard` (20261113090000) recalculaba los puntos esperados
--     para compararlos con la fila que llega;
--   · `record_game_run` (20261113120000) recortaba la marca y calculaba los
--     puntos que iba a escribir.
--
-- Dos copias de la misma tabla es una desincronizacion esperando a pasar: si
-- alguien sube el techo de `impulse` en una y no en la otra, la RPC escribe
-- puntos que el trigger rechaza y el jugador ve un 409 por una partida que
-- jugo bien. Aqui vive el baremo una sola vez.
--
-- No cambia comportamiento: el trigger sigue sin reescribir `new.score` (eso
-- es una decision aparte, con su asercion en supabase/tests) y la RPC sigue
-- recortando la marca antes de insertar.

-- 1. El baremo, en un sitio.
--    Devuelve la marca ya recortada y los puntos que le corresponden.
create or replace function public.league_score(p_game text, p_score integer)
returns table (score integer, points integer)
language sql
immutable
parallel safe
as $$
  select capped.score,
         case p_game
           when 'memory' then capped.score * 40
           else capped.score
         end as points
    from (
      select least(
               greatest(coalesce(p_score, 0), 0),
               case p_game
                 when 'impulse' then 20000
                 when 'memory' then 12
                 else 2000
               end
             ) as score
    ) as capped;
$$;

comment on function public.league_score(text, integer) is
  'Baremo de la liga: marca recortada al techo del juego y puntos. Unico sitio donde vive la tabla; lo usan game_scores_guard y record_game_run.';

-- 2. El trigger deja de tener su copia: pide los puntos esperados al baremo.
create or replace function public.game_scores_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_runs integer;
  v_points bigint;
  v_expected integer;
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

  -- Los puntos no vienen del cliente: salen del baremo.
  select ls.points into v_expected
    from public.league_score(new.game, new.score) as ls;

  if new.points <> v_expected then
    raise exception 'points_mismatch' using errcode = '23514';
  end if;

  if new.daily is not null and new.daily <> (now() at time zone 'utc')::date then
    raise exception 'daily_not_today' using errcode = '23514';
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

-- Idempotente: si 20261113090000 aun no se aplico, esto deja el trigger puesto.
drop trigger if exists game_scores_guard on public.game_scores;
create trigger game_scores_guard
  before insert on public.game_scores
  for each row execute function public.game_scores_guard();

-- 3. La RPC usa el mismo baremo para recortar y para pagar.
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

  -- Mismo baremo que el trigger: marca recortada y puntos.
  select ls.score, ls.points into v_score, v_points
    from public.league_score(p_game, p_score) as ls;

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

-- `create or replace` conserva los permisos, pero se repiten para que este
-- fichero deje el estado correcto aunque se aplique sobre una base a medias.
revoke all on function public.record_game_run(uuid, text, integer, date, text) from public, anon;
grant execute on function public.record_game_run(uuid, text, integer, date, text) to authenticated;

-- El baremo no es una herramienta del cliente: solo lo llaman funciones que
-- corren como dueno. No se concede a `authenticated`.
revoke all on function public.league_score(text, integer) from public, anon, authenticated;
