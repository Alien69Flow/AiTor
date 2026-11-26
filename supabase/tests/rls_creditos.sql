-- pgTAP: los candados de user_credits y crypto_payments.
--
-- Las dos tablas nacen en migraciones (20261029120000_user_credits.sql y
-- 20260917102030) y las protegen dos capas: los GRANT de tabla y las políticas
-- RLS. Aquí se fijan las dos, para que quitar un REVOKE o una política ponga el
-- CI en rojo en vez de dejar la tabla abierta sin que nadie lo note.
--
-- Los privilegios se comprueban con `has_table_privilege`, no con el conjunto
-- exacto: una base limpia levantada por el CLI no reparte los GRANT por
-- defecto que sí tiene el proyecto hospedado (truncate, references, trigger),
-- así que una lista exacta ataría la prueba al entorno. El conjunto exacto se
-- fija donde sí es determinista: `policies_are`, con los nombres.

begin;

set local search_path = public, extensions;
create extension if not exists pgtap with schema extensions;

select plan(21);

-- crypto_payments: una sola política, de lectura y del propio usuario.
--
-- La tabla no lleva GRANT explícito en ninguna migración —los pone el proyecto
-- hospedado por defecto y el CLI no—, así que aquí no se afirma nada sobre
-- privilegios: lo que la defiende es el RLS, y una política que se pierda deja
-- la tabla legible por cualquiera.
select has_table('public', 'crypto_payments', 'existe crypto_payments');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.crypto_payments'::regclass),
  'crypto_payments tiene RLS activo'
);

select policies_are(
  'public', 'crypto_payments',
  array['crypto_payments: ver los propios'],
  'crypto_payments tiene exactamente su política de lectura'
);

select ok(
  exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'crypto_payments'
       and policyname = 'crypto_payments: ver los propios'
       and cmd = 'SELECT'
  ),
  'la política de crypto_payments es de SELECT'
);

select ok(
  exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'crypto_payments'
       and policyname = 'crypto_payments: ver los propios'
       and roles::text[] @> array['authenticated']
       and array_length(roles, 1) = 1
  ),
  'y sólo se aplica a authenticated'
);

-- user_credits: tres políticas —lectura propia, service role y un candado
-- restrictivo que niega cualquier escritura de cliente— y los GRANT que las
-- acompañan.
select has_table('public', 'user_credits', 'existe user_credits');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_credits'::regclass),
  'user_credits tiene RLS activo'
);

select policies_are(
  'public', 'user_credits',
  array[
    'user_credits: lectura del propio saldo',
    'Service role manages user_credits',
    'No client writes to user_credits'
  ],
  'user_credits tiene sus tres políticas y ninguna más'
);

select ok(
  exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'user_credits'
       and policyname = 'No client writes to user_credits'
       and permissive = 'RESTRICTIVE' and cmd = 'ALL'
  ),
  'el candado de escritura es restrictivo y cubre todos los comandos'
);

select ok(
  exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'user_credits'
       and policyname = 'No client writes to user_credits'
       and roles::text[] @> array['anon', 'authenticated']
       and array_length(roles, 1) = 2
  ),
  'y se aplica a anon y authenticated'
);

select ok(
  exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'user_credits'
       and policyname = 'No client writes to user_credits'
       and with_check = 'false'
  ),
  'con WITH CHECK false: no hay escritura de cliente que pase'
);

select ok(
  exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'user_credits'
       and policyname = 'Service role manages user_credits'
       and permissive = 'PERMISSIVE' and cmd = 'ALL'
       and roles::text[] @> array['service_role']
  ),
  'la service role tiene su política para todo'
);

select ok(
  exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'user_credits'
       and policyname = 'user_credits: lectura del propio saldo'
       and cmd = 'SELECT'
       and roles::text[] @> array['authenticated']
  ),
  'authenticated lee por la política del propio saldo'
);

select ok(
  has_table_privilege('authenticated', 'public.user_credits', 'SELECT'),
  'authenticated conserva el SELECT que concede la migración'
);

select ok(
  not has_table_privilege('anon', 'public.user_credits', 'INSERT'),
  'anon no puede insertar créditos'
);
select ok(
  not has_table_privilege('anon', 'public.user_credits', 'UPDATE'),
  'anon no puede actualizarlos'
);
select ok(
  not has_table_privilege('anon', 'public.user_credits', 'DELETE'),
  'anon no puede borrarlos'
);

select ok(
  not has_table_privilege('authenticated', 'public.user_credits', 'INSERT'),
  'authenticated no puede darse créditos'
);
select ok(
  not has_table_privilege('authenticated', 'public.user_credits', 'UPDATE'),
  'authenticated no puede actualizarlos'
);
select ok(
  not has_table_privilege('authenticated', 'public.user_credits', 'DELETE'),
  'authenticated no puede borrarlos'
);

select ok(
  has_table_privilege('service_role', 'public.user_credits', 'SELECT')
  and has_table_privilege('service_role', 'public.user_credits', 'INSERT'),
  'la service role sí puede leer y escribir'
);

select * from finish();
rollback;
