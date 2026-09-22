import type { ExecutionContext } from "../../agents/runtime/types.js";
import type { ToolDefinition } from "../../agents/runtime/toolRegistry.js";
import { SupabaseEdgeFunctionClient } from "./edgeFunctionClient.js";

export interface EdgeFunctionToolInput {
  body?: unknown;
  accessToken?: string;
}

/**
 * Adapts a checked-in Supabase Edge Function into a runtime tool.
 * The allowlist is intentional: arbitrary function names must not be model-selected.
 */
export function createEdgeFunctionTool(
  name: string,
  description: string,
  options: { risk?: "low" | "medium" | "high" | "critical"; requiresApproval?: boolean } = {},
): ToolDefinition<EdgeFunctionToolInput> {
  const client = new SupabaseEdgeFunctionClient();
  return {
    name: `supabase.${name}`,
    description,
    risk: options.risk ?? "low",
    requiresApproval: options.requiresApproval ?? false,
    timeoutMs: 30_000,
    validate: (input): input is EdgeFunctionToolInput =>
      typeof input === "object" && input !== null,
    execute: async (input, context: ExecutionContext) => {
      const response = await client.invoke({
        name,
        body: input.body,
        accessToken: input.accessToken,
      });
      if (response.error) throw new Error(response.error);
      return { function: name, status: response.status, data: response.data, runId: context.runId };
    },
  };
}

export const READ_ONLY_EDGE_FUNCTIONS = [
  "crypto-feed",
  "crypto-price",
  "crypto-signals",
  "firecrawl-search",
  "firecrawl-osint",
  "ufo-feed",
  "air-traffic",
  "marine-traffic",
  "weather-grid",
  "noaa-space-weather",
  "openweather",
] as const;
