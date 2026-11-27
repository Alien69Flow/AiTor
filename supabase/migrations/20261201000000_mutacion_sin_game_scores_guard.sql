-- Mutación temporal de la rama `prueba/mutacion-sin-guard`: quita el portero
-- de `game_scores` para comprobar que `supabase/tests/games_scores_guard.sql`
-- se pone rojo. No se fusiona; la rama se descarta.
drop trigger if exists game_scores_guard on public.game_scores;
