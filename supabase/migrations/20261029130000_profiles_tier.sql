-- Perfil por usuario con plan de acceso.
--
-- `tier` es la única columna que decide qué herramientas MCP y qué capas del
-- globo ve una cuenta. Por eso no la escribe el usuario: la política RLS le
-- deja editar su fila, pero el GRANT por columnas le niega `tier`, así que un
-- `PATCH /profiles` con `{"tier":"dao"}` responde 403 en vez de ascenderse.
-- Los planes de pago los pone el servidor (service_role) cuando el pago o el
-- holding se verifican, como ya hacen `verify-crypto-payment` y
-- `verify-dao-holdings`.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  tier text not null default 'free' check (tier in ('free', 'pro', 'dao')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Perfil y plan de cada cuenta. `tier` sólo lo escribe el servidor.';
comment on column public.profiles.tier is
  'free (por defecto) | pro | dao. Reservado a service_role y a los verificadores de pago/holding.';

create index if not exists profiles_tier_idx on public.profiles (tier);

alter table public.profiles enable row level security;

drop policy if exists "profiles: leer la propia" on public.profiles;
create policy "profiles: leer la propia"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles: editar la propia" on public.profiles;
create policy "profiles: editar la propia"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Sin INSERT para `authenticated`: la fila la crea el trigger del registro. Si
-- se permitiera, cualquiera podría insertarse un perfil con tier 'dao'.
grant select on public.profiles to authenticated;

-- Se retira el UPDATE de tabla y se concede sólo por columnas: `tier` queda
-- fuera por construcción, no por confianza en el cliente.
revoke update on public.profiles from anon, authenticated;
grant update (display_name, avatar_url, updated_at) on public.profiles to authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Toda cuenta nueva nace con perfil `free`, sin depender de que el frontend se
-- acuerde de insertarlo.
create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_profile();

-- Perfiles de las cuentas que ya existían cuando se creó la tabla.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
