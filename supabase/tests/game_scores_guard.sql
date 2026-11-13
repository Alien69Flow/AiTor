-- Pruebas del portero de `game_scores` (migraciones 20261112150000 y
-- 20261113090000).
--
-- Por que existe: este SQL no lo ejecutaba nadie hasta que un jugador enviaba
-- una partida en produccion. Un raise mal puesto, un tope cambiado o un
-- calculo de puntos distinto solo se notaban cuando la liga dejaba de puntuar
-- y habia que mirar los logs. Es el bloque M de la issue #86.
--
-- Que cubre, caso por caso:
--   nonce ausente          -> missing_run_nonce   (23514)
--   nonce unico            -> indice unico de `game_scores.run_nonce` (23505)
--   nonce caducado         -> no lo gasta `consume_game_run` y la fila no entra
--   nonce de otra cuenta   -> unknown_run_nonce   (23514)
--   nonce de otro juego    -> unknown_run_nonce   (23514)
--   puntos fuera de baremo -> points_mismatch     (23514), en los tres juegos
--   tope de 60 partidas    -> daily_run_cap       (53400)
--   tope de 100 000 puntos -> daily_points_cap    (53400)
--   envio legitimo         -> entra y guarda los puntos recalculados
--
-- Se prueba el trigger y la caducidad, no el camino del cliente. Las filas se
-- insertan como `postgres` (el rol con el que corre `supabase test db`), asi
-- que estas pruebas siguen valiendo ahora que la migracion 20261113120000
-- revoca el INSERT de `authenticated`: el trigger es la red de seguridad y debe
-- morder venga la fila por donde venga.
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

select plan(19);

-- ---------------------------------------------------------------------------
-- Doce cuentas, una por escenario, para que los topes de una no ensucien los
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
  ('77777777-7777-4777-8777-777777777777', 'pgtap-7@example.test'),
  ('88888888-8888-4888-8888-888888888888', 'pgtap-8@example.test'),
  ('99999999-9999-4999-8999-999999999999', 'pgtap-9@example.test'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pgtap-10@example.test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'pgtap-11@example.test'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'pgtap-12@example.test')
on conflict (id) do nothing;

-- Nonce ya gastado: es lo que el trigger exige para dejar entrar una fila.
create or replace function public.pgtap_issue_run(p_user uuid, p_game text)
returns uuid
language sql
as $fn$
  insert into public.game_runs (user_id, game, used_at)
  values (p_user, p_game, now())
  returning nonce;
$fn$;

-- Nonce recien emitido y sin gastar (`used_at` a null, caducidad por defecto de
-- 10 minutos): hace falta para probar `consume_game_run`.
create or replace function public.pgtap_new_run(p_user uuid, p_game text)
returns uuid
language sql
as $fn$
  insert into public.game_runs (user_id, game)
  values (p_user, p_game)
  returning nonce;
$fn$;

-- Gasta un nonce como lo haria el jugador: `consume_game_run` lee `auth.uid()`,
-- asi que hay que ponerse en `authenticated` con las claims del usuario. Es el
-- mismo patron que documenta Supabase para probar RPC con RLS.
create or replace function public.pgtap_consume_as(p_user uuid, p_nonce uuid, p_game text)
returns boolean
language plpgsql
as $fn$
declare
  v_ok boolean;
begin
  set local role authenticated;
  set local request.jwt.claims = json_build_object(
    'sub', p_user, 'role', 'authenticated'
  )::text;

  select public.consume_game_run(p_nonce, p_game) into v_ok;

  reset role;
  perform set_config('request.jwt.claims', '', true);

  return coalesce(v_ok, false);
end;
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

-- 3. Nonce de otro juego: emitido y gastado en `memory`, presentado en
--    `impulse`. Los puntos cuadran para el juego equivocado (200 de 200), asi
--    que lo unico que puede echarlo atras es la comparacion de `game`.
select throws_ok(
  $q$
  with n as (
    insert into public.game_runs (user_id, game, used_at)
    values ('88888888-8888-4888-8888-888888888888', 'memory', now())
    returning nonce
  )
  insert into public.game_scores
    (user_id, handle, game, score, points, season, daily, run_nonce)
  select '88888888-8888-4888-8888-888888888888', 'probador', 'impulse', 200, 200,
         to_char(now() at time zone 'utc', 'YYYY-MM'), null, n.nonce
    from n
  $q$,
  '23514', 'unknown_run_nonce',
  'un nonce de memory no autoriza una fila de impulse'
);

-- 4. Puntos fuera de baremo, `memory`: 1 ronda son 40 puntos, no 100.
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
  'memory: una fila con puntos que no salen de la marca no entra'
);

-- 5. Puntos fuera de baremo, `impulse`: el techo son 20 000, asi que una marca
--    de 25 000 no puede pagar 25 000.
select throws_ok(
  $q$
  with n as (
    insert into public.game_runs (user_id, game, used_at)
    values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'impulse', now())
    returning nonce
  )
  insert into public.game_scores
    (user_id, handle, game, score, points, season, daily, run_nonce)
  select 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'probador', 'impulse', 25000, 25000,
         to_char(now() at time zone 'utc', 'YYYY-MM'), null, n.nonce
    from n
  $q$,
  '23514', 'points_mismatch',
  'impulse: por encima de 20 000 la marca no paga lo que dice'
);

-- 6. Puntos fuera de baremo, `reactor`: techo 2 000.
select throws_ok(
  $q$
  with n as (
    insert into public.game_runs (user_id, game, used_at)
    values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'reactor', now())
    returning nonce
  )
  insert into public.game_scores
    (user_id, handle, game, score, points, season, daily, run_nonce)
  select 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'probador', 'reactor', 5000, 5000,
         to_char(now() at time zone 'utc', 'YYYY-MM'), null, n.nonce
    from n
  $q$,
  '23514', 'points_mismatch',
  'reactor: por encima de 2 000 la marca no paga lo que dice'
);

-- 7. Reto del dia firmado ayer: los puntos cuadran, la fecha no.
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

-- 8. Envio legitimo: 12 rondas de `memory` son 480 puntos y el reto es hoy.
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

-- 9. La marca por encima del techo se paga como techo, no como marca. Se fija
--    el comportamiento que hay hoy: los 20 000 puntos entran, y la columna
--    `score` guarda la marca tal cual (25 000). Ver la nota de la issue #86
--    sobre recortar tambien la marca.
select lives_ok(
  $q$
  with n as (
    insert into public.game_runs (user_id, game, used_at)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'impulse', now())
    returning nonce
  )
  insert into public.game_scores
    (user_id, handle, game, score, points, season, daily, run_nonce)
  select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'probador', 'impulse', 25000, 20000,
         to_char(now() at time zone 'utc', 'YYYY-MM'), null, n.nonce
    from n
  $q$,
  'impulse: una marca por encima del techo paga 20 000 y entra'
);

select is(
  (select points from public.game_scores
    where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  20000,
  'el techo de impulse son 20 000 puntos, ni uno mas'
);

-- 10. Nonce unico: el mismo nonce no autoriza dos filas. El primer insert
--     entra; el segundo choca contra el indice unico de `game_scores.run_nonce`.
select lives_ok(
  $q$
  with n as (
    insert into public.game_runs (user_id, game, used_at)
    values ('99999999-9999-4999-8999-999999999999', 'memory', now())
    returning nonce
  )
  insert into public.game_scores
    (user_id, handle, game, score, points, season, daily, run_nonce)
  select '99999999-9999-4999-8999-999999999999', 'probador', 'memory', 1, 40,
         to_char(now() at time zone 'utc', 'YYYY-MM'), null, n.nonce
    from n
  $q$,
  'el primer envio con un nonce entra'
);

-- El mensaje de una violacion de indice unico depende del locale de la base,
-- asi que se comprueba el SQLSTATE y no el texto.
do $do$
declare
  v_rejected boolean := false;
begin
  begin
    insert into public.game_scores
      (user_id, handle, game, score, points, season, daily, run_nonce)
    values
      ('99999999-9999-4999-8999-999999999999', 'probador', 'memory', 1, 40,
       to_char(now() at time zone 'utc', 'YYYY-MM'), null,
       (select run_nonce from public.game_scores
         where user_id = '99999999-9999-4999-8999-999999999999'));
  exception when unique_violation then
    v_rejected := true;
  end;

  if v_rejected then
    perform pass('el mismo nonce no autoriza una segunda fila');
  else
    perform fail('el mismo nonce autorizo dos filas');
  end if;
end;
$do$;

-- 11. Nonce caducado. La caducidad no vive en el trigger sino en
--     `consume_game_run` (`expires_at > now()`), asi que se prueba ahi: no se
--     puede gastar, y sin gastar la fila no tiene nonce que presentar.
select ok(
  public.pgtap_consume_as(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    public.pgtap_new_run('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'memory'),
    'memory'
  ),
  'un nonce recien emitido y sin gastar se puede gastar'
);

insert into public.game_runs (nonce, user_id, game, issued_at, expires_at)
values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'memory',
   now() - interval '20 minutes', now() - interval '10 minutes');

select ok(
  not public.pgtap_consume_as(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'memory'
  ),
  'un nonce caducado no se puede gastar'
);

select throws_ok(
  $q$
  insert into public.game_scores
    (user_id, handle, game, score, points, season, daily, run_nonce)
  values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'probador', 'memory', 1, 40,
     to_char(now() at time zone 'utc', 'YYYY-MM'), null,
     'dddddddd-dddd-4ddd-8ddd-dddddddddddd')
  $q$,
  '23514', 'unknown_run_nonce',
  'con un nonce caducado la fila no entra'
);

-- 12. Tope de 60 partidas por jugador y dia.
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

-- 13. Tope de 100 000 puntos por jugador y dia: cinco partidas de 20 000 dejan
--     el dia justo en el techo y la sexta ya no cabe. Se usa otra cuenta porque
--     los topes se cuentan por jugador.
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
