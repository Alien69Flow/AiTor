
## Implementation: Real GitHub Repo Analysis

### What's needed

1. **Store `GITHUB_PAT` secret** — the token the user just provided
2. **Update `src/hooks/useChat.ts`** — detect GitHub prefix, call `github-proxy` edge function, inject real repo data into the AI prompt

### Changes to `useChat.ts`

**Constants to add:**
```
const GITHUB_URL = `https://${VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/github-proxy`;
const GITHUB_PREFIX = "Analiza el repositorio de GitHub: ";
```

**New `performGitHubAnalysis(repoInput)` function:**
- Parse `owner/repo` from URL (e.g. `https://github.com/user/repo`) or shorthand (`user/repo`)
- Parallel fetch: `repo_info` + `tree` + `commits`
- Sequential fetch: `contents` for README.md
- Format everything into a rich context string

**In `sendMessage`:**
- Detect `GITHUB_PREFIX` (same pattern as search)
- Call `performGitHubAnalysis`, inject context into final prompt
- Add `isAnalyzingRepo` state → show loading feedback

**In `sendMessage` title logic:**
- Strip GitHub prefix from conversation title (same as search/deep think)

**New return value:** `isAnalyzingRepo` (for UI feedback in ChatContainer)

### Title cleanup in `ChatInput.tsx` tooltip
- No changes needed

### Files
| File | Change |
|---|---|
| Secret `GITHUB_PAT` | Store the provided token |
| `src/hooks/useChat.ts` | Add GitHub analysis (parallel to web search) |
| `src/components/chat/ChatContainer.tsx` | Pass `isAnalyzingRepo` to show status |
| `src/components/chat/ThinkingIndicator.tsx` | Check if needs "Analyzing repo..." state |
