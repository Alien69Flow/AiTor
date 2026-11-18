-- Memoria entre sesiones del bot y de la web.
--
-- Por que Postgres y no Redis: Upstash no esta configurado, y esto es dato del
-- usuario que debe sobrevivir a los despliegues y poder borrarse por completo.
--
-- Por que dos tablas: el hilo guarda lo que dura (resumen y actividad) y los
-- turnos lo que se puede tirar sin perder el hilo (el texto crudo). Asi la
-- retencion de 30 dias no se lleva por delante el resumen del usuario.

create table if not exists public.chat_threads (
  id              uuid primary key default gen_random_uuid(),
  surface         text not null check (surface in ('telegram', 'web')),
  external_id     text not null,                 -- chat_id de Telegram o user_id de la web
  summary         text,                          -- <= 600 caracteres, null si aun no toca
  summary_upto    bigint not null default 0,     -- id del ultimo turno ya resumido
  last_active_at  timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (surface, external_id)
);

create table if not exists public.chat_turns (
  id          bigint generated always as identity primary key,
  thread_id   uuid not null references public.chat_threads(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null check (char_length(content) between 1 and 8000),
  created_at  timestamptz not null default now()
);

-- La lectura siempre es "los ultimos N turnos de este hilo".
create index if not exists chat_turns_thread_desc on public.chat_turns (thread_id, id desc);
create index if not exists chat_threads_idle on public.chat_threads (last_active_at);

-- Nadie entra sin service role. Estas tablas guardan conversaciones: ni anon ni
-- un usuario autenticado pueden leer las de otro, y no hay politica que lo
-- permita.
alter table public.chat_threads enable row level security;
alter table public.chat_turns enable row level security;
revoke all on public.chat_threads, public.chat_turns from anon, authenticated;

-- Borrado a peticion (comando /reset del bot): se va el hilo y, en cascada,
-- sus turnos.
create or replace function public.clear_chat_thread(p_surface text, p_external_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted integer;
begin
  with gone as (
    delete from public.chat_threads
    where surface = p_surface and external_id = p_external_id
    returning 1
  )
  select count(*) into deleted from gone;
  return deleted;
end;
$$;

-- Retencion: 30 dias sin hablar. El resumen se va con el hilo, que es lo que
-- se le prometio al usuario.
create or replace function public.prune_chat_threads()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted integer;
begin
  with gone as (
    delete from public.chat_threads
    where last_active_at < now() - interval '30 days'
    returning 1
  )
  select count(*) into deleted from gone;
  return deleted;
end;
$$;

-- Para programarlo hace falta pg_cron (Supabase -> Database -> Extensions):
--   select cron.schedule('prune-chat-threads', '17 4 * * *', 'select public.prune_chat_threads()');
