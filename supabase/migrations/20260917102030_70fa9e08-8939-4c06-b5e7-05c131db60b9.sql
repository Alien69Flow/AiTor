-- Libro de pagos on-chain.
--
-- Ojo: esta migracion adelantaba la tabla con `plan public.credit_tier`, un tipo
-- que ninguna migracion del repo crea, asi que en una base limpia abortaba la
-- cadena entera con SQLSTATE 42704 antes de llegar a ninguna prueba. La forma
-- definitiva —la que usa el codigo— es la que fija
-- 20261110120000_crypto_payments.sql (`status`, `cycle`, `token`,
-- `price_version`), asi que la tabla se crea aqui ya con esa forma: una base
-- nueva queda con el esquema bueno y la de noviembre no tiene nada que hacer.
create table if not exists public.crypto_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Siempre en minusculas: el hash canonico es uno solo.
  tx_hash text not null,
  chain text not null,
  token text not null default 'USDC',
  cycle text not null,
  amount_usd numeric(12, 2) not null check (amount_usd > 0),
  -- Version de la tarifa aplicada, para poder auditar subidas de precio.
  price_version text,
  wallet_address text,
  recipient text,
  -- verified = comprobado on-chain sin acreditar (reintentable);
  -- granted  = plan ya extendido (no reutilizable).
  status text not null default 'verified' check (status in ('verified', 'granted')),
  granted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint crypto_payments_hash_lowercase check (tx_hash = lower(tx_hash))
);

-- Una transaccion, un pago: lo que hace imposible reutilizar un hash.
create unique index if not exists crypto_payments_tx_hash_key
  on public.crypto_payments (tx_hash);
create index if not exists crypto_payments_user_created_idx
  on public.crypto_payments (user_id, created_at desc);

alter table public.crypto_payments enable row level security;

-- El cliente solo lee su propio historial; quien escribe es la service role.
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
