const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const names = [
    'GEMINI_API_KEY', 'VITE_GEMINI_API_KEY',
    'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GROK_API_KEY',
    'FIRECRAWL_API_KEY', 'GITHUB_PAT', 'LIVEUAMAP_API_KEY',
    'VITE_CESIUM_TOKEN', 'CESIUM_ION_TOKEN',
    'LOVABLE_API_KEY', 'SUPABASE_URL',
  ];
  const status: Record<string, { present: boolean; len: number; fp: string }> = {};
  for (const n of names) {
    const v = Deno.env.get(n) ?? '';
    status[n] = {
      present: v.length > 0,
      len: v.length,
      fp: v ? `${v.slice(0, 3)}…${v.slice(-3)}` : '',
    };
  }
  return new Response(
    JSON.stringify({
      project_url: Deno.env.get('SUPABASE_URL') ?? null,
      now: new Date().toISOString(),
      secrets: status,
    }, null, 2),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});