-- Alertas del bot cuando no hay Redis (preparada, NO aplicada todavía).
--
-- Mismo patrón que `20261120193000_telegram_update_reservations.sql`:
--   · tabla con caducidad explícita (`expires_at`), porque Postgres no tiene TTL;
--   · RPC `security definer` que hace el tope y la limpieza en un solo viaje;
--   · tabla y funciones cerradas a `anon`/`authenticated`, abiertas sólo a
--     `service_role`, porque la clave anon viaja en el bundle del navegador y
--     aquí se guarda el id del chat y lo que se le va a avisar.
--
-- El tope de 10 por chat y la caducidad de 30 días son los mismos números que
-- `MAX_ALERTS_PER_CHAT` y `ALERTS_TTL_SECONDS` de `api/_shared/alerts.ts`; si se
-- cambian allí, se cambian aquí. Los defaults de la RPC son sólo el respaldo
-- del servidor: el módulo manda los dos valores explícitos.
--
-- Para aplicarla: `supabase db push` desde una máquina autenticada. No se
-- ejecuta desde la CI ni desde el despliegue.

create table if not exists public.telegram_alerts (
  id         uuid primary key default gen_random_uuid(),
  chat_id    bigint not null,
  kind       text not null check (kind in ('price', 'move', 'quake', 'gdelt')),
  payload    jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- Las dos consultas reales: «las de este chat» y «lo caducado».
create index if not exists telegram_alerts_chat_expiry
  on public.telegram_alerts (chat_id, expires_at);
create index if not exists telegram_alerts_expiry
  on public.telegram_alerts (expires_at);

-- Nadie entra sin service role: leer esta tabla es ver a quién avisa el bot y
-- escribir es decidir qué avisos se disparan.
alter table public.telegram_alerts enable row level security;
revoke all on public.telegram_alerts from anon, authenticated;

-- Alta con tope y caducidad en una transacción.
--
-- El `pg_advisory_xact_lock` por chat es lo que hace el tope real: sin él, dos
-- altas simultáneas leerían 9 las dos y dejarían 11. Se toma por chat, no
-- global, para que dos usuarios distintos no se esperen.
--
-- Devuelve jsonb y no un booleano porque hay tres respuestas que el módulo
-- tiene que distinguir: alta (`ok: true` con el id y el total), tope alcanzado
-- (`reason: "limit"`) y alerta inválida (`reason: "invalid"`).
create or replace function public.add_telegram_alert(
  p_chat_id bigint,
  p_alert jsonb,
  p_max integer default 10,
  p_ttl_seconds integer default 2592000
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind  text := coalesce(p_alert ->> 'kind', '');
  v_max   integer := greatest(1, least(coalesce(p_max, 10), 100));
  v_ttl   integer := greatest(60, least(coalesce(p_ttl_seconds, 2592000), 31536000));
  v_count integer;
  v_id    uuid;
begin
  if p_chat_id is null or v_kind not in ('price', 'move', 'quake', 'gdelt') then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  perform pg_advisory_xact_lock(hashtext('telegram_alerts:' || p_chat_id::text));

  -- Limpieza perezosa: el tope cuenta avisos vivos, no historia.
  delete from public.telegram_alerts
   where chat_id = p_chat_id and expires_at <= now();

  select count(*) into v_count
    from public.telegram_alerts
   where chat_id = p_chat_id;

  if v_count >= v_max then
    return jsonb_build_object('ok', false, 'reason', 'limit', 'count', v_count);
  end if;

  insert into public.telegram_alerts (chat_id, kind, payload, expires_at)
  values (p_chat_id, v_kind, p_alert, now() + make_interval(secs => v_ttl))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'count', v_count + 1);
end;
$$;

-- Lectura de un chat: sólo las vivas, y el payload tal cual se guardó.
create or replace function public.list_telegram_alerts(p_chat_id bigint)
returns setof public.telegram_alerts
language sql
security definer
set search_path = public
as $$
  select *
    from public.telegram_alerts
   where chat_id = p_chat_id and expires_at > now()
   order by created_at;
$$;

-- Borrado: con `p_id` quita una, sin él vacía el chat (`/alerta borra`).
-- Devuelve cuántas borró para poder decir «no había ninguna».
create or replace function public.delete_telegram_alert(
  p_chat_id bigint,
  p_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted integer;
begin
  with gone as (
    delete from public.telegram_alerts
     where chat_id = p_chat_id
       and (p_id is null or id = p_id)
    returning 1
  )
  select count(*) into deleted from gone;
  return deleted;
end;
$$;

-- Por defecto toda función es ejecutable por `public`: sin estos revoke, la
-- clave anon podría crear avisos a nombre de cualquier chat.
revoke all on function public.add_telegram_alert(bigint, jsonb, integer, integer)
  from public, anon, authenticated;
revoke all on function public.list_telegram_alerts(bigint)
  from public, anon, authenticated;
revoke all on function public.delete_telegram_alert(bigint, uuid)
  from public, anon, authenticated;
grant execute on function public.add_telegram_alert(bigint, jsonb, integer, integer)
  to service_role;
grant execute on function public.list_telegram_alerts(bigint)
  to service_role;
grant execute on function public.delete_telegram_alert(bigint, uuid)
  to service_role;

-- Retención: una alerta caducada no se consulta nunca más.
create or replace function public.prune_telegram_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted integer;
begin
  with gone as (
    delete from public.telegram_alerts where expires_at <= now()
    returning 1
  )
  select count(*) into deleted from gone;
  return deleted;
end;
$$;

revoke all on function public.prune_telegram_alerts()
  from public, anon, authenticated;
grant execute on function public.prune_telegram_alerts()
  to service_role;

-- Para programarlo hace falta pg_cron (Supabase -> Database -> Extensions):
--   select cron.schedule('prune-telegram-alerts', '37 4 * * *',
--                        'select public.prune_telegram_alerts()');
