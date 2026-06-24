// OSINT Aggregator: Firecrawl Search v2 with tactical categorization
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Category =
  | "finance"
  | "intel"
  | "conflict"
  | "geopolitical"
  | "logistics"
  | "cryptozoo"
  | "convergence";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

interface IntelEvent {
  id: string;
  title: string;
  url: string;
  source: string;
  category: Category;
  severity: Severity;
  summary?: string;
  timestamp: string;
}

const QUERIES: { query: string; category: Category }[] = [
  { query: "breaking crypto market crash bitcoin ethereum", category: "finance" },
  { query: "UAP UFO sighting pentagon disclosure", category: "intel" },
  { query: "military conflict strike attack breaking", category: "conflict" },
  { query: "geopolitical sanctions diplomatic crisis", category: "geopolitical" },
  { query: "supply chain shipping port disruption", category: "logistics" },
  { query: "cryptid sighting unexplained creature", category: "cryptozoo" },
];

function classifySeverity(text: string): Severity {
  const t = text.toLowerCase();
  if (/breaking|critical|emergency|attack|crash|nuclear|war|killed/.test(t)) return "CRITICAL";
  if (/alert|urgent|crisis|strike|sanctions|breach/.test(t)) return "HIGH";
  if (/warning|tension|protest|decline/.test(t)) return "MEDIUM";
  return "LOW";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "FIRECRAWL_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const categories: Category[] = body.categories || QUERIES.map((q) => q.category);
    const limit: number = Math.min(body.limit || 5, 10);

    const targets = QUERIES.filter((q) => categories.includes(q.category));
    const events: IntelEvent[] = [];

    await Promise.all(
      targets.map(async ({ query, category }) => {
        try {
          const res = await fetch("https://api.firecrawl.dev/v2/search", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query,
              limit,
              tbs: "qdr:d",
              lang: "en",
            }),
          });

          if (!res.ok) {
            console.error(`Firecrawl ${category} failed: ${res.status}`);
            return;
          }

          const data = await res.json();
          const results = data?.data?.web || data?.data || data?.web || [];

          for (const r of results.slice(0, limit)) {
            const title = r.title || r.url || "Untitled";
            const url = r.url || "";
            const summary = r.description || r.snippet || "";
            const source = (() => {
              try {
                return new URL(url).hostname.replace("www.", "");
              } catch {
                return "unknown";
              }
            })();

            events.push({
              id: `${category}-${url}-${title}`.slice(0, 120),
              title: title.slice(0, 200),
              url,
              source,
              category,
              severity: classifySeverity(`${title} ${summary}`),
              summary: summary.slice(0, 280),
              timestamp: new Date().toISOString(),
            });
          }
        } catch (e) {
          console.error(`Error fetching ${category}:`, e);
        }
      })
    );

    // Sort by severity
    const sevOrder: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    events.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

    return new Response(
      JSON.stringify({
        success: true,
        count: events.length,
        events,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("osint-aggregator error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
