

## Plan: Responsive Mobile Refactor + Build Error Fix

### 1. Fix Build Error
The `github-proxy` edge function has a stale import reference to `jsr:@supabase/functions-js/edge-runtime.d.ts` that triggers an OpenAI package resolution error. Replace line 1 with the standard `/// <reference types="..." />` comment or remove it entirely since it's just a type hint.

### 2. Responsive Refactor

**`src/pages/Index.tsx`** — Main container:
- Add `max-w-[100vw] max-h-[100dvh] overflow-hidden` to the fixed container

**`src/components/dashboard/TopNavBar.tsx`** — Hamburger menu on mobile:
- Add state `menuOpen` for mobile menu toggle
- On `md+`: keep current horizontal tab bar
- On `<md`: replace nav with a hamburger button (`Menu` icon) that opens a dropdown/sheet overlay listing all tabs vertically, with the active tab highlighted
- Hide search bar and wallet button text on small screens (already partially done)
- Reduce padding on mobile (`px-2` instead of `px-4`)

**`src/index.css`** — Global overflow prevention:
- Add `html, body { overflow-x: hidden; max-width: 100vw; }` in the base layer

### Files to modify
| File | Change |
|---|---|
| `supabase/functions/github-proxy/index.ts` | Fix import line 1 |
| `src/pages/Index.tsx` | Add `max-w-[100vw] max-h-[100dvh] overflow-hidden` |
| `src/components/dashboard/TopNavBar.tsx` | Hamburger menu for mobile, responsive padding |
| `src/index.css` | `overflow-x: hidden` on html/body |

