-- crypto_payments: de la forma vieja (plan, recipient NOT NULL) a la que usa
-- el código (status, cycle, token, price_version).
--
-- La versión original de 20260917102030 creaba la tabla con `plan` y sin
-- `status`. En una base limpia la tabla ya nace con la forma nueva, pero un
-- proyecto que aplicó aquella versión no la vuelve a ejecutar, y
-- 20261110120000 sólo comprueba que la tabla existe: éste es el camino hacia
-- delante.
--
-- Todo es idempotente: columnas con `if not exists`, backfills que sólo tocan
-- NULLs, y constraints que se crean desde un DO porque `add constraint` no
-- tiene `if not exists`.

-- 1. Columnas nuevas. `cycle` y `token` entran sin NOT NULL; se aprietan al
-- final, cuando ya no queda ningún NULL que lo impida.
alter table public.crypto_payments
  add column if not exists status text,
  add column if not exists cycle text,
  add column if not exists token text,
  add column if not exists price_version text,
  add column if not exists granted_at timestamptz;

-- 2. `plan` y `recipient` dejan de ser obligatorios: el código nuevo no los
-- escribe. `plan` no se borra — queda el histórico de lo que se compró, y su
-- valor no se toca.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'crypto_payments'
       and column_name = 'plan'
  ) then
    execute 'alter table public.crypto_payments alter column plan drop not null';
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'crypto_payments'
       and column_name = 'recipient'
  ) then
    execute 'alter table public.crypto_payments alter column recipient drop not null';
  end if;
end $$;

-- 3. Backfill de las filas viejas. Aquella tabla no tenía estado intermedio: se
-- escribía cuando el plan ya se había extendido, así que cuentan como
-- 'granted' y su fecha de concesión es la de creación. `token` sólo era USDC.
update public.crypto_payments
   set status = 'granted',
       granted_at = created_at
 where status is null;

update public.crypto_payments
   set token = 'USDC'
 where token is null;

-- El hash canónico es uno solo, en minúsculas: si alguna fila vieja lo guardó
-- en mayúsculas se normaliza antes de que el CHECK la rechace. Si dos hashes
-- sólo difirieran en mayúsculas, esto falla, y es lo correcto: hay un duplicado
-- que alguien tiene que mirar.
update public.crypto_payments
   set tx_hash = lower(tx_hash)
 where tx_hash <> lower(tx_hash);

-- 4. Defaults y NOT NULL, ya sin NULLs que estorben. `cycle` sólo se aprieta si
-- no queda ninguno: en la forma vieja no había de dónde deducirlo, y es mejor
-- una columna nullable que un valor inventado.
alter table public.crypto_payments alter column status set default 'verified';
alter table public.crypto_payments alter column token set default 'USDC';

do $$
begin
  if not exists (select 1 from public.crypto_payments where status is null) then
    execute 'alter table public.crypto_payments alter column status set not null';
  end if;

  if not exists (select 1 from public.crypto_payments where token is null) then
    execute 'alter table public.crypto_payments alter column token set not null';
  end if;

  if not exists (select 1 from public.crypto_payments where cycle is null) then
    execute 'alter table public.crypto_payments alter column cycle set not null';
  end if;
end $$;

-- 5. Los CHECK, en un DO: `add constraint` no tiene `IF NOT EXISTS` y los
-- nombres son los que genera la tabla nueva, así que en una base limpia se
-- encuentran y no se duplican.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'crypto_payments_status_check'
       and conrelid = 'public.crypto_payments'::regclass
  ) then
    execute 'alter table public.crypto_payments add constraint crypto_payments_status_check check (status in (''verified'', ''granted''))';
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'crypto_payments_amount_usd_check'
       and conrelid = 'public.crypto_payments'::regclass
  ) then
    execute 'alter table public.crypto_payments add constraint crypto_payments_amount_usd_check check (amount_usd > 0)';
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'crypto_payments_hash_lowercase'
       and conrelid = 'public.crypto_payments'::regclass
  ) then
    execute 'alter table public.crypto_payments add constraint crypto_payments_hash_lowercase check (tx_hash = lower(tx_hash))';
  end if;
end $$;

-- 6. Índice único del hash y RLS. Si la forma vieja trajo el UNIQUE inline, el
-- índice se llama igual y `if not exists` lo deja como está.
create unique index if not exists crypto_payments_tx_hash_key
  on public.crypto_payments (tx_hash);
create index if not exists crypto_payments_user_created_idx
  on public.crypto_payments (user_id, created_at desc);

alter table public.crypto_payments enable row level security;

-- 7. Políticas: la forma vieja tenía tres con otros nombres. Se retiran y queda
-- el juego de la nueva —una lectura propia—, que es el que comprueba pgTAP.
drop policy if exists "Users read own crypto payments" on public.crypto_payments;
drop policy if exists "Service role manages crypto payments" on public.crypto_payments;
drop policy if exists "No client writes to crypto payments" on public.crypto_payments;
drop policy if exists "crypto_payments: ver los propios" on public.crypto_payments;

create policy "crypto_payments: ver los propios"
  on public.crypto_payments
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- 8. Privilegios. La migración que crea la tabla no concedía nada, así que en
-- una base nueva la política no bastaba: sin GRANT, PostgREST devuelve 401.
revoke insert, update, delete on public.crypto_payments from anon, authenticated;
grant select on public.crypto_payments to authenticated;
grant all on public.crypto_payments to service_role;

comment on table public.crypto_payments is
  'Libro de pagos on-chain verificados. Lo escribe verify-crypto-payment con la service role.';
comment on column public.crypto_payments.status is
  'verified = comprobado sin acreditar (reintentable); granted = plan ya extendido (no reutilizable).';

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'crypto_payments'
       and column_name = 'plan'
  ) then
    execute 'comment on column public.crypto_payments.plan is ''Histórico: nivel comprado en la primera versión. El código nuevo usa status, cycle y token.'' ';
  end if;
end $$;
