DELETE FROM public.uap_sightings a
USING public.uap_sightings b
WHERE a.source_url = b.source_url
  AND a.source_url IS NOT NULL
  AND a.source_url <> ''
  AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS uap_sightings_source_url_uniq
  ON public.uap_sightings (source_url)
  WHERE source_url IS NOT NULL AND source_url <> '';