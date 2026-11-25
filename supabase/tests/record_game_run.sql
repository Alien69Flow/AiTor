-- pgTAP: el ciclo de vida del nonce de partida.
--
-- Cubre `start_game_run` y `consume_game_run`, tal como quedan en
-- 20261112150000_game_league_anticheat: que hay nonce, que es de un solo uso,
-- que no cruza de juego ni de jugador, y que caduca.
--
-- Se ejecuta como `postgres` (es lo que usa `supabase test db`) y la sesion se
-- simula con `request.jwt.claims`, que es de donde `auth.uid()` saca el `sub`.
-- No se cambia de rol: lo que se prueba es la funcion, no la politica RLS.

begin;

set local search_path = public, extensions;
create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'pgtap-run-a@example.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'pgtap-run-b@example.test', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}'
  )
on conflict (id) do nothing;

-- 1-4: la forma de lo que se va a probar.
select has_table('public', 'game_runs', 'existe game_runs');
select col_is_pk('public', 'game_runs', 'nonce', 'el nonce es la clave de la tabla');
select has_function('public', 'start_game_run', array['text'], 'existe start_game_run');
select has_function('public', 'consume_game_run', array['uuid', 'text'], 'existe consume_game_run');

-- 5: quien puede emitir y gastar. El helper de pgTAP con descripcion no existe
-- en la version que trae la imagen (el run lo dijo), asi que se usa el de
-- PostgreSQL y la descripcion va en `ok()`.
select ok(
  has_function_privilege(
    'authenticated', 'public.start_game_run(text)'::regprocedure, 'execute'
  ),
  'authenticated puede emitir nonces'
);

-- 6-7: emitir devuelve exactamente una fila, fechada hoy en UTC.
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

create temp table t_run as
  select * from public.start_game_run('impulse');

select is(
  (select count(*)::int from t_run), 1,
  'start_game_run devuelve una fila'
);
select is(
  (select day from t_run),
  (now() at time zone 'utc')::date,
  'el nonce queda fechado hoy en UTC'
);

-- 8-9: un solo uso. El segundo intento choca con `used_at is null`.
select is(
  public.consume_game_run((select nonce from t_run), 'impulse'),
  true,
  'el primer consumo se lleva el nonce'
);
select is(
  public.consume_game_run((select nonce from t_run), 'impulse'),
  false,
  'el segundo consumo con el mismo nonce no'
);

-- 10: un nonce de un juego no autoriza otro.
create temp table t_run2 as
  select * from public.start_game_run('memory');

select is(
  public.consume_game_run((select nonce from t_run2), 'reactor'),
  false,
  'un nonce emitido para memory no vale para reactor'
);

-- 11: ni sirve a otro jugador.
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  public.consume_game_run((select nonce from t_run2), 'memory'),
  false,
  'el nonce de un jugador no le sirve a otro'
);

-- 12: caducado no autoriza nada.
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.game_runs (nonce, user_id, game, expires_at)
values (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'reactor',
  now() - interval '1 minute'
);

select is(
  public.consume_game_run('33333333-3333-3333-3333-333333333333', 'reactor'),
  false,
  'un nonce caducado no se consume'
);

select * from finish();
rollback;
