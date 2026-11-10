/**
 * Testigo de partida para la liga.
 *
 * Sin esto, `POST /api/league` aceptaba cualquier marca del navegador: un
 * script podía enviar cuarenta partidas perfectas seguidas y la clasificación
 * lo creía. El testigo se pide **antes** de jugar, caduca en dos horas y sólo
 * vale una vez, así que sube el coste del farmeo y deja rastro de cuántas
 * partidas se abren por día.
 *
 * No convierte la marca en una prueba criptográfica —el motor corre en el
 * navegador— pero sí cierra la puerta a mandar puntuaciones en bucle: cada
 * partida enviada consume un testigo que alguien tuvo que abrir antes.
 */
create table if not exists public.league_run_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  game text not null check (game in ('impulse', 'memory', 'reactor')),
  season text not null check (season ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  -- Reto del día al que pertenece la partida, calculado por el servidor.
  daily date not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists league_run_tokens_user_day_idx
  on public.league_run_tokens (user_id, created_at desc);
create index if not exists league_run_tokens_open_idx
  on public.league_run_tokens (user_id, game)
  where used_at is null;

alter table public.league_run_tokens enable row level security;

-- Abrir el testigo propio, leerlo y cerrarlo: nada más.
drop policy if exists "league tokens: abrir el propio" on public.league_run_tokens;
create policy "league tokens: abrir el propio"
  on public.league_run_tokens for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "league tokens: leer los propios" on public.league_run_tokens;
create policy "league tokens: leer los propios"
  on public.league_run_tokens for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- `with check (used_at is not null)` impide el truco evidente: volver a poner
-- el testigo a null para reutilizarlo.
drop policy if exists "league tokens: cerrar el propio" on public.league_run_tokens;
create policy "league tokens: cerrar el propio"
  on public.league_run_tokens for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and used_at is not null);

-- Por columnas: el cliente sólo puede escribir `used_at`, no alargar la
-- caducidad ni cambiar el juego de un testigo ya emitido.
revoke update on public.league_run_tokens from anon, authenticated;
grant update (used_at) on public.league_run_tokens to authenticated;

comment on table public.league_run_tokens is
  'Testigos de partida de la liga: uno por partida, de un solo uso y con caducidad.';
