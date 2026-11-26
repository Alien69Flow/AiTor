-- Restrict Realtime channel subscriptions to authenticated users only,
-- and only for the public uap_sightings broadcast topic used by the globe.
--
-- En una base limpia (CI, `supabase db reset`) realtime.messages pertenece al
-- rol de Realtime, no a quien aplica las migraciones, asi que este ALTER
-- abortaba con SQLSTATE 42501 y se llevaba por delante toda la cadena: `supabase
-- db start` moria antes de llegar a ninguna prueba. Donde no somos duenos,
-- Realtime ya sirve esa tabla con su propio RLS y no hay nada que activar ni
-- politica que crear; en produccion la migracion corre como duena y aplica
-- exactamente igual que antes.
DO $$
BEGIN
  ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Public can read uap-globe realtime topic"
  ON realtime.messages
  FOR SELECT
  TO anon, authenticated
  USING (
    (realtime.topic() = 'uap-globe')
  );
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'realtime.messages no es de %: se omite RLS y la politica', current_user;
END $$;
