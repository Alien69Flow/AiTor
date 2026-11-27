-- pgTAP: el portero de game_scores.
--
-- Cubre el trigger `game_scores_guard` tal como queda en
-- 20261113090000_game_scores_points_guard: nonce obligatorio y ya gastado,
-- puntos recalculados en la base (los del cliente no valen), reto del dia, y
-- los dos topes diarios.
--
-- Los INSERT van como el usuario de las pruebas, que salta RLS: aqui se prueba
-- el trigger, no la politica. La sesion se simula con `request.jwt.claims`
-- para que `auth.uid()` devuelva el jugador que toca.
--
-- Los nonces se dan de alta a mano como "gastados" porque es exactamente el
-- estado que el portero exige: uno emitido y sin usar no autoriza nada.

begin;

set local search_path = public, extensions;
create extension if not exists pgtap with schema extensions;

select plan(19);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'pgtap-guard-a@example.test', '',
   now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'pgtap-guard-b@example.test', '',
   now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'pgtap-guard-tope-runs@example.test', '',
   now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'pgtap-guard-tope-puntos@example.test', '',
   now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}')
on conflict (id) do nothing;

-- Nonces ya gastados, uno por caso. Van separados a proposito: cada uno solo
-- puede autorizar una fila, y el indice unico de `run_nonce` lo hace cumplir.
insert into public.game_runs (nonce, user_id, game, used_at)
values
  ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'impulse', now()),
  ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'memory',  now()),
  ('00000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'impulse', now()),
  ('00000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'reactor', now()),
  ('00000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'impulse', now()),
  ('00000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'reactor', now()),
  ('00000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'reactor', now()),
  ('00000000-0000-0000-0000-000000000008', '22222222-2222-2222-2222-222222222222', 'impulse', now()),
  ('00000000-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'memory',  now());

-- Uno emitido y sin gastar: no autoriza nada.
insert into public.game_runs (nonce, user_id, game)
values ('00000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'reactor');

set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- 1-3: la forma.
select has_function('public', 'game_scores_guard', array[]::text[], 'existe el portero');
select has_trigger('public', 'game_scores', 'game_scores_guard', 'el portero esta enganchado a game_scores');
select has_column('public', 'game_scores', 'run_nonce', 'game_scores recuerda que nonce la autorizo');

-- 4-8: sin nonce bueno no hay fila.
select throws_ok(
  $$insert into public.game_scores (user_id, handle, game, score, points, season)
    values ('11111111-1111-1111-1111-111111111111', 'pgtap', 'impulse', 500, 500, '2026-11')$$,
  '23514', 'missing_run_nonce', 'sin nonce no entra nada'
);

select throws_ok(
  $$insert into public.game_scores (user_id, handle, game, score, points, season, run_nonce)
    values ('11111111-1111-1111-1111-111111111111', 'pgtap', 'impulse', 500, 500, '2026-11',
            '99999999-0000-0000-0000-000000000000')$$,
  '23514', 'unknown_run_nonce', 'un nonce que no existe no entra'
);

select throws_ok(
  $$insert into public.game_scores (user_id, handle, game, score, points, season, run_nonce)
    values ('11111111-1111-1111-1111-111111111111', 'pgtap', 'impulse', 500, 500, '2026-11',
            '00000000-0000-0000-0000-000000000008')$$,
  '23514', 'unknown_run_nonce', 'el nonce de otro jugador no entra'
);

select throws_ok(
  $$insert into public.game_scores (user_id, handle, game, score, points, season, run_nonce)
    values ('11111111-1111-1111-1111-111111111111', 'pgtap', 'impulse', 500, 500, '2026-11',
            '00000000-0000-0000-0000-000000000009')$$,
  '23514', 'unknown_run_nonce', 'un nonce de memory no autoriza una partida de impulse'
);

select throws_ok(
  $$insert into public.game_scores (user_id, handle, game, score, points, season, run_nonce)
    values ('11111111-1111-1111-1111-111111111111', 'pgtap', 'reactor', 100, 100, '2026-11',
            '00000000-0000-0000-0000-000000000010')$$,
  '23514', 'unknown_run_nonce', 'un nonce emitido pero sin gastar no entra'
);

-- 9-10: una partida buena entra, y los puntos son los que calculó la base.
select lives_ok(
  $$insert into public.game_scores (user_id, handle, game, score, points, season, run_nonce)
    values ('11111111-1111-1111-1111-111111111111', 'pgtap', 'impulse', 500, 500, '2026-11',
            '00000000-0000-0000-0000-000000000001')$$,
  'una partida con nonce gastado entra'
);

select is(
  (select points from public.game_scores where run_nonce = '00000000-0000-0000-0000-000000000001'),
  500, 'impulse guarda la marca como puntos'
);

-- 11-13: los tres techos del calculo, uno por juego.
select lives_ok(
  $$insert into public.game_scores (user_id, handle, game, score, points, season, run_nonce)
    values ('11111111-1111-1111-1111-111111111111', 'pgtap', 'memory', 30, 480, '2026-11',
            '00000000-0000-0000-0000-000000000002')$$,
  'memory tope 12 rondas: 30 rondas son 480 puntos'
);

select lives_ok(
  $$insert into public.game_scores (user_id, handle, game, score, points, season, run_nonce)
    values ('11111111-1111-1111-1111-111111111111', 'pgtap', 'impulse', 99999, 20000, '2026-11',
            '00000000-0000-0000-0000-000000000003')$$,
  'impulse tope 20 000: una marca mayor no da mas'
);

select lives_ok(
  $$insert into public.game_scores (user_id, handle, game, score, points, season, run_nonce)
    values ('11111111-1111-1111-1111-111111111111', 'pgtap', 'reactor', 9999, 2000, '2026-11',
            '00000000-0000-0000-0000-000000000004')$$,
  'reactor tope 2 000: una marca mayor no da mas'
);

-- 14: los puntos del cliente no valen.
select throws_ok(
  $$insert into public.game_scores (user_id, handle, game, score, points, season, run_nonce)
    values ('11111111-1111-1111-1111-111111111111', 'pgtap', 'impulse', 500, 900, '2026-11',
            '00000000-0000-0000-0000-000000000005')$$,
  '23514', 'points_mismatch', 'declarar puntos distintos a los calculados no entra'
);

-- 15-16: el reto del dia se firma hoy, no ayer.
select throws_ok(
  $$insert into public.game_scores (user_id, handle, game, score, points, season, daily, run_nonce)
    values ('11111111-1111-1111-1111-111111111111', 'pgtap', 'reactor', 0, 0, '2026-11',
            ((now() at time zone 'utc')::date - 1),
            '00000000-0000-0000-0000-000000000006')$$,
  '23514', 'daily_not_today', 'el reto de ayer no se puede firmar hoy'
);

select lives_ok(
  $$insert into public.game_scores (user_id, handle, game, score, points, season, daily, run_nonce)
    values ('11111111-1111-1111-1111-111111111111', 'pgtap', 'reactor', 0, 0, '2026-11',
            (now() at time zone 'utc')::date,
            '00000000-0000-0000-0000-000000000007')$$,
  'el reto de hoy si entra'
);

-- 17: el indice unico impide que un nonce autorice dos filas.
select throws_ok(
  $$insert into public.game_scores (user_id, handle, game, score, points, season, run_nonce)
    values ('11111111-1111-1111-1111-111111111111', 'pgtap', 'impulse', 500, 500, '2026-11',
            '00000000-0000-0000-0000-000000000001')$$,
  '23505', null, 'el mismo nonce no autoriza una segunda fila'
);

-- 18-19: los dos topes diarios. 60 partidas y 100 000 puntos por jugador y dia
-- UTC; se preparan con filas de relleno para no escribir 60 INSERT a mano.
insert into public.game_runs (user_id, game, used_at)
select '44444444-4444-4444-4444-444444444444', 'reactor', now()
  from generate_series(1, 61);

insert into public.game_scores (user_id, handle, game, score, points, season, run_nonce)
select '44444444-4444-4444-4444-444444444444', 'tope-runs', 'reactor', 0, 0, '2026-11', nonce
  from public.game_runs
 where user_id = '44444444-4444-4444-4444-444444444444'
 order by nonce
 limit 60;

select throws_ok(
  format(
    $$insert into public.game_scores (user_id, handle, game, score, points, season, run_nonce)
      values ('44444444-4444-4444-4444-444444444444', 'tope-runs', 'reactor', 0, 0, '2026-11', %L)$$,
    (select nonce from public.game_runs
      where user_id = '44444444-4444-4444-4444-444444444444'
      order by nonce offset 60 limit 1)
  ),
  '53400', 'daily_run_cap', 'la partida 61 del dia no entra'
);

insert into public.game_runs (user_id, game, used_at)
select '55555555-5555-5555-5555-555555555555', 'impulse', now()
  from generate_series(1, 6);

insert into public.game_scores (user_id, handle, game, score, points, season, run_nonce)
select '55555555-5555-5555-5555-555555555555', 'tope-puntos', 'impulse', 20000, 20000, '2026-11', nonce
  from public.game_runs
 where user_id = '55555555-5555-5555-5555-555555555555'
 order by nonce
 limit 5;

select throws_ok(
  format(
    $$insert into public.game_scores (user_id, handle, game, score, points, season, run_nonce)
      values ('55555555-5555-5555-5555-555555555555', 'tope-puntos', 'impulse', 1, 1, '2026-11', %L)$$,
    (select nonce from public.game_runs
      where user_id = '55555555-5555-5555-5555-555555555555'
      order by nonce offset 5 limit 1)
  ),
  '53400', 'daily_points_cap', 'pasar de 100 000 puntos en el dia no entra'
);

select * from finish();
rollback;
