
CREATE TABLE public.uap_sightings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location text NOT NULL,
  date_reported date,
  type text,
  severity text DEFAULT 'signal',
  description text,
  source text,
  source_url text,
  lat float,
  lon float,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.uap_sightings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.uap_sightings
  FOR SELECT TO anon, authenticated USING (true);
