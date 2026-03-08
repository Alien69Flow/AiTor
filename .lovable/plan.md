

## Plan: Premium UI Overhaul — Glint.trade + Polymarket + NASA Eyes Fusion

### Inspiration Analysis
- **Glint.trade**: Real-time feed with impact scores, AI market matching, inline trading, whale tracker, grid view
- **Polymarket**: Clean market cards with YES/NO percentages, volume indicators, category filters
- **NASA Eyes**: Immersive 3D visualization, cinematic UI, dark ambient aesthetic
- **Predik.app**: Prediction cards with probability bars, social proof indicators
- **Explore.org**: Live feeds, nature-inspired calm UI, discovery-first navigation

### What to Improve

**1. Model Selector — Professional Tier Upgrade**
- Add speed/latency indicator per model (e.g., "~1.2s" response time)
- Add a "Recommended" highlight on the best model for the current context
- Show token limit per model (e.g., "128K context")
- Smoother animations: scale-in on open, item hover glow
- Better visual hierarchy: larger selected state, dimmer unselected
- Add keyboard navigation hints (↑↓ to navigate, Enter to select)

**2. Signals Tab — Glint-style Real-Time Feed**
- Replace mock data with real CoinGecko + public Polymarket API data
- Add **impact score badges** (Critical/High/Medium/Low) like Glint
- Add **market matching**: each signal linked to a prediction market contract
- Polymarket-style YES/NO probability bars with live percentages
- Category filter pills (Politics, Crypto, Sports, Tech, World)
- Inline "Trade" button that opens Polymarket/Predik in new tab
- Auto-refresh with live pulse indicator
- Grid view toggle (single column vs multi-column like Glint)

**3. Feed Tab — Glint Intel Feed Style**
- Add AI-classified impact levels (color-coded: red=critical, orange=high, yellow=medium, green=low)
- Source icons (X/Twitter, Telegram, News) instead of just hostname
- Timestamp with "2m ago" relative format
- Sentiment indicator per article (bullish/bearish/neutral)
- Expandable preview with first paragraph
- Filter bar: source type, impact level, asset category

**4. Movers Tab — Polymarket + Trading Terminal Style**
- Add mini sparkline charts per asset (7-day trend)
- Market cap rank badge
- Heatmap view toggle (treemap of market caps with color = 24h change)
- Click-to-expand with more details (ATH, ATL, supply info)
- "Add to Watchlist" star icon per row

**5. Empty State — More Epic, NASA-Inspired**
- Replace tagline with: **"El oráculo que ve más allá del mercado. Inteligencia que converge donde otros no miran."**
- Add subtle starfield particle animation behind logo (like NASA Eyes)
- Pulsing concentric rings around logo (like a radar/oracle scanning)
- Stats strip: "12 Oracles · 3 Data Sources · Real-time" with live dot

**6. New Tab: "Markets Browser" (Glint-inspired)**
- Browse prediction market contracts from Polymarket API
- Category cards: Politics, Crypto, Sports, Tech, Culture
- Each market: title, current YES%, volume, end date
- Search/filter within markets
- Click to see full details + trade link

### Files to Create/Modify

| File | Action |
|---|---|
| `src/components/chat/ModelSelector.tsx` | Modify — add latency, context size, keyboard hints, animations |
| `src/components/chat/EmptyState.tsx` | Modify — new tagline, particle starfield, radar rings, stats strip |
| `src/components/dashboard/SignalsTab.tsx` | Rewrite — real API data, impact scores, market matching, filters |
| `src/components/dashboard/FeedTab.tsx` | Modify — impact levels, source icons, sentiment, filters |
| `src/components/dashboard/MoversTab.tsx` | Modify — sparklines, heatmap toggle, watchlist |
| `src/components/dashboard/MarketsTab.tsx` | Create — Polymarket-style markets browser |
| `src/components/dashboard/TopNavBar.tsx` | Modify — add "Markets" tab |
| `src/pages/Index.tsx` | Modify — wire MarketsTab |
| `supabase/functions/crypto-signals/index.ts` | Create — fetch real data from CoinGecko + Polymarket public APIs |

### Implementation Order
1. Model Selector polish (quick win, high visibility)
2. EmptyState epic upgrade (branding)
3. SignalsTab with real Polymarket data
4. FeedTab Glint-style improvements
5. New MarketsTab (Polymarket browser)
6. MoversTab enhancements (sparklines, heatmap)

### No API Keys Needed
- CoinGecko: free public API, no key required
- Polymarket: public CLOB API, no key required
- All data fetched via edge functions to avoid CORS

