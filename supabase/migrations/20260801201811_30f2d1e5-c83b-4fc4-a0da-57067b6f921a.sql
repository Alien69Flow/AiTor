-- 1. Restrict SECURITY DEFINER functions from direct client execution
--
-- Solo `has_role`. El REVOKE de `public.consume_credits` no se repite aqui:
-- 20260801122635, unas lineas antes, aplica el mismo bloque con el mismo guard
-- (`to_regprocedure` + EXECUTE), y esto era una copia literal. Dos copias del
-- mismo REVOKE no protegen mas; solo obligan a mantener el guard en dos sitios.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- 2. Explicit write restrictions on user_credits
--
-- Aqui no queda nada, y el bloque que habia tampoco podia hacer nada: la tabla
-- la crea 20261029120000_user_credits.sql, meses despues de este fichero, asi
-- que en una base limpia `to_regclass('public.user_credits')` siempre es NULL;
-- y en un proyecto donde la tabla ya existe esta migracion esta aplicada desde
-- antes y no se vuelve a ejecutar. Los REVOKE, los GRANT y las dos politicas
-- viven en la migracion que crea la tabla, junto al CREATE TABLE: es donde se
-- leen y donde se aplican.

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
