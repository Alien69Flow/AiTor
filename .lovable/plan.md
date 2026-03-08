

## Plan: AI Tor Phase 2 — Firecrawl Search + Chat Persistence + UI Polish

### 1. Firecrawl Web Search Integration

**Edge Function** `supabase/functions/firecrawl-search/index.ts`:
- Create edge function that calls Firecrawl search API using `FIRECRAWL_API_KEY`
- Returns top 5 results with title, URL, description, and markdown content

**Config** `supabase/config.toml`:
- Add `[functions.firecrawl-search]` with `verify_jwt = false`

**Chat Hook** `src/hooks/useChat.ts`:
- Detect "Busca en la web:" prefix in messages
- When detected: call firecrawl-search first, inject results as context into the AI prompt
- Format: prepend search results to the user message before sending to chat function
- Flow: user sends search query → call firecrawl → append results as system context → send to AI model for synthesis

### 2. Chat Persistence (Local Storage + Future DB Ready)

**Hook** `src/hooks/useChat.ts`:
- Add conversation ID tracking (UUID per conversation)
- Save/load messages to localStorage under `aitor_chat_memory` (as per existing memory requirement)
- Add `conversations` list tracking: `{ id, title, updatedAt }[]`
- Auto-generate title from first user message (first 50 chars)
- Export `loadConversation`, `conversations` list, `currentConversationId`

**New Component** `src/components/chat/ConversationHistory.tsx`:
- Sidebar panel showing list of past conversations
- Each item: title + relative timestamp
- Click to load, swipe/button to delete
- "New Chat" button at top
- Integrated into the existing AgentSidebar or as a tab within it

**Container** `src/components/chat/ChatContainer.tsx`:
- Wire conversation history to useChat
- Add conversation switching logic

### 3. UI/UX Polish

**ChatInput** improvements:
- Slightly larger textarea default height
- Tool buttons with subtle labels on desktop (not just icons)
- Smoother focus ring animation
- Search tool button triggers actual Firecrawl search (not just prefill)

**EmptyState** improvements:
- Add subtle entrance animations (fade-in stagger on cards)
- Improve card hover states with glow effect matching the green neon theme
- Better spacing between sections

**ChatMessage** improvements:
- Add timestamp display on hover
- Better code block styling with language label and copy button per block
- Slightly increase line height for readability

**ChatHeader** improvements:
- Add "New Chat" button (plus icon) next to trash
- Show conversation title when in an active conversation

**AgentSidebar** — Add conversation history tab:
- Split sidebar into two sections/tabs: "Agent Info" and "Historial"
- History tab shows ConversationHistory component

### Files to create/modify

| File | Action |
|---|---|
| `supabase/functions/firecrawl-search/index.ts` | Create — Firecrawl search edge function |
| `supabase/config.toml` | Modify — add firecrawl-search function config |
| `src/hooks/useChat.ts` | Modify — add search detection, persistence, conversation management |
| `src/components/chat/ConversationHistory.tsx` | Create — history sidebar component |
| `src/components/chat/ChatContainer.tsx` | Modify — wire persistence + history |
| `src/components/chat/ChatInput.tsx` | Modify — UI polish + search integration |
| `src/components/chat/EmptyState.tsx` | Modify — animations + hover polish |
| `src/components/chat/ChatMessage.tsx` | Modify — timestamps, better code blocks |
| `src/components/chat/ChatHeader.tsx` | Modify — new chat button, conversation title |
| `src/components/chat/AgentSidebar.tsx` | Modify — add history tab |

