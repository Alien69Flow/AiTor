-- Una sola puerta para escribir en `game_scores`: `record_game_run`.
--
-- Cierra del todo el camino directo que quedaba abierto:
--
--   · La politica `players insert their own runs` permitia insertar la fila
--     propia por PostgREST con la clave publicable y la sesion del navegador.
--   · `consume_game_run` estaba concedida a `authenticated`, asi que cualquiera
--     podia gastar un nonce sin jugar y luego insertar a mano.
--   · El calculo de puntos y la insercion eran dos viajes distintos, asi que un
--     fallo entre medias quemaba el nonce y perdia la partida.
--
-- Ahora el cliente no escribe en la tabla: llama a `record_game_run`, que en
-- una sola transaccion consume el nonce, recorta la marca, recalcula los puntos,
-- inserta y devuelve la fila. Si algo falla, no se gasta nada.
--
-- El trigger `game_scores_guard` sigue ahi como red de seguridad (nonce usado,
-- puntos coherentes, topes diarios), pero deja de ser la unica barrera.

-- 1. La tabla deja de aceptar escrituras directas.
drop policy if exists "players insert their own runs" on public.game_scores;
revoke insert on public.game_scores from anon, authenticated;

-- 2. El consumo del nonce deja de ser una herramienta del cliente: solo lo usa
--    la funcion de abajo, que corre como su dueno.
revoke all on function public.consume_game_run(uuid, text) from public, anon, authenticated;

/**
 * Registra una partida: consume el nonce, calcula puntos e inserta.
 *
 * `p_handle` es solo una etiqueta visible; se sanea aqui igual que en
 * `api/league.ts` (`handleFromClaims`) para que la columna cumpla su check
 * aunque llegue basura.
 */
create or replace function public.record_game_run(
  p_nonce uuid,
  p_game text,
  p_score integer,
  p_daily date,
  p_handle text
)
returns table (id uuid, game text, score integer, points integer, daily date, season text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_score integer;
  v_points integer;
  v_handle text;
  v_season text := to_char((now() at time zone 'utc'), 'YYYY-MM');
  v_id uuid;
begin
  if v_user is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if p_game not in ('impulse', 'memory', 'reactor') then
    raise exception 'unknown_game' using errcode = '22023';
  end if;

  -- Misma tabla que `LEAGUE_POINTS` + `MAX_SCORE` en api/league.ts.
  v_score := least(
    greatest(coalesce(p_score, 0), 0),
    case p_game when 'impulse' then 20000 when 'memory' then 12 else 2000 end
  );
  v_points := case p_game when 'memory' then v_score * 40 else v_score end;

  -- Etiqueta visible: letras, numeros y tres separadores, entre 2 y 32.
  v_handle := left(regexp_replace(coalesce(p_handle, ''), '[^a-zA-Z0-9._-]', '', 'g'), 32);
  if length(v_handle) < 2 then
    v_handle := 'jugador';
  end if;

  -- Consumo: si ya se uso, caduco o no es de este juego, no hay fila.
  if not public.consume_game_run(p_nonce, p_game) then
    raise exception 'nonce_invalid' using errcode = '23514';
  end if;

  insert into public.game_scores as s
    (user_id, handle, game, score, points, season, daily, run_nonce)
  values
    (v_user, v_handle, p_game, v_score, v_points, v_season, p_daily, p_nonce)
  returning s.id into v_id;

  return query
    select s.id, s.game, s.score, s.points, s.daily, s.season
      from public.game_scores s
     where s.id = v_id;
end;
$$;

revoke all on function public.record_game_run(uuid, text, integer, date, text) from public, anon;
grant execute on function public.record_game_run(uuid, text, integer, date, text) to authenticated;
