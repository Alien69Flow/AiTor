

User asks 3 things: (1) production black screen / env vars, (2) OSINT integration referencing opensourceintelligence.vercel.app, (3) World Monitor fork adaptation. Asked for a structural plan only, no code.

Let me check the current OSINT/firecrawl setup and the world monitor reference quickly.

Key findings from context already loaded:
- Firecrawl connector is linked (FIRECRAWL_API_KEY exists as managed secret)
- Edge functions exist: `firecrawl-search`, `firecrawl-osint` (basic HTML scraper of ZeroHedge/TheBlock/CryptoBriefing)
- `useOsintFeed` hook exists, calls `firecrawl-osint`
- `useRealTimeData` hook orchestrates USGS/NOAA/NASA/Crypto/UAP
- Production URL: https://aitor.lovable.app

For #1 (black screen): VITE_ vars are baked at build time. The .env shows VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set. Production black screen typically means published version is stale and needs re-publish, OR a runtime error. Need to verify with user whether they re-published after restoring Supabase. I won't ask — just include in plan.

Plan should be concise and structural per user request.

