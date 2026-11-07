-- Liga real de la pestaña de juegos.
--
-- Una fila por partida. La temporada es el mes en UTC (`YYYY-MM`) y se escribe
-- desde el servidor, no desde el navegador: si la mandara el cliente, cualquiera
-- podría puntuar en la temporada que quisiera.
--
-- Los puntos también los calcula el servidor (`api/league.ts`): lo único que
-- llega del navegador es el juego y la marca.

create table if not exists public.game_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Nombre visible congelado en la partida: las tablas antiguas no cambian de
  -- nombre si el jugador se lo cambia después.
  handle text not null check (char_length(handle) between 1 and 32),
  game text not null check (game in ('impulse', 'memory', 'reactor')),
  score integer not null check (score >= 0 and score <= 100000),
  points integer not null check (points >= 0 and points <= 100000),
  season text not null check (season ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  -- Reto diario completado, si la partida era la del día.
  daily date,
  created_at timestamptz not null default now()
);

create index if not exists game_scores_season_points_idx
  on public.game_scores (season, points desc);
create index if not exists game_scores_user_season_idx
  on public.game_scores (user_id, season);

alter table public.game_scores enable row level security;

-- La tabla de la temporada es pública: es una clasificación, no un dato privado.
drop policy if exists "game scores are public" on public.game_scores;
create policy "game scores are public"
  on public.game_scores for select
  using (true);

-- Se inserta sólo en nombre propio. Sin update ni delete: una partida no se
-- reescribe una vez jugada, que es lo que hace creíble una clasificación.
drop policy if exists "players insert their own runs" on public.game_scores;
create policy "players insert their own runs"
  on public.game_scores for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Tabla agregada por temporada y jugador: es lo que lee la pestaña.
create or replace view public.game_season_table
  with (security_invoker = true) as
select
  season,
  user_id,
  max(handle) as handle,
  sum(points)::int as points,
  count(*)::int as runs,
  max(score)::int as best,
  max(created_at) as last_played
from public.game_scores
group by season, user_id;

grant select on public.game_season_table to anon, authenticated;
