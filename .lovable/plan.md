

## Plan: Massive Upgrade — Real Data Everywhere + Treemap Heatmap + Globe UX

### Current State Audit

| Tab | Status | Data Source | Issue |
|---|---|---|---|
| **Nexus** (chat) | Working | Edge function `chat` | OK |
| **Globe** | Working | Cesium + hardcoded hotspots + UAP sightings from DB | 401 in preview (env mismatch), needs richer data layers |
| **Markets** | Empty | `crypto-signals` → Polymarket | Works via curl but 401 in preview (same env issue) |
| **Signals** | Empty | `crypto-signals` → Polymarket + CoinGecko | Same 401 |
| **Feed** | Empty | `crypto-feed` → Firecrawl search | Same 401 |
| **Movers** | Empty | `crypto-feed` → CoinGecko markets | Same 401 |
| **Portfolio** | Mock data | Hardcoded MOCK_HOLDINGS | No wallet integration |
| **Alerts** | Mock data | Hardcoded MOCK_ALERTS | No persistence |
| **Monitor** | Mock data | Simulated latency values | Could ping real endpoints |
| **Agents** | Static | Hardcoded agent cards | Placeholder |
| **UFO/Alien** | Working | DB + `ufo-feed` edge function + live cams | OK (with fallback) |
| **Solar System** | Working | NASA Eyes iframe | OK |

### Root Cause: Why Everything Shows Empty

The preview environment has a **Supabase URL mismatch** — client connects to `avuflwehgtcstrejqdyh.supabase.co` but the API key belongs to project `wkdtvrxavkhbifjtvvdw`. This means ALL edge function calls and DB queries fail with 401 in the preview. **On the published app (aitor.lovable.app), these should work.** This is an environment config issue, not a code bug.

### What We'll Build (in order of impact)

#### Phase 1: Treemap Heatmap for Movers Tab
Add a "Heatmap" view toggle to MoversTab showing a treemap where:
- Rectangle size = market cap
- Color = 24h price change (green gradient for gains, red for losses)
- Click a cell to expand details
- Uses existing CoinGecko data from `crypto-feed`

#### Phase 2: Globe UX Improvements
- Add data layer toggles (Markets / UAP / Cryptozoo / All) as floating buttons
- Improve hotspot popups with richer cards (mini charts, links)
- Add a "fly to" dropdown for quick navigation to key regions
- Better color coding with animated pulse for high-severity events
- Add a search/filter overlay for sightings by type

#### Phase 3: Fill Empty Tabs with Real Data

**Portfolio Tab** — Replace mock data with:
- CoinGecko price tracker for user-entered holdings (stored in localStorage initially)
- "Add Asset" form: pick coin + amount → calculates USD value live
- Real PnL calculation from entry price

**Alerts Tab** — Make functional:
- Store alerts in localStorage (no auth needed)
- Check conditions against live CoinGecko data on each refresh
- Show toast notifications when triggered

**Monitor Tab** — Real health checks:
- Actually ping edge functions and measure latency
- Show real system status from function responses

**Agents Tab** — Keep as roadmap/coming soon but add:
- Agent capability descriptions
- "Chat with this agent" button linking to Nexus with pre-selected model

#### Phase 4: Beat Glint.trade Features

Glint has: Real-time AI feed, AI market matching, 3D globe, flight tracking, whale tracker, inline trading, portfolio, alerts, grid view, markets browser.

AlienFlow already has or will have equivalents for most. Unique advantages to build:
- **UAP/Cryptozoology layer** — Glint doesn't have this
- **Multi-model AI** — Glint uses one model, we have 10+
- **Live cameras** — Unique feature
- **Solar System** — Unique feature

Missing vs Glint that we should add:
- **AI Signal Matching**: When fetching Polymarket events, use AI to match them with trending news (connect Feed + Signals tabs)
- **Whale Tracker**: Use Polymarket API's `activity` endpoint for large trades

### Implementation Priority

```text
┌─────────────────────────────────────────┐
│ Sprint 1 (This session)                 │
│  1. Treemap heatmap in MoversTab        │
│  2. Globe: layer toggles + fly-to       │
│  3. Portfolio: real coin tracker         │
│  4. Alerts: localStorage persistence    │
│  5. Monitor: real endpoint pings        │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Sprint 2 (Next session)                 │
│  6. AI signal matching (Feed↔Markets)   │
│  7. Whale tracker via Polymarket API    │
│  8. Agents: functional routing          │
└─────────────────────────────────────────┘
```

### Technical Details

**Treemap Heatmap** — Pure SVG/div-based treemap (no new dependency). Uses a squarified treemap algorithm. Each cell is a `div` with `position: absolute`, sized proportionally to market cap, colored by price change using interpolation from red (-10%) through neutral (0%) to green (+10%).

**Globe Layers** — Add a floating control panel in `GlobeDashboard.tsx` with checkboxes for each data layer. Pass `visibleLayers` prop to `CesiumGlobe` which filters entities by category.

**Portfolio** — New `usePortfolio` hook with localStorage. Fetches current prices from the existing `crypto-feed` edge function. Schema: `{ coinId, symbol, amount, entryPrice }[]`.

**Monitor Real Pings** — Call each edge function with a lightweight "ping" action and measure `Date.now()` delta.

### Files to Create/Modify

| File | Action |
|---|---|
| `src/components/dashboard/MoversTab.tsx` | Add treemap heatmap view |
| `src/components/dashboard/GlobeDashboard.tsx` | Add layer toggles, fly-to |
| `src/components/globe/CesiumGlobe.tsx` | Accept `visibleLayers` prop |
| `src/components/dashboard/PortfolioTab.tsx` | Replace mock with real tracker |
| `src/components/dashboard/AlertsTab.tsx` | Add localStorage persistence + live checks |
| `src/components/dashboard/MonitorTab.tsx` | Real endpoint pings |
| `src/components/dashboard/AgentsTab.tsx` | Add "chat with agent" routing |
| `src/hooks/usePortfolio.ts` | New: portfolio state management |

No database changes needed. No new edge functions needed — all features use existing `crypto-feed` and `crypto-signals` functions.

