// Skills ingest: scrape URL with Firecrawl, embed with OpenAI, store in skills_documents.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

async function requireUser(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supa = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supa.auth.getUser(token);
  if (error || !data?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

async function scrape(url: string): Promise<{ title: string; content: string; metadata: Record<string, unknown> } | null> {
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  const data = json?.data ?? json;
  const content: string = data?.markdown ?? data?.content ?? "";
  const title: string = data?.metadata?.title ?? data?.title ?? url;
  return { title, content, metadata: data?.metadata ?? {} };
}

async function embed(text: string): Promise<number[] | null> {
  // Prefer Lovable AI Gateway (reliable); fall back to direct OpenAI if missing.
  const useGateway = !!LOVABLE_KEY;
  const url = useGateway
    ? "https://ai.gateway.lovable.dev/v1/embeddings"
    : "https://api.openai.com/v1/embeddings";
  const key = useGateway ? LOVABLE_KEY : OPENAI_KEY;
  const model = useGateway ? "openai/text-embedding-3-small" : "text-embedding-3-small";
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: text.slice(0, 30000) }),
  });
  if (!res.ok) {
    console.error("embed failed", res.status, (await res.text()).slice(0, 300));
    return null;
  }
  const json = await res.json();
  return json?.data?.[0]?.embedding ?? null;
}

function chunk(text: string, size = 2000, overlap = 200): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size - overlap) {
    out.push(text.slice(i, i + size));
    if (i + size >= text.length) break;
  }
  return out.length ? out : [text];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const action: string = body.action ?? "ingest";

    // SEARCH mode: embed query and run pgvector match RPC. Used by agenticworkflows
    // (service-role bearer) and other internal tools — no end-user auth needed.
    if (action === "search") {
      if (!OPENAI_KEY) {
        return new Response(JSON.stringify({ error: "OPENAI_API_KEY missing" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const query: string = body.query ?? "";
      const match_count: number = Math.min(Math.max(Number(body.match_count) || 5, 1), 10);
      const match_threshold: number = typeof body.match_threshold === "number" ? body.match_threshold : 0.3;
      if (!query.trim()) {
        return new Response(JSON.stringify({ error: "query required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const embedding = await embed(query);
      if (!embedding) {
        return new Response(JSON.stringify({ error: "embed failed" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log("[skills-ingest.search]", JSON.stringify({
        query: query.slice(0, 120),
        match_count,
        match_threshold,
        embedding_dims: embedding.length,
      }));
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
      const { data, error } = await supabase.rpc("match_skills_documents", {
        query_embedding: embedding as unknown as string,
        match_threshold,
        match_count,
      });
      if (error) {
        console.error("[skills-ingest.search] rpc error", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const matches = data ?? [];
      console.log("[skills-ingest.search] matched", matches.length, "docs");
      return new Response(JSON.stringify({
        success: true,
        query,
        match_count,
        match_threshold,
        matches,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authFail = await requireUser(req);
    if (authFail) return authFail;
    if (!FIRECRAWL_KEY || !OPENAI_KEY) {
      return new Response(JSON.stringify({ error: "Missing FIRECRAWL_API_KEY or OPENAI_API_KEY" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const url: string | undefined = body.url;
    const source: string = body.source ?? "manual";
    const category: string = body.category ?? "skill";
    if (!url || !/^https?:\/\//.test(url)) {
      return new Response(JSON.stringify({ error: "Valid url required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scraped = await scrape(url);
    if (!scraped || !scraped.content) {
      return new Response(JSON.stringify({ error: "Scrape failed or empty" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const chunks = chunk(scraped.content);
    const inserted: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const piece = chunks[i];
      const embedding = await embed(piece);
      if (!embedding) continue;
      const { data, error } = await supabase
        .from("skills_documents")
        .insert({
          title: chunks.length > 1 ? `${scraped.title} (${i + 1}/${chunks.length})` : scraped.title,
          content: piece,
          url,
          source,
          category,
          embedding: embedding as unknown as string,
          metadata: { ...scraped.metadata, chunk: i, total: chunks.length },
        })
        .select("id")
        .single();
      if (!error && data?.id) inserted.push(data.id);
    }

    return new Response(JSON.stringify({ success: true, inserted: inserted.length, ids: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err).slice(0, 300) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});