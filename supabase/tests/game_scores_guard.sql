-- Pruebas del portero de `game_scores` (migraciones 20261112150000 y
-- 20261113090000).
--
-- Por que existe: este SQL no lo ejecutaba nadie hasta que un jugador enviaba
-- una partida en produccion. Un raise mal puesto, un tope cambiado o un
-- calculo de puntos distinto solo se notaban cuando la liga dejaba de puntuar
-- y habia que mirar los logs.
--
-- Se prueba el trigger, no el camino del cliente. Las filas se insertan como
-- `postgres` (el rol con el que corre `supabase test db`), asi que estas
-- pruebas siguen valiendo cuando la migracion 20261113120000 revoca el INSERT
-- de `authenticated`: el trigger es la red de seguridad y debe morder venga la
-- fila por donde venga.
--
-- Ejecutar en local (necesita Docker):
--   supabase start
--   supabase test db                                        # todas
--   supabase test db supabase/tests/game_scores_guard.sql   # solo esta
--
-- Todo va en una transaccion que acaba en `rollback`: la base local queda como
-- estaba, sin usuarios de prueba ni partidas.

begin;

-- En las imagenes de Supabase pgTAP vive en `extensions`; si la base no lo
-- trae, se instala aqui. El search_path cubre los dos casos.
create extension if not exists pgtap;
set local search_path = public, extensions;

select plan(9);

-- ---------------------------------------------------------------------------
-- Siete cuentas, una por escenario, para que los topes de una no ensucien los
-- de otra. El trigger de alta crea el perfil; aqui solo hacen falta las filas
-- de `auth.users` a las que apuntan las claves ajenas.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'pgtap-1@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'pgtap-2@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'pgtap-3@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'pgtap-4@example.test'),
  ('55555555-5555-4555-8555-555555555555', 'pgtap-5@example.test'),
  ('66666666-6666-4666-8666-666666666666', 'pgtap-6@example.test'),
  ('77777777-7777-4777-8777-777777777777', 'pgtap-7@example.test')
on conflict (id) do nothing;

-- Emite un nonce ya gastado, que es lo que el trigger exige para dejar pasar
-- una fila. No se toca `expires_at`: el default del propio esquema.
create or replace function public.pgtap_issue_run(p_user uuid, p_game text)
returns uuid
language sql
as $fn$
  insert into public.game_runs (user_id, game, used_at)
  values (p_user, p_game, now())
  returning nonce;
$fn$;

select has_trigger(
  'public', 'game_scores', 'game_scores_guard',
  'game_scores_guard sigue enganchado al insert de game_scores'
);

-- 1. Nonce ausente: la fila se cae siempre, aunque los puntos cuadren.
select throws_ok(
  $q$
  insert into public.game_scores
    (user_id, handle, game, score, points, season, daily, run_nonce)
  values
    ('11111111-1111-4111-8111-111111111111', 'probador', 'memory', 1, 40,
     to_char(now() at time zone 'utc', 'YYYY-MM'), null, null)
  $q$,
  '23514', 'missing_run_nonce',
  'sin nonce no entra ninguna fila'
);

-- 2. Nonce de otra cuenta: existe, esta gastado, pero no es de quien firma.
select throws_ok(
  $q$
  with n as (
    insert into public.game_runs (user_id, game, used_at)
    values ('22222222-2222-4222-8222-222222222222', 'memory', now())
    returning nonce
  )
  insert into public.game_scores
    (user_id, handle, game, score, points, season, daily, run_nonce)
  select '11111111-1111-4111-8111-111111111111', 'probador', 'memory', 1, 40,
         to_char(now() at time zone 'utc', 'YYYY-MM'), null, n.nonce
    from n
  $q$,
  '23514', 'unknown_run_nonce',
  'un nonce gastado por otra cuenta no autoriza la fila'
);

-- 3. Puntos inventados: con nonce valido, 100 puntos por una partida de 40.
select throws_ok(
  $q$
  with n as (
    insert into public.game_runs (user_id, game, used_at)
    values ('33333333-3333-4333-8333-333333333333', 'memory', now())
    returning nonce
  )
  insert into public.game_scores
    (user_id, handle, game, score, points, season, daily, run_nonce)
  select '33333333-3333-4333-8333-333333333333', 'probador', 'memory', 1, 100,
         to_char(now() at time zone 'utc', 'YYYY-MM'), null, n.nonce
    from n
  $q$,
  '23514', 'points_mismatch',
  'una fila con puntos que no salen de la marca no entra'
);

-- 4. Reto del dia firmado ayer: los puntos cuadran, la fecha no.
select throws_ok(
  $q$
  with n as (
    insert into public.game_runs (user_id, game, used_at)
    values ('44444444-4444-4444-8444-444444444444', 'memory', now())
    returning nonce
  )
  insert into public.game_scores
    (user_id, handle, game, score, points, season, daily, run_nonce)
  select '44444444-4444-4444-8444-444444444444', 'probador', 'memory', 3, 120,
         to_char(now() at time zone 'utc', 'YYYY-MM'),
         (now() at time zone 'utc')::date - 1, n.nonce
    from n
  $q$,
  '23514', 'daily_not_today',
  'el reto de ayer no se puede cobrar hoy'
);

-- 5. Envio legitimo: 12 rondas de `memory` son 480 puntos y el reto es hoy.
--    Esta es la prueba que dice si una migracion rompe a quien juega de verdad.
select lives_ok(
  $q$
  with n as (
    insert into public.game_runs (user_id, game, used_at)
    values ('55555555-5555-4555-8555-555555555555', 'memory', now())
    returning nonce
  )
  insert into public.game_scores
    (user_id, handle, game, score, points, season, daily, run_nonce)
  select '55555555-5555-4555-8555-555555555555', 'probador', 'memory', 12, 480,
         to_char(now() at time zone 'utc', 'YYYY-MM'),
         (now() at time zone 'utc')::date, n.nonce
    from n
  $q$,
  'una partida con nonce gastado, puntos coherentes y reto de hoy entra'
);

select is(
  (select points from public.game_scores
    where user_id = '55555555-5555-4555-8555-555555555555'),
  480,
  'la partida legitima guarda los 480 puntos de 12 rondas'
);

-- 6. Tope de 60 partidas por jugador y dia.
do $do$
declare
  v_i integer;
begin
  for v_i in 1..60 loop
    insert into public.game_scores
      (user_id, handle, game, score, points, season, daily, run_nonce)
    values
      ('66666666-6666-4666-8666-666666666666', 'probador', 'memory', 1, 40,
       to_char(now() at time zone 'utc', 'YYYY-MM'), null,
       public.pgtap_issue_run('66666666-6666-4666-8666-666666666666', 'memory'));
  end loop;
end;
$do$;

select throws_ok(
  $q$
  with n as (
    insert into public.game_runs (user_id, game, used_at)
    values ('66666666-6666-4666-8666-666666666666', 'memory', now())
    returning nonce
  )
  insert into public.game_scores
    (user_id, handle, game, score, points, season, daily, run_nonce)
  select '66666666-6666-4666-8666-666666666666', 'probador', 'memory', 1, 40,
         to_char(now() at time zone 'utc', 'YYYY-MM'), null, n.nonce
    from n
  $q$,
  '53400', 'daily_run_cap',
  'la partida 61 del dia no entra aunque el nonce sea bueno'
);

-- 7. Tope de 100 000 puntos por jugador y dia: cinco partidas de 20 000 dejan
--    el dia justo en el techo y la sexta ya no cabe. Se usa otra cuenta porque
--    los topes se cuentan por jugador.
do $do$
declare
  v_i integer;
begin
  for v_i in 1..5 loop
    insert into public.game_scores
      (user_id, handle, game, score, points, season, daily, run_nonce)
    values
      ('77777777-7777-4777-8777-777777777777', 'probador', 'impulse', 20000, 20000,
       to_char(now() at time zone 'utc', 'YYYY-MM'), null,
       public.pgtap_issue_run('77777777-7777-4777-8777-777777777777', 'impulse'));
  end loop;
end;
$do$;

select throws_ok(
  $q$
  with n as (
    insert into public.game_runs (user_id, game, used_at)
    values ('77777777-7777-4777-8777-777777777777', 'impulse', now())
    returning nonce
  )
  insert into public.game_scores
    (user_id, handle, game, score, points, season, daily, run_nonce)
  select '77777777-7777-4777-8777-777777777777', 'probador', 'impulse', 20000, 20000,
         to_char(now() at time zone 'utc', 'YYYY-MM'), null, n.nonce
    from n
  $q$,
  '53400', 'daily_points_cap',
  'pasado el techo de 100 000 puntos del dia la fila no entra'
);

select * from finish();

rollback;
