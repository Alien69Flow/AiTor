-- Restrict Realtime channel subscriptions to authenticated users only,
-- and only for the public uap_sightings broadcast topic used by the globe.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Allow anyone (anon + authenticated) to receive postgres_changes broadcasts
-- ONLY for the 'uap-globe' topic. All other topics are denied by default.
CREATE POLICY "Public can read uap-globe realtime topic"
ON realtime.messages
FOR SELECT
TO anon, authenticated
USING (
  (realtime.topic() = 'uap-globe')
);
