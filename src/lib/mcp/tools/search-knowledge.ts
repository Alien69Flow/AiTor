import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "search_knowledge",
  title: "Search AI Tor knowledge base",
  description:
    "Full-text substring search across AI Tor's skills knowledge base (titles and content). Returns matching documents with title, source, category and URL.",
  inputSchema: {
    query: z.string().trim().min(2).describe("Search text. Matched against title and content."),
    limit: z.number().int().min(1).max(20).optional().describe("Maximum results (default 5)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const pattern = `%${query.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    const { data, error } = await supabaseForUser(ctx)
      .from("skills_documents")
      .select("id, title, source, category, url, content")
      .or(`title.ilike.${pattern},content.ilike.${pattern}`)
      .limit(limit ?? 5);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const results = (data ?? []).map((d) => ({
      ...d,
      content: d.content?.slice(0, 400) ?? "",
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(results) }],
      structuredContent: { results },
    };
  },
});