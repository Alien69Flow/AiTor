
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.skills_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  url text,
  source text,
  category text,
  embedding vector(1536),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.skills_documents TO anon, authenticated;
GRANT ALL ON public.skills_documents TO service_role;

ALTER TABLE public.skills_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read skills_documents"
  ON public.skills_documents FOR SELECT
  USING (true);

CREATE POLICY "Service role manages skills_documents"
  ON public.skills_documents FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS skills_documents_embedding_idx
  ON public.skills_documents USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS skills_documents_category_idx
  ON public.skills_documents (category);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_skills_documents_updated_at ON public.skills_documents;
CREATE TRIGGER update_skills_documents_updated_at
  BEFORE UPDATE ON public.skills_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.match_skills_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  url text,
  source text,
  category text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    d.id, d.title, d.content, d.url, d.source, d.category, d.metadata,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM public.skills_documents d
  WHERE d.embedding IS NOT NULL
    AND 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
$$;
