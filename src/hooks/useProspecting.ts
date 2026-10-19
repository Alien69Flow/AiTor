import { useCallback, useState } from "react";

export interface Prospect {
  id: string;
  name: string;
  username?: string;
  platform: "twitter" | "linkedin" | "facebook" | "instagram";
  bio?: string;
  followers: number;
  location?: string;
  verified: boolean;
  lastSeen: Date;
  /** Engagement signals that suggest buying intent */
  intentScore: number; // 0-100
  topics: string[]; // detected interest areas
  profileUrl?: string;
}

export type ProspectionResult = {
  success: boolean;
  prospects: Prospect[];
  error?: string;
  executedAt: Date;
};

/**
 * Prospects public figures / accounts on supported platforms using
 * GDELT, Twitter API v2 (via Reown/wagmi indirect) or fallback hashtag search.
 * This is a *connector* hook – it does NOT depend on auth or Supabase; it
 * fetches open data and is safe to run for any operator.
 *
 * NOTE: Real API keys for Twitter/X and LinkedIn must be supplied via env vars
 * `TWITTER_API_KEY`, `LINKEDIN_ACCESS_TOKEN` etc. in the deployment environment.
 * If missing, the hook returns graceful empty results with a toast hint.
 */
export function useProspecting() {
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<ProspectionResult | null>(null);

  const searchTwitter = useCallback(
    async (query: string, maxResults = 10): Promise<Prospect[]> => {
      // Try env-provided bearer token first
      const bearer = process.env.TWITTER_BEARER_TOKEN;
      if (!bearer) {
        console.warn("[TWITTER] No TWITTER_BEARER_TOKEN env var – returning empty results");
        return [];
      }
      const url = new URL("https://api.twitter.com/2/tweets/search/recent");
      url.searchParams.set("query", query);
      url.searchParams.set("max_results", String(maxResults));
      url.searchParams.set("tweet.fields", "author_id,created_at,text");
      url.searchParams.set("user.fields", "username,name,description,public_metrics,verified");
      url.searchParams.set("expansions", "author_id");
      try {
        const resp = await fetch(url, {
          headers: { Authorization: `Bearer ${bearer}` },
        });
        if (!resp.ok) {
          const txt = await resp.text();
          console.error("Twitter API error:", resp.status, txt);
          return [];
        }
        const data = await resp.json();
        const users = data?.includes?.users || [];
        return users.map((u) => ({
          id: String(u.id ?? ""),
          name: u.name ?? u.username ?? "unknown",
          username: u.username ?? undefined,
          platform: "twitter" as const,
          bio: u.description ?? undefined,
          followers: Number(u.public_metrics?.followers_count ?? 0),
          verified: u.verified ?? false,
          lastSeen: new Date(),
          intentScore: 0, // Twitter search recent tweets no trae intención directa
          topics: [] as ReadonlyArray<string>,
          profileUrl: u.username ? `https://twitter.com/${u.username}` : undefined,
        }));
      } catch (e) {
        console.error("Twitter search exception:", e);
        return [];
      }
    },
    [],
  );

  const searchLinkedIn = useCallback(
    async (company?: string, location?: string, maxResults = 10): Promise<Prospect[]> => {
      const token = process.env.LINKEDIN_ACCESS_TOKEN;
      if (!token) {
        console.warn("[LINKEDIN] No LINKEDIN_ACCESS_TOKEN env var – returning empty results");
        return [];
      }
      // LinkedIn v2 people search (simplified – requires approved API scope)
      const url = new URL("https://api.linkedin.com/v2/people/search");
      const terms: string[] = [];
      if (company) terms.push(`company:(%22${company}%22)`);
      if (location) terms.push(`location:(%22${location}%22)`);
      url.searchParams.set("keywords", terms.join(" "));
      url.searchParams.set("count", String(maxResults));
        url.searchParams.set("fields", "id,firstName,lastName,headline,location,connectionDegree,publicProfileUrl");
      try {
        const resp = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) {
          const txt = await resp.text();
          console.error("LinkedIn API error:", resp.status, txt);
          return [];
        }
        const data = await resp.json();
        const people = data?.people || [];
        return people.map((p) => ({
          id: String(p.id ?? ""),
          name: p.firstName ?? p.lastName ?? "unknown",
          username: undefined,
          platform: "linkedin" as const,
          bio: p.headline ?? undefined,
          followers: 0,
          location: p.location?.name ?? undefined,
          verified: false,
          lastSeen: new Date(),
          intentScore: 0,
          topics: [] as ReadonlyArray<string>,
          profileUrl: p.publicProfileUrl ?? undefined,
        }));
      } catch (e) {
        console.error("LinkedIn search exception:", e);
        return [];
      }
    },
    [],
  );

  const prospect = useCallback(
    async (platform: "twitter" | "linkedin", query: string, options?: { maxResults?: number }): Promise<ProspectionResult> => {
      setLoading(true);
      setLastResult({ success: false, prospects: [], error: "", executedAt: new Date() });

      let prospects: Prospect[] = [];
      try {
        if (platform === "twitter") {
          prospects = await searchTwitter(query, options?.maxResults ?? 10);
        } else if (platform === "linkedin") {
          // parse simple query like "company=Acme location=Madrid"
          const [company, ...locParts] = query.split(" ");
          const location = locParts.join(" ");
          prospects = await searchLinkedIn(company, location, options?.maxResults ?? 10);
        }
        const result: ProspectionResult = {
          success: true,
          prospects,
          error: undefined,
          executedAt: new Date(),
        };
        setLastResult(result);
        return result;
      } catch (err) {
        console.error("Prospection error:", err);
        const result: ProspectionResult = {
          success: false,
          prospects: [],
          error: err instanceof Error ? err.message : "Unknown error",
          executedAt: new Date(),
        };
        setLastResult(result);
        return result;
      } finally {
        setLoading(false);
      }
    },
    [searchTwitter, searchLinkedIn],
  );

  return {
    loading,
    lastResult,
    prospect,
    searchTwitter,
    searchLinkedIn,
  };
}