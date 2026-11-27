-- Mutación temporal de la rama `prueba/mutacion-sin-grant`: deja
-- `start_game_run` sin EXECUTE para nadie y comprueba que
-- `supabase/tests/record_game_run.sql` se pone rojo. No se fusiona; la rama se
-- descarta.
--
-- El `revoke ... from authenticated` a secas no cambia nada: PostgreSQL
-- concede EXECUTE a PUBLIC en cada función nueva y esa concesión sigue viva,
-- así que `authenticated` conserva el permiso por herencia. Hay que retirar
-- también PUBLIC (y anon) para que el permiso desaparezca de verdad.
revoke execute on function public.start_game_run(text)
  from public, anon, authenticated;
