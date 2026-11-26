-- Temporal: mutacion para comprobar que las suites de pgTAP detectan regresiones.
-- Vive solo en esta rama de prueba; no va a main.
--
-- Dos roturas a proposito, una por suite:
--
--   1. El portero de `game_scores` desaparece. Sin trigger, nada impide meter
--      puntos que no calculo la base ni pasarse de los topes diarios. Lo tiene
--      que ver `games_scores_guard.sql` (plan 19).
--
--   2. `authenticated` deja de poder emitir nonces. Sin ese permiso no se
--      puede empezar una partida. Lo tiene que ver `record_game_run.sql`
--      (plan 12).
--
-- Si el job `supabase pgTAP` se queda en verde con esto, las suites no estan
-- probando lo que dicen.

drop trigger if exists game_scores_guard on public.game_scores;

revoke execute on function public.start_game_run(text) from authenticated;
