-- Libro de pagos on-chain.
--
-- `verify-crypto-payment` ya leía e insertaba en esta tabla, pero ninguna
-- migración la creaba: en un proyecto nuevo el pago se verificaba, el plan se
-- acreditaba y el insert reventaba con 500, sin dejar rastro ni poder detectar
-- una transacción reutilizada.
--
-- El libro es la fuente de verdad y se escribe ANTES de extender el plan:
--   status = 'verified' → pago comprobado on-chain, plan aún no extendido;
--   status = 'granted'  → plan ya extendido, no se puede volver a usar.
-- Así un fallo a mitad se puede reintentar, y un reintento nunca regala otro
-- periodo.

create table if not exists public.crypto_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Siempre en minúsculas: el hash canónico es uno solo.
  tx_hash text not null,
  chain text not null,
  token text not null default 'USDC',
  cycle text not null,
  amount_usd numeric(12, 2) not null check (amount_usd > 0),
  -- Versión de la tarifa aplicada, para poder auditar subidas de precio.
  price_version text,
  wallet_address text,
  recipient text,
  status text not null default 'verified' check (status in ('verified', 'granted')),
  granted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint crypto_payments_hash_lowercase check (tx_hash = lower(tx_hash))
);

-- Una transacción, un pago: lo que hace imposible reutilizar un hash.
create unique index if not exists crypto_payments_tx_hash_key
  on public.crypto_payments (tx_hash);

create index if not exists crypto_payments_user_created_idx
  on public.crypto_payments (user_id, created_at desc);

alter table public.crypto_payments enable row level security;

-- El cliente sólo lee su propio historial; quien escribe es la service role.
drop policy if exists "crypto_payments: ver los propios" on public.crypto_payments;
create policy "crypto_payments: ver los propios"
  on public.crypto_payments
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.crypto_payments is
  'Libro de pagos on-chain verificados. Lo escribe verify-crypto-payment con la service role.';
comment on column public.crypto_payments.status is
  'verified = comprobado sin acreditar (reintentable); granted = plan ya extendido (no reutilizable).';
