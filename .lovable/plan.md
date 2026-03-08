

## Plan: Make GitHub Repo Analysis Actually Work

### Problem

The GitHub button currently just prepopulates "Analiza el repositorio de GitHub: " in the chat input. When the user types a repo URL and sends it, the message goes to the AI model which has **no access to GitHub** — it can only hallucinate a response. The `github-proxy` edge function exists but is never called from the frontend.

Additionally, the `GITHUB_PAT` secret is **not configured**, so even if the proxy were called, it would fail.

### Solution

Wire the chat to detect GitHub repo URLs, call the `github-proxy` edge function to fetch real repo data (tree, README, recent commits), then inject that context into the AI prompt — similar to how web search already works.

### Changes

**1. Add `GITHUB_PAT` secret**
- Prompt user to enter their GitHub Personal Access Token

**2. `src/hooks/useChat.ts`** — Add GitHub repo detection and fetching:
- Add a `GITHUB_PREFIX = "Analiza el repositorio de GitHub: "` constant
- Add `performGitHubAnalysis(repoUrl)` function that:
  - Parses `owner/repo` from URL or shorthand
  - Calls `github-proxy` with `repo_info` action → gets description, stars, language
  - Calls `github-proxy` with `tree` action → gets file structure
  - Calls `github-proxy` with `commits` action → gets recent commits
  - Calls `github-proxy` with `contents` action for `README.md` → gets readme content
  - Returns formatted context string
- In `sendMessage`, detect GitHub prefix (like search prefix), call `performGitHubAnalysis`, inject results into the AI prompt

**3. `src/hooks/useChat.ts`** — Add `isAnalyzingRepo` state for UI feedback

**4. `src/components/chat/ChatInput.tsx`** — No changes needed (prompt prefill already works)

### Flow

```text
User clicks Git → types "owner/repo" → sends
  → useChat detects prefix
  → calls github-proxy edge function (3 requests)
  → injects repo info + tree + commits + README into prompt
  → AI responds with real analysis
```

### Files

| File | Change |
|---|---|
| Secret `GITHUB_PAT` | User must add their GitHub PAT |
| `src/hooks/useChat.ts` | Add GitHub analysis flow (similar to web search) |

One secret + one file edit. No new dependencies.

