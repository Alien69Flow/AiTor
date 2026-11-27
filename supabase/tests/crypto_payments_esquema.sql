-- pgTAP: la forma de crypto_payments y el no-op de su migración de noviembre.
--
-- La tabla nace en 20260917102030 ya con la forma que usa el código
-- (`status`, `cycle`, `token`, `price_version`), y
-- 20261126160000_crypto_payments_forma_final es el camino hacia delante para un
-- proyecto que aplicó la versión vieja (`plan`, `recipient NOT NULL`). En una
-- base limpia esa segunda migración no tiene nada que hacer, y aquí se fija
-- eso: el conjunto de columnas exacto, los tipos, los candados y los índices,
-- sin duplicados y sin `plan` resucitado.
--
-- Las políticas y los GRANT de la tabla ya los fija rls_creditos.sql, así que
-- este fichero no los repite: si alguien se lleva por delante un REVOKE, el que
-- se pone en rojo es aquél, no éste.
--
-- Se ejecuta como `postgres` (es lo que usa `supabase test db`), así que los
-- INSERT de las pruebas funcionales no chocan con RLS: lo que se prueba es la
-- tabla, no el portero.

begin;

set local search_path = public, extensions;
create extension if not exists pgtap with schema extensions;

select plan(30);

-- 1: existe.
select has_table('public', 'crypto_payments', 'existe crypto_payments');

-- 2-3: la forma, exacta y en el orden en que se creó. Cualquier columna de más
-- rompe aquí con el array a la vista: una `plan` que la migración de noviembre
-- dejara puesta, o un `granted_at` que alguien duplicara.
select is(
  (
    select array_agg(attname::text order by attnum)
      from pg_attribute
     where attrelid = 'public.crypto_payments'::regclass
       and attnum > 0
       and not attisdropped
  ),
  array[
    'id', 'user_id', 'tx_hash', 'chain', 'token', 'cycle', 'amount_usd',
    'price_version', 'wallet_address', 'recipient', 'status', 'granted_at',
    'created_at'
  ],
  'la tabla tiene exactamente las columnas de la forma nueva'
);

select hasnt_column(
  'public', 'crypto_payments', 'plan',
  'en una base limpia no hay `plan`: el histórico no lo devuelve la migración'
);

-- 4-9: los tipos. Los cuatro que introdujo el arreglo son text; el importe va
-- como numeric(12,2) y no como float, y `granted_at` con zona horaria. Se leen
-- con format_type para que el typmod cuente: 'numeric' a secas no bastaría.
select col_type_is('public', 'crypto_payments', 'status', 'text', 'status es text');
select col_type_is('public', 'crypto_payments', 'cycle', 'text', 'cycle es text');
select col_type_is('public', 'crypto_payments', 'token', 'text', 'token es text');
select col_type_is(
  'public', 'crypto_payments', 'price_version', 'text', 'price_version es text'
);

select is(
  (
    select format_type(atttypid, atttypmod)
      from pg_attribute
     where attrelid = 'public.crypto_payments'::regclass
       and attname = 'amount_usd'
  ),
  'numeric(12,2)',
  'amount_usd es numeric(12,2): dinero, no float'
);

select is(
  (
    select format_type(atttypid, atttypmod)
      from pg_attribute
     where attrelid = 'public.crypto_payments'::regclass
       and attname = 'granted_at'
  ),
  'timestamp with time zone',
  'granted_at lleva zona horaria'
);

-- 10-14: qué es obligatorio. `cycle` y `token` no nacen NOT NULL en la
-- migración de noviembre —los aprieta al final, si no queda ningún NULL—, así
-- que sobre la base limpia tienen que estar apretados. `price_version` y
-- `recipient` se quedan nulos a propósito: el código nuevo no los escribe.
select col_not_null('public', 'crypto_payments', 'status', 'status es obligatorio');
select col_not_null('public', 'crypto_payments', 'cycle', 'cycle es obligatorio');
select col_not_null('public', 'crypto_payments', 'token', 'token es obligatorio');
select col_is_null(
  'public', 'crypto_payments', 'price_version',
  'price_version admite NULL: un pago viejo no tiene tarifa que auditar'
);
select col_is_null(
  'public', 'crypto_payments', 'recipient',
  'recipient dejó de ser obligatorio y la migración no lo vuelve a apretar'
);

-- 15-16: los defaults que el código aprovecha para escribir sólo el pago.
select col_has_default('public', 'crypto_payments', 'status', 'status trae default');
select col_has_default('public', 'crypto_payments', 'token', 'token trae default');

-- 17-19: un candado de cada, sin duplicados. `add constraint` no tiene
-- `IF NOT EXISTS`, así que noviembre los mete desde un DO; si esa guarda
-- fallara, aquí habría seis CHECK en vez de tres.
select is(
  (
    select count(*)::int
      from pg_constraint
     where conrelid = 'public.crypto_payments'::regclass
       and contype = 'c'
  ),
  3,
  'hay tres CHECK y ninguno repetido'
);

select ok(
  exists (
    select 1
      from pg_constraint
     where conrelid = 'public.crypto_payments'::regclass
       and conname = 'crypto_payments_status_check'
       and pg_get_constraintdef(oid) like '%verified%'
       and pg_get_constraintdef(oid) like '%granted%'
  ),
  'status sólo admite verified y granted'
);

select ok(
  exists (
    select 1
      from pg_constraint
     where conrelid = 'public.crypto_payments'::regclass
       and conname = 'crypto_payments_hash_lowercase'
       and pg_get_constraintdef(oid) like '%lower%'
  ),
  'el hash guardado es siempre el canónico, en minúsculas'
);

-- 20-22: los índices. Uno para que un hash no se pueda cobrar dos veces y otro
-- para leer el historial por jugador; dos en total, no cuatro.
select ok(
  exists (
    select 1
      from pg_index i
      join pg_class c on c.oid = i.indexrelid
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
     where i.indrelid = 'public.crypto_payments'::regclass
       and c.relname = 'crypto_payments_tx_hash_key'
       and i.indisunique
       and a.attname = 'tx_hash'
  ),
  'un hash, un pago: índice único sobre tx_hash'
);

select ok(
  exists (
    select 1
      from pg_index i
      join pg_class c on c.oid = i.indexrelid
     where i.indrelid = 'public.crypto_payments'::regclass
       and c.relname = 'crypto_payments_user_created_idx'
       and i.indnkeyatts = 2
  ),
  'el historial se lee por (user_id, created_at desc)'
);

select is(
  (
    select count(*)::int
      from pg_index
     where indrelid = 'public.crypto_payments'::regclass
       and not indisprimary
  ),
  2,
  'dos índices secundarios: la migración de noviembre no duplica ninguno'
);

-- 23-26: los defaults, en un INSERT de verdad. El código nuevo escribe el pago
-- y deja que la tabla ponga el estado; si ese estado saliera 'granted' o con
-- fecha de concesión, un reintento se leería como plan ya extendido.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
values (
  '44444444-4444-4444-4444-444444444444',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'pgtap-pay@example.test', '',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}'
)
on conflict (id) do nothing;

create temp table t_pago as
  select '0x' || repeat('a', 64) as hash;

insert into public.crypto_payments (user_id, tx_hash, chain, cycle, amount_usd)
values (
  '44444444-4444-4444-4444-444444444444',
  (select hash from t_pago),
  'base',
  'monthly',
  12.50
);

select is(
  (select status from public.crypto_payments where tx_hash = (select hash from t_pago)),
  'verified',
  'un pago entra como verified, no como granted'
);

select is(
  (select token from public.crypto_payments where tx_hash = (select hash from t_pago)),
  'USDC',
  'token cae en USDC'
);

select is(
  (select price_version from public.crypto_payments where tx_hash = (select hash from t_pago)),
  null,
  'price_version queda nulo hasta que se sepa la tarifa aplicada'
);

select is(
  (select granted_at from public.crypto_payments where tx_hash = (select hash from t_pago)),
  null,
  'sin granted_at: el plan aún no se ha extendido'
);

-- 27-30: lo que no entra. Un estado inventado, un importe no positivo, un hash
-- en mayúsculas y el mismo hash dos veces.
select throws_ok(
  $$insert into public.crypto_payments (user_id, tx_hash, chain, cycle, amount_usd, status)
    values (
      '44444444-4444-4444-4444-444444444444',
      '0x' || repeat('b', 64), 'base', 'monthly', 1, 'paid'
    )$$,
  '23514',
  'un status que no sea verified ni granted no entra'
);

select throws_ok(
  $$insert into public.crypto_payments (user_id, tx_hash, chain, cycle, amount_usd)
    values (
      '44444444-4444-4444-4444-444444444444',
      '0x' || repeat('c', 64), 'base', 'monthly', 0
    )$$,
  '23514',
  'un pago de importe cero no entra'
);

select throws_ok(
  $$insert into public.crypto_payments (user_id, tx_hash, chain, cycle, amount_usd)
    values (
      '44444444-4444-4444-4444-444444444444',
      '0x' || repeat('D', 64), 'base', 'monthly', 1
    )$$,
  '23514',
  'un hash en mayúsculas no entra: el canónico es uno solo'
);

select throws_ok(
  $$insert into public.crypto_payments (user_id, tx_hash, chain, cycle, amount_usd)
    values (
      '44444444-4444-4444-4444-444444444444',
      (select hash from t_pago), 'base', 'monthly', 5
    )$$,
  '23505',
  'el mismo hash no se puede cobrar dos veces'
);

select * from finish();
rollback;
