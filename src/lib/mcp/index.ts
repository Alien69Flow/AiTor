import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getCreditsTool from "./tools/get-credits";
import listUapSightingsTool from "./tools/list-uap-sightings";
import searchKnowledgeTool from "./tools/search-knowledge";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "ai-tor",
  title: "Ai Tor",
  version: "0.1.0",
  instructions:
    "Tools for AI Tor, the AlienFlow DAO intelligence terminal. Use `search_knowledge` for DAO/physics/Web3 context, `list_uap_sightings` for anomalous aerial events, and `get_credits` for the signed-in user's credit balance.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getCreditsTool, listUapSightingsTool, searchKnowledgeTool],
});
