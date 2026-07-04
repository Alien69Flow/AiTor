// Agentic Workflows router — Claude Sonnet 4 with tool-use over project edge functions.
// Streams an OpenAI-compatible SSE response.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const GROK_KEY = Deno.env.get("GROK_API_KEY");
const LIVEUAMAP_KEY = Deno.env.get("LIVEUAMAP_API_KEY");
const GITHUB_PAT = Deno.env.get("GITHUB_PAT");
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

const MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `You are AI Tor.v69's autonomous routing agent. You receive a user request and decide which internal tool(s) to invoke to gather data, then synthesise a concise tactical answer in the user's language. Prefer the smallest set of tool calls. Always cite the tool source briefly.

RAG POLICY:
- For any question about AI Tor, the AlienFlowSpace DAO, internal docs, skills or previously ingested content, ALWAYS call skills_rag_search FIRST.
- When skills_rag_search returns matches, cite each with its title and similarity score inline (e.g. "[fuente: <title> · sim 0.82]") and quote briefly.
- When skills_rag_search returns 0 matches, tell the user the knowledge base has no relevant context yet and suggest ingesting sources via the Skills tab. Then fall back to the general web tools (grok_search / firecrawl_search) if appropriate.`;

type Tool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

const TOOLS: Tool[] = [
  {
    name: "crypto_price",
    description: "Current USD prices and 24h change for a list of CoinGecko coin ids (e.g. bitcoin, ethereum).",
    input_schema: { type: "object", properties: { coinIds: { type: "array", items: { type: "string" } } }, required: ["coinIds"] },
  },
  {
    name: "crypto_signals",
    description: "Aggregated crypto/prediction-market signals from Polymarket and CoinGecko trending.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "crypto_feed",
    description: "Crypto market movers (action=movers) or curated news (action=news).",
    input_schema: { type: "object", properties: { action: { type: "string", enum: ["movers", "news"] } }, required: ["action"] },
  },
  {
    name: "firecrawl_search",
    description: "Web search via Firecrawl. Use for live news, facts, OSINT lookups.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" }, limit: { type: "number" }, lang: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "firecrawl_osint",
    description: "Curated OSINT feed of breaking news titles from tracked sources.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "osint_aggregator",
    description: "Categorised tactical intel feed (finance, intel, conflict, geopolitical, logistics, cryptozoo).",
    input_schema: {
      type: "object",
      properties: { categories: { type: "array", items: { type: "string" } }, limit: { type: "number" } },
    },
  },
  {
    name: "openweather",
    description: "Current weather (clouds, rain, temp, wind) for one lat/lon point.",
    input_schema: {
      type: "object",
      properties: { lat: { type: "number" }, lon: { type: "number" } },
      required: ["lat", "lon"],
    },
  },
  {
    name: "noaa_space_weather",
    description: "NOAA Kp index, solar storm and geomagnetic storm status.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "ufo_feed",
    description: "Latest UAP / UFO sightings stored in the database.",
    input_schema: { type: "object", properties: { limit: { type: "number" } } },
  },
  {
    name: "grok_search",
    description: "Real-time web-aware answer from xAI Grok. Use for breaking news, X/Twitter sentiment, or when other sources are stale.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "liveuamap_feed",
    description: "Liveuamap geopolitical conflict feed (Ukraine, Middle East, etc.). Returns recent geolocated events.",
    input_schema: {
      type: "object",
      properties: { region: { type: "string", description: "e.g. ukraine, israel, syria" }, limit: { type: "number" } },
    },
  },
  {
    name: "github_repo",
    description: "Query a public or owned GitHub repo via PAT. Actions: 'get_repo', 'list_files' (path), 'read_file' (path), 'search_code' (q).",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["get_repo", "list_files", "read_file", "search_code"] },
        owner: { type: "string" },
        repo: { type: "string" },
        path: { type: "string" },
        q: { type: "string" },
      },
      required: ["action"],
    },
  },
  {
    name: "skills_rag_search",
    description: "Semantic search over the AI Tor knowledge base (pgvector). Use this BEFORE answering questions about AI Tor, the DAO, internal skills, docs, or anything the user may have previously ingested.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        match_count: { type: "number", description: "default 5, max 10" },
      },
      required: ["query"],
    },
  },
];

async function callInternal(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
      "Content-Type": "application/json",
    },
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text.slice(0, 2000) }; }
}

async function runTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case "crypto_price":
        return await callInternal("crypto-price", { method: "POST", body: JSON.stringify(input) });
      case "crypto_signals":
        return await callInternal("crypto-signals", { method: "POST", body: "{}" });
      case "crypto_feed":
        return await callInternal("crypto-feed", { method: "POST", body: JSON.stringify(input) });
      case "firecrawl_search": {
        if (!FIRECRAWL_KEY) return { error: "FIRECRAWL_API_KEY missing" };
        const r = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            query: input.query,
            limit: input.limit ?? 5,
            lang: input.lang ?? "es",
            scrapeOptions: { formats: ["markdown"] },
          }),
        });
        return await r.json();
      }
      case "firecrawl_osint":
        return await callInternal("firecrawl-osint", { method: "POST", body: "{}" });
      case "osint_aggregator":
        return await callInternal("osint-aggregator", { method: "POST", body: JSON.stringify(input) });
      case "openweather": {
        const { lat, lon } = input as { lat: number; lon: number };
        return await callInternal(`openweather?lat=${lat}&lon=${lon}`, { method: "GET" });
      }
      case "noaa_space_weather":
        return await callInternal("noaa-space-weather", { method: "GET" });
      case "ufo_feed":
        return await callInternal("ufo-feed", { method: "POST", body: JSON.stringify(input) });
      case "grok_search": {
        if (!GROK_KEY) return { error: "GROK_API_KEY missing" };
        const r = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${GROK_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "grok-3",
            messages: [
              { role: "system", content: "You are a concise real-time research assistant. Cite sources inline." },
              { role: "user", content: String(input.query ?? "") },
            ],
            max_tokens: 800,
          }),
        });
        const j = await r.json();
        return { answer: j?.choices?.[0]?.message?.content ?? j };
      }
      case "liveuamap_feed": {
        if (!LIVEUAMAP_KEY) return { error: "LIVEUAMAP_API_KEY missing" };
        const region = String(input.region ?? "ukraine");
        const limit = Number(input.limit ?? 10);
        const r = await fetch(`https://liveuamap.com/api/v1/events?region=${encodeURIComponent(region)}&limit=${limit}`, {
          headers: { Authorization: `Bearer ${LIVEUAMAP_KEY}` },
        });
        const text = await r.text();
        try { return JSON.parse(text); } catch { return { raw: text.slice(0, 4000) }; }
      }
      case "github_repo": {
        if (!GITHUB_PAT) return { error: "GITHUB_PAT missing" };
        const { action, owner, repo, path, q } = input as Record<string, string>;
        const h = { Authorization: `Bearer ${GITHUB_PAT}`, "User-Agent": "AITor-Agent", Accept: "application/vnd.github+json" };
        let url = "";
        switch (action) {
          case "get_repo": url = `https://api.github.com/repos/${owner}/${repo}`; break;
          case "list_files": url = `https://api.github.com/repos/${owner}/${repo}/contents/${path ?? ""}`; break;
          case "read_file": url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`; break;
          case "search_code": url = `https://api.github.com/search/code?q=${encodeURIComponent(q)}`; break;
          default: return { error: `Unknown github action ${action}` };
        }
        const r = await fetch(url, { headers: h });
        const j = await r.json();
        if (action === "read_file" && j?.content && j?.encoding === "base64") {
          try { return { path: j.path, content: atob(j.content.replace(/\n/g, "")).slice(0, 8000) }; } catch { return j; }
        }
        return j;
      }
      case "skills_rag_search":
      {
        const raw = await callInternal("skills-ingest", {
          method: "POST",
          body: JSON.stringify({ action: "search", query: input.query, match_count: input.match_count ?? 5 }),
        }) as { success?: boolean; matches?: Array<Record<string, unknown>>; error?: string };
        const matches = raw?.matches ?? [];
        if (!matches.length) {
          return {
            success: true,
            matches: [],
            fallback: "Empty knowledge base for this query. Suggest the user ingest relevant URLs via the Skills tab (skills-ingest). Consider calling firecrawl_search or grok_search as a fallback.",
          };
        }
        // Compact match payload so Claude cites cleanly.
        return {
          success: true,
          count: matches.length,
          matches: matches.map((m) => ({
            title: m.title,
            url: m.url,
            source: m.source,
            category: m.category,
            similarity: typeof m.similarity === "number" ? Number((m.similarity as number).toFixed(3)) : m.similarity,
            snippet: typeof m.content === "string" ? (m.content as string).slice(0, 600) : m.content,
          })),
        };
      }
      default:
        return { error: `Unknown tool ${name}` };
    }
  } catch (e) {
    return { error: String(e).slice(0, 300) };
  }
}

async function anthropic(messages: unknown[], stream: boolean) {
  return await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY!,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      system: SYSTEM_PROMPT,
      max_tokens: 4096,
      tools: TOOLS,
      messages,
      stream,
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authFail = await requireUser(req);
    if (authFail) return authFail;
    if (!ANTHROPIC_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = await req.json().catch(() => ({}));
    const userMessages: Array<{ role: string; content: string }> = body.messages ?? [];
    if (!Array.isArray(userMessages) || userMessages.length === 0) {
      return new Response(JSON.stringify({ error: "messages[] required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert OpenAI-style messages to Anthropic
    const messages: unknown[] = userMessages
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({ role: m.role, content: m.content }));

    // Tool-use loop (non-streaming) until model returns final text, then stream that text.
    let finalText = "";
    for (let step = 0; step < 6; step++) {
      const res = await anthropic(messages, false);
      if (!res.ok) {
        const errText = await res.text();
        return new Response(JSON.stringify({ error: "Anthropic error", detail: errText.slice(0, 500) }), {
          status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await res.json();
      const blocks: Array<Record<string, unknown>> = data?.content ?? [];
      const toolUses = blocks.filter(b => b.type === "tool_use");
      const textBlocks = blocks.filter(b => b.type === "text").map(b => (b as { text: string }).text);

      if (toolUses.length === 0 || data?.stop_reason === "end_turn") {
        finalText = textBlocks.join("\n\n") || "(sin respuesta)";
        break;
      }

      // Add assistant message with tool_use blocks
      messages.push({ role: "assistant", content: blocks });

      // Execute tools and append tool_result
      const toolResults = await Promise.all(
        toolUses.map(async (t) => {
          const result = await runTool(t.name as string, (t.input as Record<string, unknown>) ?? {});
          return {
            type: "tool_result",
            tool_use_id: t.id,
            content: JSON.stringify(result).slice(0, 12000),
          };
        }),
      );
      messages.push({ role: "user", content: toolResults });
    }

    // Stream final text as OpenAI-compatible SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // chunk by ~80 chars for smoother streaming
        const size = 80;
        for (let i = 0; i < finalText.length; i += size) {
          const piece = finalText.slice(i, i + size);
          const chunk = { choices: [{ delta: { content: piece }, index: 0 }] };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err).slice(0, 300) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});