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
  name: "list_uap_sightings",
  title: "List UAP sightings",
  description:
    "List recent UAP (Unidentified Aerial Phenomena) sightings tracked by AI Tor. Optional filter by minimum severity and result limit.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Maximum number of sightings to return (default 10)."),
    severity: z.enum(["low", "medium", "high", "critical"]).optional().describe("Filter to sightings at this severity."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, severity }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let q = supabaseForUser(ctx)
      .from("uap_sightings")
      .select("id, location, lat, lon, type, category, severity, description, source, source_url, date_reported")
      .order("date_reported", { ascending: false, nullsFirst: false })
      .limit(limit ?? 10);
    if (severity) q = q.eq("severity", severity);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { sightings: data ?? [] },
    };
  },
});