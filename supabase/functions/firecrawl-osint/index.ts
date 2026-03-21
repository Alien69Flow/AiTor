import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface OsintSource {
  name: string;
  url: string;
}

const OSINT_SOURCES: OsintSource[] = [
  { name: "ZeroHedge", url: "https://www.zerohedge.com" },
  { name: "The Block", url: "https://www.theblock.co" },
  { name: "Crypto Briefing", url: "https://cryptobriefing.com" },
];

interface NewsItem {
  title: string;
  source: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  timestamp: string;
  url: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const news: NewsItem[] = [];

    for (const source of OSINT_SOURCES) {
      try {
        const response = await fetch(source.url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });

        if (!response.ok) continue;

        const html = await response.text();

        const titleRegex = /<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi;
        const matches = html.match(titleRegex);

        if (matches) {
          matches.slice(0, 3).forEach((match) => {
            const title = match.replace(/<[^>]+>/g, "").slice(0, 100);

            const severity: ("CRITICAL" | "HIGH" | "MEDIUM" | "LOW")[] = [
              "CRITICAL",
              "HIGH",
              "MEDIUM",
            ];
            const hasAlert = title.match(
              /alert|critical|breach|attack|crash|emergency|urgent/i
            );
            const sev = hasAlert
              ? severity[0]
              : severity[Math.floor(Math.random() * severity.length)];

            news.push({
              title,
              source: source.name,
              severity: sev,
              timestamp: new Date().toISOString(),
              url: source.url,
            });
          });
        }
      } catch {
        console.error(`Failed to fetch from ${source.name}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: news.length,
        news: news.slice(0, 5),
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
