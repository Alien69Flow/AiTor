

## Plan: Oracle Selector UI Cleanup

### Problem
The ModelSelector has excessive visual noise:
- `backdrop-blur-xl` on the popover
- `shadow-[0_0_60px_...]` outer glow on popover
- `shadow-[0_0_15px_...]` on selected item
- `shadow-[0_0_12px_...]` on selected icon
- `hover:shadow-[0_0_20px_...]` on trigger button
- `animate-pulse` on REC badge
- `bg-popover/95` semi-transparent background compounds blur

All these layered glows create a washed-out, hard-to-read UI.

### Changes to `src/components/chat/ModelSelector.tsx`

1. **Popover container** — Remove excessive blur and glow:
   - `backdrop-blur-xl` → `backdrop-blur-md`
   - `shadow-[0_0_60px_...]` → `shadow-lg`
   - `bg-popover/95` → `bg-popover`

2. **Trigger button** — Remove hover glow shadow:
   - Remove `hover:shadow-[0_0_20px_...]`

3. **Selected item** — Simplify highlight:
   - Remove `shadow-[0_0_15px_...]`, keep the border + bg tint
   
4. **Selected icon** — Remove glow:
   - Remove `shadow-[0_0_12px_...]`

5. **REC badge** — Stop constant pulsing:
   - Remove `animate-pulse`, keep the badge static

6. **Speed bars & Quality bars** — Keep as-is (these are informative, not blurry)

### Result
Cleaner, sharper oracle selector that's easier to read while keeping the sci-fi aesthetic via colors and borders (not blur/glow).

### Files
| File | Change |
|---|---|
| `src/components/chat/ModelSelector.tsx` | Remove excessive blur, glow, pulse effects |

One file, ~5 line-level edits. No functional changes.

