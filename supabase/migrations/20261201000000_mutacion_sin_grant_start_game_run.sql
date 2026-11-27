-- Mutación temporal de la rama `prueba/mutacion-sin-grant`: quita el GRANT de
-- `start_game_run` a `authenticated` para comprobar que
-- `supabase/tests/record_game_run.sql` se pone rojo. No se fusiona; la rama se
-- descarta.
revoke execute on function public.start_game_run(text) from authenticated;
