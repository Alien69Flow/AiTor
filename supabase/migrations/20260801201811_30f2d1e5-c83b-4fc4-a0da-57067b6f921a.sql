-- 1. Restrict SECURITY DEFINER functions from direct client execution
--
-- `consume_credits`: su REVOKE/GRANT vive en 20260801122635, que corre antes,
-- porque la función sólo existe en el proyecto hospedado. Aquí no se repite:
-- en una base nueva no está, y en la hospedada esta versión ya se aplicó, así
-- que el bloque condicionado anterior no ejecutaba nada en ningún escenario.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- 2. Explicit write restrictions on user_credits
--
-- Los candados de esta tabla viven en 20261029120000_user_credits.sql, la
-- migración que la crea, meses después de este fichero. Aquí la tabla no
-- existe todavía, así que el bloque condicionado que había sólo podía dejar un
-- NOTICE en una base nueva.

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
