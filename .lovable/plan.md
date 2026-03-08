

## Plan: UI/UX Premium Overhaul + Model Selector Redesign

### What to improve

**1. Model Selector — Redesign completo**
- Replace basic `Select` dropdown with a custom popover/command palette style
- Group models by category: "ΔlieπFlΦw Oracles", "OpenAI", "External", "Coming Soon"
- Show oracle type badges (Primary, Advanced, Blockchain)
- Bigger items with provider logo area, speed/quality indicators
- Search/filter within the selector
- Selected model shown as a pill/badge in header with glow effect

**2. Empty State — Frase epica + UI upgrade**
- Replace "Tu oráculo de inteligencia artificial soberana" with something like:
  "La convergencia de todas las inteligencias. Un solo oráculo."
  or "Donde convergen los oráculos. Más allá de cualquier IA."
- Add animated typing effect or gradient text animation
- Subtle particle/constellation background behind the logo
- Cards: add gradient borders on hover, glassmorphism effect
- Add "Powered by" strip showing all AI logos/names in a marquee

**3. Terminal UI/UX polish**
- ChatInput: add subtle gradient border animation on focus, larger default height
- ChatMessage: better spacing, typing animation for AI responses
- Header: more compact, show model as colored pill badge
- Better empty-to-chat transition animation

**4. GitHub connection feature (for AI Tor to work with repos)**
- This is about connecting GitHub *inside the app* so AI Tor can analyze/modify repos
- Add a "GitHub" tool in the ChatInput TOOLS array
- Create edge function `github-proxy` that uses a GitHub PAT to read/write repos
- Need a secret `GITHUB_PAT` — will ask user to provide it
- Add capability card "GitHub & Repos" in EmptyState

**5. New tab ideas inspired by glint.trade**
- "Agents" tab — manage multiple AI agents/bots with different personalities
- "Signals" tab — AI-generated trading signals with confidence scores
- Rename some tabs for better branding

### Files to create/modify

| File | Action |
|---|---|
| `src/components/chat/ModelSelector.tsx` | Rewrite — command palette style with categories |
| `src/components/chat/EmptyState.tsx` | Modify — epic tagline, powered-by strip, better animations |
| `src/components/chat/ChatInput.tsx` | Modify — gradient focus border, GitHub tool, larger textarea |
| `src/components/chat/ChatHeader.tsx` | Modify — model pill badge, compact layout |
| `src/components/chat/ChatMessage.tsx` | Modify — typing animation, better spacing |
| `src/components/chat/ChatContainer.tsx` | Minor — transition animations |
| `supabase/functions/github-proxy/index.ts` | Create — GitHub API proxy for repo operations |
| `src/components/dashboard/TopNavBar.tsx` | Modify — add "Signals" or "Agents" tab |

### Implementation order
1. Model Selector redesign (most visible improvement)
2. Empty State epic overhaul
3. ChatInput + ChatMessage + Header polish
4. GitHub integration (edge function + secret + tool)
5. New tab(s)

### GitHub secret needed
Will need to ask user for a `GITHUB_PAT` (Personal Access Token) to enable repo access from AI Tor.

