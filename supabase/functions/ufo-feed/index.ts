
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      return new Response(JSON.stringify({ success: false, error: 'Firecrawl not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Scrape NUFORC recent reports
    console.log('Scraping NUFORC...');
    const nuforcResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://nuforc.org/webreports/ndxevent.html',
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    });
    const nuforcData = await nuforcResponse.json();

    // 2. Search for recent UAP/UFO news
    console.log('Searching UAP news...');
    const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'UAP UFO sighting report 2026',
        limit: 10,
        tbs: 'qdr:w',
      }),
    });
    const searchData = await searchResponse.json();

    const sightings: any[] = [];

    // Parse NUFORC markdown for sighting entries
    const nuforcMarkdown = nuforcData?.data?.markdown || nuforcData?.markdown || '';
    if (nuforcMarkdown) {
      // NUFORC lists dates/locations - extract what we can
      const lines = nuforcMarkdown.split('\n').filter((l: string) => l.trim());
      const dateLocationRegex = /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+)/;
      let count = 0;
      for (const line of lines) {
        if (count >= 15) break;
        const match = line.match(dateLocationRegex);
        if (match) {
          sightings.push({
            location: match[2].trim().substring(0, 100),
            date_reported: formatDate(match[1]),
            type: 'NUFORC Report',
            severity: 'signal',
            description: `NUFORC report from ${match[2].trim()}`,
            source: 'NUFORC',
            source_url: 'https://nuforc.org/webreports/ndxevent.html',
          });
          count++;
        }
      }
    }

    // Parse search results as news-based sightings
    const searchResults = searchData?.data || searchData?.results || [];
    if (Array.isArray(searchResults)) {
      for (const result of searchResults.slice(0, 10)) {
        sightings.push({
          location: 'Global',
          date_reported: new Date().toISOString().split('T')[0],
          type: 'News Report',
          severity: 'investigating',
          description: (result.description || result.title || 'UAP news report').substring(0, 500),
          source: 'Web Search',
          source_url: result.url || '',
        });
      }
    }

    // Insert into database (upsert by clearing old + inserting new)
    if (sightings.length > 0) {
      // Delete old cached sightings
      await supabase.from('uap_sightings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      const { error } = await supabase.from('uap_sightings').insert(sightings);
      if (error) {
        console.error('Insert error:', error);
      }
    }

    console.log(`Processed ${sightings.length} sightings`);

    return new Response(JSON.stringify({ 
      success: true, 
      count: sightings.length,
      sources: { nuforc: nuforcMarkdown.length > 0, search: searchResults.length > 0 }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ufo-feed:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function formatDate(dateStr: string): string {
  try {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      let year = parts[2];
      if (year.length === 2) year = '20' + year;
      return `${year}-${month}-${day}`;
    }
  } catch {}
  return new Date().toISOString().split('T')[0];
}
