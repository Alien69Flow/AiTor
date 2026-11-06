import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_uap_sightings",
  title: "List UAP sightings",
  description: "List recent UAP / anomalous aerial sightings tracked by AI Tor, newest first.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).nullable().describe("How many sightings to return (default 10)."),
    category: z.string().nullable().describe("Optional category filter, e.g. 'uap' or 'military'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, category }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("uap_sightings")
      .select("id, location, lat, lon, type, category, severity, source, source_url, description, date_reported")
      .order("date_reported", { ascending: false })
      .limit(limit ?? 10);
    if (category) query = query.eq("category", category);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { sightings: data ?? [] },
    };
  },
});
