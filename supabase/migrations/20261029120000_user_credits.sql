-- user_credits — la tabla que faltaba.
--
-- Vivía solo en el proyecto original (Lovable) y ninguna migración la creaba:
-- un proyecto nuevo respondía 500 en `verify-crypto-payment` y en
-- `verify-dao-holdings` aunque las funciones estuvieran desplegadas.
--
-- Columnas deducidas de los upserts reales del código, no supuestas:
--   verify-crypto-payment → { user_id, paid_tier: 'basic', used: 0, updated_at }
--   verify-dao-holdings   → { user_id, paid_tier: 'pro' | 'quantum', updated_at }
-- `onConflict: 'user_id'` exige que user_id sea único, y el upsert filtra
-- implícitamente por usuario, así que es la clave primaria.

create table if not exists public.user_credits (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  -- 'basic' | 'pro' | 'quantum' según los upserts; se deja como texto para no
  -- romper si el código añade un nivel nuevo.
  paid_tier  text not null default 'free',
  used       integer not null default 0 check (used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_credits is
  'Créditos y nivel de acceso por usuario. La escriben las Edge Functions con la service role key.';

alter table public.user_credits enable row level security;

-- El cliente no consulta esta tabla hoy (el frontend no usa tablas: solo auth
-- y Edge Functions), pero si algún día muestra el saldo, solo debe ver el suyo.
drop policy if exists "user_credits: lectura del propio saldo" on public.user_credits;
create policy "user_credits: lectura del propio saldo"
  on public.user_credits
  for select
  to authenticated
  using (auth.uid() = user_id);

-- No hay políticas de insert/update/delete a propósito: quien escribe es la
-- service role (que no pasa por RLS). Sin política, un usuario no puede
-- darse créditos a sí mismo.

create index if not exists user_credits_paid_tier_idx
  on public.user_credits (paid_tier);
