ALTER TABLE public.uap_sightings ADD COLUMN IF NOT EXISTS category text DEFAULT 'uap';

ALTER PUBLICATION supabase_realtime ADD TABLE public.uap_sightings;