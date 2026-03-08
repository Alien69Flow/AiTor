

## Plan: Phase 3 — Stripe Monetization + GitHub PAT + Data Integrations

### Part A: GitHub PAT Setup
The `github-proxy` edge function already exists and expects a `GITHUB_PAT` secret. I just need to request you to add it. Once configured, the "GitHub Repo" tool in the chat input will work — AI Tor can analyze repos, read files, list branches, and view commits.

### Part B: Stripe Monetization
Enable Stripe integration to create a tiered plan system:

**Plans:**
- **Free**: 5 messages/day, basic models only (Gemini Flash, GPT-5 Nano)
- **Pro** ($19/mo): Unlimited messages, all models including GPT-5, Deep Think mode
- **Enterprise** ($99/mo): API access, priority models, GitHub repo analysis, custom agents

**Implementation:**
1. Enable Stripe via Lovable's Stripe tool (creates products, prices, checkout)
2. Create database tables: `user_subscriptions` (user_id, plan, stripe_customer_id, status) and `usage_tracking` (user_id, date, message_count)
3. Add usage-checking middleware in `useChat.ts` — check message count before sending
4. Create a pricing/upgrade page component accessible from the header
5. Add plan badge in header showing current tier
6. Gate premium models behind Pro/Enterprise plans in `ModelSelector.tsx`

### Part C: Real Data Connections (Glint/Polymarket/Predik style)
Connect the Signals tab to real prediction market and trading data:

1. Create edge function `crypto-signals` that fetches from public APIs:
   - CoinGecko for price data (free, no key needed)
   - Polymarket API for prediction markets (public)
2. Update `SignalsTab.tsx` to show live data instead of mock signals
3. Add a "Markets" data source in the Signals tab showing real prediction market events

### Files to create/modify

| File | Action |
|---|---|
| `src/components/pricing/PricingPage.tsx` | Create — pricing cards with Stripe checkout |
| `src/components/chat/UsageBar.tsx` | Create — shows remaining messages for free tier |
| `src/hooks/useSubscription.ts` | Create — subscription status + usage tracking |
| `src/hooks/useChat.ts` | Modify — add usage gate before sending |
| `src/components/chat/ModelSelector.tsx` | Modify — lock premium models behind plans |
| `src/components/chat/ChatHeader.tsx` | Modify — add plan badge + upgrade button |
| `src/components/dashboard/SignalsTab.tsx` | Modify — real API data |
| `supabase/functions/crypto-signals/index.ts` | Create — real market data fetcher |
| DB migration | Create — user_subscriptions + usage_tracking tables |
| Stripe setup | Enable via tool |

### Implementation order
1. **GitHub PAT** — request secret immediately
2. **Stripe enable** — use Stripe tool to set up
3. **Database tables** — subscriptions + usage tracking
4. **Usage gate + pricing page** — enforce limits
5. **Real data for Signals** — connect live APIs

### What I need from you
- **GitHub PAT**: I'll request it via the secrets tool — you'll need to create one at github.com/settings/tokens with `repo` scope
- **Stripe**: I'll enable it via the Stripe tool — you'll need your Stripe secret key

