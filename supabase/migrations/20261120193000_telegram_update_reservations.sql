-- Reserva por `update_id` cuando no hay Redis.
--
-- Telegram reintenta una entrega cuando el webhook tarda o cuando la respuesta
-- le parece un fallo. La reserva hace que solo la primera entrega se procese:
-- sin ella el usuario recibe dos respuestas, se paga dos veces al modelo y el
-- turno del hilo queda duplicado.
--
-- Es la misma idea que `SET ... NX EX 600` de Redis, con Postgres como respaldo:
-- clave unica (`update_id`) y caducidad explicita (`expires_at`), porque aqui no
-- hay TTL nativo. Una fila caducada se vuelve a reclamar en el mismo INSERT; no
-- hace falta borrarla antes.

create table if not exists public.telegram_update_reservations (
  update_id  bigint primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Para el barrido de caducadas.
create index if not exists telegram_update_reservations_expiry
  on public.telegram_update_reservations (expires_at);

-- Nadie entra sin service role: escribir aqui es decidir que mensajes se
-- contestan, y la clave anon viaja en el bundle del navegador.
alter table public.telegram_update_reservations enable row level security;
revoke all on public.telegram_update_reservations from anon, authenticated;

-- `true` = la entrega es nueva (o su reserva ya habia caducado) y hay que
-- procesarla. `false` = otra entrega del mismo update la tiene ahora mismo.
--
-- El `where` del `on conflict` es lo que lo hace atomico en un solo viaje: el
-- INSERT devuelve fila cuando inserta o cuando la reserva existente ya caduco.
-- Dos reintentos simultaneos no pueden ganar los dos, porque el segundo choca
-- contra la clave primaria.
create or replace function public.reserve_telegram_update(
  p_update_id bigint,
  p_ttl_seconds integer default 600
)
returns boolean
language sql
security definer
set search_path = public
as $$
  with claimed as (
    insert into public.telegram_update_reservations (update_id, expires_at)
    values (
      p_update_id,
      now() + make_interval(secs => greatest(1, least(coalesce(p_ttl_seconds, 600), 86400)))
    )
    on conflict (update_id) do update
      set expires_at = excluded.expires_at,
          created_at = now()
      where public.telegram_update_reservations.expires_at <= now()
    returning 1
  )
  select exists (select 1 from claimed);
$$;

-- Por defecto toda funcion es ejecutable por `public`: sin este revoke, la
-- clave anon podria reservar updates ajenos y silenciar mensajes.
revoke all on function public.reserve_telegram_update(bigint, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_telegram_update(bigint, integer)
  to service_role;

-- Retencion: una reserva caducada no se consulta nunca mas.
create or replace function public.prune_telegram_update_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted integer;
begin
  with gone as (
    delete from public.telegram_update_reservations where expires_at <= now()
    returning 1
  )
  select count(*) into deleted from gone;
  return deleted;
end;
$$;

revoke all on function public.prune_telegram_update_reservations()
  from public, anon, authenticated;
grant execute on function public.prune_telegram_update_reservations()
  to service_role;

-- Para programarlo hace falta pg_cron (Supabase -> Database -> Extensions):
--   select cron.schedule('prune-telegram-updates', '27 4 * * *',
--                        'select public.prune_telegram_update_reservations()');
