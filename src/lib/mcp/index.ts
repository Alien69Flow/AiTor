import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getCredits from "./tools/get-credits";
import listUapSightings from "./tools/list-uap-sightings";
import searchKnowledge from "./tools/search-knowledge";

// The OAuth issuer must be the direct Supabase host, built from the project ref
// (never SUPABASE_URL, which may be a .lovable.cloud proxy). VITE_SUPABASE_PROJECT_ID
// is inlined by Vite at build time so this stays import-safe.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "aitor-mcp",
  title: "AI Tor",
  version: "0.1.0",
  instructions:
    "Tools exposed by AI Tor — the AlienFlow DAO tactical intelligence assistant. Use `get_credits` to see the signed-in user's remaining AI Tor credits, `list_uap_sightings` for recent UAP intel, and `search_knowledge` to search the AI Tor knowledge base.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getCredits, listUapSightings, searchKnowledge],
});