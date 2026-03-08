

## Plan: Tab Rename + Responsive Chat Widget Mode

### 1. Tab Name Options

Combining the best of "console", "terminal", and "oracle" with the AlienFlow aesthetic:

| Option | Vibe |
|---|---|
| **Nexus** | Connection hub, sci-fi, where all intelligence converges |
| **Cortex** | Brain/AI center, neural network vibes |
| **Command** | Space ops, mission control feel |
| **Bridge** | Starship bridge — where you pilot everything |
| **Mainframe** | Retro-futuristic, hacker aesthetic |

Recommendation: **"Nexus"** — fits the oracle/convergence branding ("Inteligencia que converge donde otros no miran") and sounds pro without being generic.

### 2. Chat Widget Responsive Mode

From the screenshot, the chat is embedded as a ~450px floating panel in the DAO dapp. Current issues:
- EmptyState has a 3-column grid of 6 capability cards — too wide for widget
- Large logo + radar rings take too much vertical space
- "Powered by" marquee and stats strip waste space in compact mode
- ChatHeader duplicates auth buttons already in the parent dapp

**Changes for widget-friendly layout:**

- **EmptyState**: Detect compact viewport (< 500px width) and switch to:
  - Smaller logo (48px instead of 80px), no radar rings
  - 1-column capability cards (show only 4, hide 2)
  - Hide "Powered by" marquee
  - Shorter tagline or hide it
  - Suggestions as horizontal scroll instead of wrap

- **ChatHeader**: Compact mode — hide auth buttons (parent dapp handles auth), shrink padding

- **ChatInput**: Already responsive, minor tweaks — hide tool labels on small width

- **ChatContainer**: Add CSS container query or min-width check for widget mode

### Files to modify

| File | Change |
|---|---|
| `src/components/dashboard/TopNavBar.tsx` | Rename "Terminal" tab to chosen name |
| `src/components/chat/EmptyState.tsx` | Add compact/widget-responsive layout |
| `src/components/chat/ChatHeader.tsx` | Compact mode: smaller padding, conditional elements |
| `src/components/chat/ChatContainer.tsx` | Minor: CSS adjustments for widget embedding |

### Implementation
~4 small file edits. No database or backend changes needed.

