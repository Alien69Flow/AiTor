import { guardPublic } from "../_shared/guard.ts";
import { firecrawlSearch } from "../_shared/firecrawl.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Búsqueda web con Firecrawl **v2**.
 *
 * v2 mueve los resultados a `data.web`, así que esta función devuelve además
 * `results` ya aplanado: quien lea `results` no depende de la forma cruda, y
 * quien lea `data` sigue viendo el cuerpo original para lo que quiera sacar
 * (`creditsUsed`, avisos…).
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const blocked = guardPublic(req, corsHeaders, 10);
  if (blocked) return blocked;

  try {
    const { query, options } = await req.json();

    if (!query || typeof query !== 'string' || query.length > 300) {
      return new Response(
        JSON.stringify({ success: false, error: 'A valid query (max 300 chars) is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const limit = Math.min(Math.max(Number(options?.limit) || 5, 1), 10);

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Searching:', query);

    const reply = await firecrawlSearch(apiKey, {
      query,
      limit,
      country: options?.country,
      tbs: options?.tbs,
      sources: ['web'],
      // Sin esto, v2 devuelve url/título/descripción y nada de contenido.
      scrapeOptions: options?.scrapeOptions || { formats: ['markdown'] },
    });

    if (!reply.ok) {
      console.error('Firecrawl API error:', reply.payload);
      return new Response(
        JSON.stringify({
          success: false,
          error: reply.error || `Request failed with status ${reply.status}`,
        }),
        { status: reply.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = (reply.payload as { data?: unknown } | null)?.data ?? null;

    console.log('Search successful, results:', reply.results.length);
    return new Response(
      JSON.stringify({ success: true, count: reply.results.length, results: reply.results, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error searching:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to search';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
