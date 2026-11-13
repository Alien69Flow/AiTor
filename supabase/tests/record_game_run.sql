-- Pruebas de `record_game_run` (migracion 20261113120000).
--
-- Por que existe: es la unica puerta de escritura de la liga. Si se rompe,
-- el jugador pierde la partida; si se abre de mas, el ranking deja de valer.
-- Hasta ahora solo estaba probada a mano con curls y con los mocks de
-- `tests/api/league.test.ts`, que no tocan Postgres.
--
-- Que cubre:
--   puntua bien                -> memory 3 rondas = 120 puntos, season de la base
--   recorta la marca           -> impulse 25 000 se guarda como 20 000
--   nonce repetido             -> 23514 nonce_invalid
--   nonce de otro juego        -> 23514 nonce_invalid
--   tope de 60 partidas        -> 53400 daily_run_cap
--   tope de 100 000 puntos     -> 53400 daily_points_cap
--   insert directo             -> 42501 permission denied (el cierre de PostgREST)
--
-- Los errores se comparan por SQLSTATE y no por texto: el mensaje de un
-- permiso denegado depende del locale de la base, y esta prueba tiene que
-- valer igual en ingles y en espanol.
--
-- Ejecutar en local (necesita Docker):
--   supabase start
--   supabase test db supabase/tests/record_game_run.sql
--
-- Todo va en una transaccion que acaba en `rollback`.

begin;

create extension if not exists pgtap;
set local search_path = public, extensions;

select plan(12);

-- ---------------------------------------------------------------------------
-- Seis cuentas, una por escenario: los topes diarios se cuentan por jugador y
-- no deben contaminarse entre pruebas.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'pgtap-run-1@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'pgtap-run-2@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'pgtap-run-3@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'pgtap-run-4@example.test'),
  ('55555555-5555-4555-8555-555555555555', 'pgtap-run-5@example.test'),
  ('66666666-6666-4666-8666-666666666666', 'pgtap-run-6@example.test')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Ayudantes. La RPC lee `auth.uid()`, asi que hay que ponerse en
-- `authenticated` con las claims del jugador, igual que haria PostgREST.
--
-- Van SIN `security definer` a proposito: `SET ROLE` no se puede ejecutar
-- dentro de una funcion de ese tipo. Como el fichero corre como `postgres`
-- (superusuario), una funcion normal puede cambiar de rol y volver.
-- ---------------------------------------------------------------------------

-- Emite un nonce como lo haria el navegador: llama a `start_game_run`.
create or replace function public.pgtap_start_as(p_user uuid, p_game text)
returns uuid
language plpgsql
as $fn$
declare
  v_nonce uuid;
begin
  set local role authenticated;
  set local request.jwt.claims = json_build_object(
    'sub', p_user, 'role', 'authenticated'
  )::text;

  select s.nonce into v_nonce from public.start_game_run(p_game) s;

  reset role;
  perform set_config('request.jwt.claims', '', true);
  return v_nonce;
end;
$fn$;

-- Registra una partida y devuelve lo que guardo la base.
create or replace function public.pgtap_record_as(
  p_user uuid, p_nonce uuid, p_game text, p_score integer, p_daily date, p_handle text
)
returns table (points integer, score integer, season text)
language plpgsql
as $fn$
declare
  v_points integer;
  v_score integer;
  v_season text;
begin
  set local role authenticated;
  set local request.jwt.claims = json_build_object(
    'sub', p_user, 'role', 'authenticated'
  )::text;

  select r.points, r.score, r.season
    into v_points, v_score, v_season
    from public.record_game_run(p_nonce, p_game, p_score, p_daily, p_handle) r;

  reset role;
  perform set_config('request.jwt.claims', '', true);
  return query select v_points, v_score, v_season;
end;
$fn$;

-- Intenta registrar y devuelve 'ok' o el SQLSTATE del fallo. Asi una partida
-- rechazada no aborta la transaccion de las pruebas.
create or replace function public.pgtap_record_state(
  p_user uuid, p_nonce uuid, p_game text, p_score integer, p_daily date, p_handle text
)
returns text
language plpgsql
as $fn$
declare
  v_state text;
begin
  set local role authenticated;
  set local request.jwt.claims = json_build_object(
    'sub', p_user, 'role', 'authenticated'
  )::text;

  begin
    perform * from public.record_game_run(p_nonce, p_game, p_score, p_daily, p_handle);
    v_state := 'ok';
  exception when others then
    v_state := sqlstate;
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
  return v_state;
end;
$fn$;

-- Intenta el insert directo que la migracion tiene que haber cerrado.
create or replace function public.pgtap_direct_insert_state(p_user uuid)
returns text
language plpgsql
as $fn$
declare
  v_state text;
begin
  set local role authenticated;
  set local request.jwt.claims = json_build_object(
    'sub', p_user, 'role', 'authenticated'
  )::text;

  begin
    insert into public.game_scores
      (user_id, handle, game, score, points, season, daily, run_nonce)
    values
      (p_user, 'probador', 'memory', 1, 40,
       to_char(now() at time zone 'utc', 'YYYY-MM'), null, gen_random_uuid());
    v_state := 'ok';
  exception when others then
    v_state := sqlstate;
  end;

  reset role;
  perform set_config('request.jwt.claims', '', true);
  return v_state;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Contrato de la funcion
-- ---------------------------------------------------------------------------
select has_function(
  'public', 'record_game_run',
  array['uuid', 'text', 'integer', 'date', 'text'],
  'record_game_run existe con la firma que llama api/league.ts'
);

-- El nonce deja de ser una herramienta del cliente: si esta concesion vuelve,
-- se puede gastar sin jugar y la RPC deja de ser la unica puerta.
select ok(
  not has_function_privilege('authenticated', 'public.consume_game_run(uuid,text)', 'execute'),
  'authenticated ya no puede gastar nonces por su cuenta'
);

-- ---------------------------------------------------------------------------
-- Puntua bien
-- ---------------------------------------------------------------------------
create temp table pgtap_ok as
  select * from public.pgtap_record_as(
    '11111111-1111-4111-8111-111111111111',
    public.pgtap_start_as('11111111-1111-4111-8111-111111111111', 'memory'),
    'memory', 3, null, 'probador'
  );

select is(
  (select points from pgtap_ok),
  120,
  'memory: 3 rondas se pagan como 120 puntos'
);

select is(
  (select score from pgtap_ok),
  3,
  'memory: la marca se guarda tal cual (3 rondas)'
);

select is(
  (select season from pgtap_ok),
  to_char(now() at time zone 'utc', 'YYYY-MM'),
  'la temporada la pone la base, no el cliente'
);

-- La marca por encima del techo se recorta antes de pagar: es lo que el
-- trigger de la #85 no hacia con `score`, y aqui si.
create temp table pgtap_clamp as
  select * from public.pgtap_record_as(
    '11111111-1111-4111-8111-111111111111',
    public.pgtap_start_as('11111111-1111-4111-8111-111111111111', 'impulse'),
    'impulse', 25000, null, 'probador'
  );

select is(
  (select score from pgtap_clamp),
  20000,
  'impulse: la marca se recorta al techo de 20 000 antes de guardarse'
);

select is(
  (select points from pgtap_clamp),
  20000,
  'impulse: por encima del techo se pagan 20 000, ni uno mas'
);

-- ---------------------------------------------------------------------------
-- Nonce repetido: el mismo nonce no autoriza dos filas.
-- ---------------------------------------------------------------------------
create temp table pgtap_repeat as
  select public.pgtap_start_as('22222222-2222-4222-8222-222222222222', 'memory') as nonce;

do $do$
begin
  perform public.pgtap_record_state(
    '22222222-2222-4222-8222-222222222222',
    (select nonce from pgtap_repeat),
    'memory', 1, null, 'probador'
  );
end;
$do$;

select is(
  public.pgtap_record_state(
    '22222222-2222-4222-8222-222222222222',
    (select nonce from pgtap_repeat),
    'memory', 1, null, 'probador'
  ),
  '23514',
  'el mismo nonce no vale dos veces (23514 nonce_invalid)'
);

-- ---------------------------------------------------------------------------
-- Nonce de otro juego: emitido en memory, presentado en impulse.
-- ---------------------------------------------------------------------------
select is(
  public.pgtap_record_state(
    '33333333-3333-4333-8333-333333333333',
    public.pgtap_start_as('33333333-3333-4333-8333-333333333333', 'memory'),
    'impulse', 200, null, 'probador'
  ),
  '23514',
  'un nonce de memory no autoriza una partida de impulse'
);

-- ---------------------------------------------------------------------------
-- Tope de 60 partidas por jugador y dia.
-- ---------------------------------------------------------------------------
do $do$
declare
  v_i integer;
begin
  for v_i in 1..60 loop
    perform public.pgtap_record_state(
      '44444444-4444-4444-8444-444444444444',
      public.pgtap_start_as('44444444-4444-4444-8444-444444444444', 'memory'),
      'memory', 1, null, 'probador'
    );
  end loop;
end;
$do$;

select is(
  public.pgtap_record_state(
    '44444444-4444-4444-8444-444444444444',
    public.pgtap_start_as('44444444-4444-4444-8444-444444444444', 'memory'),
    'memory', 1, null, 'probador'
  ),
  '53400',
  'la partida 61 del dia queda fuera por daily_run_cap'
);

-- ---------------------------------------------------------------------------
-- Tope de 100 000 puntos: cinco de 20 000 dejan el dia en el techo.
-- ---------------------------------------------------------------------------
do $do$
declare
  v_i integer;
begin
  for v_i in 1..5 loop
    perform public.pgtap_record_state(
      '55555555-5555-4555-8555-555555555555',
      public.pgtap_start_as('55555555-5555-4555-8555-555555555555', 'impulse'),
      'impulse', 20000, null, 'probador'
    );
  end loop;
end;
$do$;

select is(
  public.pgtap_record_state(
    '55555555-5555-4555-8555-555555555555',
    public.pgtap_start_as('55555555-5555-4555-8555-555555555555', 'impulse'),
    'impulse', 20000, null, 'probador'
  ),
  '53400',
  'pasado el techo de 100 000 puntos la fila no entra'
);

-- ---------------------------------------------------------------------------
-- El camino a PostgREST, cerrado: la tabla ya no acepta al cliente.
-- 42501 = permission denied. Se comprueba el codigo y no el texto, que cambia
-- con el locale de la base.
-- ---------------------------------------------------------------------------
select is(
  public.pgtap_direct_insert_state('66666666-6666-4666-8666-666666666666'),
  '42501',
  'un insert directo como authenticated falla por permisos (42501)'
);

select * from finish();

rollback;
