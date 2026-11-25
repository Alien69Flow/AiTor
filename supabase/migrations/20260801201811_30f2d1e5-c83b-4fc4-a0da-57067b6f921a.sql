-- 1. Restrict SECURITY DEFINER functions from direct client execution
--
-- `public.consume_credits` solo existe en el proyecto hospedado: ninguna
-- migracion del repo la crea, asi que en una base limpia este REVOKE abortaba
-- la cadena entera con SQLSTATE 42883 antes de llegar a ninguna prueba. Se
-- aplica solo cuando la funcion esta: donde no esta, no hay nada que revocar.
DO $$
BEGIN
  IF to_regprocedure('public.consume_credits(uuid, integer)') IS NULL THEN
    RAISE NOTICE 'public.consume_credits(uuid, integer) no existe en esta base: nada que revocar';
    RETURN;
  END IF;

  EXECUTE 'REVOKE ALL ON FUNCTION public.consume_credits(uuid, integer) FROM PUBLIC, anon, authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.consume_credits(uuid, integer) TO service_role';
END $$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- 2. Explicit write restrictions on user_credits
--
-- La tabla la crea 20261029120000_user_credits.sql, meses despues de este
-- fichero: en una base limpia este bloque abortaba con SQLSTATE 42P01. Se
-- aplica aqui cuando ya existe (proyecto hospedado); las mismas sentencias
-- estan tambien en la migracion que la crea, que es la que manda en una base
-- nueva.
DO $$
BEGIN
  IF to_regclass('public.user_credits') IS NULL THEN
    RAISE NOTICE 'public.user_credits no existe todavia: los candados se aplican en 20261029120000';
    RETURN;
  END IF;

  EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.user_credits FROM anon, authenticated';
  EXECUTE 'GRANT SELECT ON public.user_credits TO authenticated';
  EXECUTE 'GRANT ALL ON public.user_credits TO service_role';
  EXECUTE 'CREATE POLICY "Service role manages user_credits" ON public.user_credits FOR ALL TO service_role USING (true) WITH CHECK (true)';
  EXECUTE 'CREATE POLICY "No client writes to user_credits" ON public.user_credits AS RESTRICTIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (false)';
END $$;

-- 3. Explicit write restrictions on user_roles
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

CREATE POLICY "Service role manages user_roles"
ON public.user_roles FOR ALL TO service_role
USING (true) WITH CHECK (true);
CREATE POLICY "No client writes to user_roles"
ON public.user_roles AS RESTRICTIVE FOR ALL TO anon, authenticated
USING (true) WITH CHECK (false);
