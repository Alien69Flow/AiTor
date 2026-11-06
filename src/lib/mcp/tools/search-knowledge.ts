import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_knowledge",
  title: "Search AI Tor knowledge base",
  description: "Full-text search over the AI Tor skills/knowledge documents (DAO, physics, Web3, OSINT).",
  inputSchema: {
    query: z.string().trim().min(2).describe("Search terms."),
    limit: z.number().int().min(1).max(20).nullable().describe("Max documents to return (default 5)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const term = query.replace(/[%,]/g, " ").trim();
    const { data, error } = await supabase
      .from("skills_documents")
      .select("id, title, category, source, url, content")
      .or(`title.ilike.%${term}%,content.ilike.%${term}%`)
      .limit(limit ?? 5);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const docs = (data ?? []).map((d) => ({ ...d, content: (d.content ?? "").slice(0, 2000) }));
    return {
      content: [{ type: "text", text: docs.length ? JSON.stringify(docs) : "No matching documents." }],
      structuredContent: { documents: docs },
    };
  },
});
