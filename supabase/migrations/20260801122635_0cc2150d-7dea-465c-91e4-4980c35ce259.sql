REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- public.consume_credits solo existe en el proyecto hospedado: ninguna migracion
-- del repo la crea, asi que en una base limpia este REVOKE abortaba la cadena
-- entera con SQLSTATE 42883 antes de llegar a ninguna prueba. Se aplica solo
-- cuando la funcion esta: donde no esta, no hay nada que revocar.
DO $$
BEGIN
  IF to_regprocedure('public.consume_credits(uuid, integer)') IS NULL THEN
    RAISE NOTICE 'public.consume_credits(uuid, integer) no existe en esta base: nada que revocar';
    RETURN;
  END IF;

  EXECUTE 'REVOKE ALL ON FUNCTION public.consume_credits(uuid, integer) FROM PUBLIC, anon, authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.consume_credits(uuid, integer) TO service_role';
END $$;
