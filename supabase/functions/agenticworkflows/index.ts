// Agentic Workflows router — Claude Sonnet 4 with tool-use over project edge functions.
// Streams an OpenAI-compatible SSE response.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `You are AI Tor.v69's autonomous routing agent. You receive a user request and decide which internal tool(s) to invoke to gather data, then synthesise a concise tactical answer in the user's language. Prefer the smallest set of tool calls. Always cite the tool source briefly.`;

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