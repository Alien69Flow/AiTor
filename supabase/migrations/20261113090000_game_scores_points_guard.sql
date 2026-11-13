-- Portero de `game_scores`, segunda pasada: los puntos los calcula la base.
--
-- El hueco que cierra: la politica `players insert their own runs` (migracion
-- 20261107210000) permite escribir la fila propia por PostgREST sin pasar por
-- `/api/league`. El trigger de la migracion antifraude comprobaba el nonce y
-- los topes diarios, pero se creia los `points` que llegaban en la fila: con
-- un nonce gastado se podian declarar 100 000 puntos por partida sin jugar.
--
-- Aqui los puntos se derivan de `game` y `score` con la misma tabla que
-- `api/league.ts` (`LEAGUE_POINTS` + `MAX_SCORE`) y que
-- `src/lib/games-hub.ts` (`HUB_POINTS_PER_GAME`):
--   impulse  -> la marca tal cual, techo 20 000
--   memory   -> la marca (rondas) x 40, techo 12 rondas -> 480
--   reactor  -> la marca tal cual, techo 2 000
-- Si la fila trae otros puntos, no entra. No recorta a nadie que juegue de
-- verdad: la API ya calculaba exactamente esto desde la #84.
--
-- Tambien exige que `daily` sea hoy en UTC, que es lo que valida el servidor:
-- por la puerta directa no se puede firmar el reto de ayer para hoy.
--
-- Idempotente: `create or replace` sobre la funcion y el trigger recreado,
-- igual que en la migracion anterior.

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

  -- Los puntos no vienen del cliente: se recalculan aqui.
  v_expected := case new.game
    when 'memory' then least(greatest(new.score, 0), 12) * 40
    when 'impulse' then least(greatest(new.score, 0), 20000)
    else least(greatest(new.score, 0), 2000)
  end;

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

drop trigger if exists game_scores_guard on public.game_scores;
create trigger game_scores_guard
  before insert on public.game_scores
  for each row execute function public.game_scores_guard();
