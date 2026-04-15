

## Plan: Globe Dashboard — Major Upgrade Pass

### Issues Identified

1. **Globe not interactive** — The `GlobeScene` container has `pointer-events: none` inherited from the left panel wrapper, AND the right `ChatFeedPanel` + `MarketsTerminalMini` overlay areas block pointer events on the globe. The `GlobeScene` div is z-0 while multiple panels sit above it with `pointer-events-auto` covering large areas.

2. **Navigation panel broken** — `NavigatePanel` calls `onNavigate` which triggers `globeNavFn`, but `globeNavFn` is stored via `useState` with a function-wrapper pattern that may lose reference. Additionally, the `onReady` callback fires once during a timeout, but if the Globe re-renders, the ref might be stale.

3. **Markets Terminal blocking globe** — Positioned `absolute bottom-3 right-[330px]` with `z-20`, directly over the globe center area.

4. **Markets Terminal data broken** — Maps crypto prices by array index to fake pair names (GVD GSY, USD USDT, etc.) — meaningless data. Column headers are gibberish ("Export", "Ándoo", "Charitto").

5. **Planet lacks night lights / atmosphere layers** — Missing `nightImageUrl` prop for city lights terminator effect. The atmosphere is there but reference image shows more intense layered rings.

6. **ChatFeedPanel is static** — Uses hardcoded lorem-ipsum-like text. Should show real OSINT feed from earthquakes, NASA events, and space weather.

7. **Right panel too wide** — `w-[320px] lg:w-[360px]` takes too much space from the globe view.

---

### Changes

**File 1: `src/components/globe/GlobeScene.tsx`**
- Add `nightImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"` for day/night terminator with city lights
- Increase `atmosphereAltitude` base to 0.25 (currently 0.2) for more visible halo
- Ensure `enableZoom`, `enableRotate`, `enablePan` are not blocked — verify controls setup doesn't restrict zoom range too much (`minDistance: 120` → `101` to allow closer zoom)

**File 2: `src/components/dashboard/GlobeDashboard.tsx`**
- Move `MarketsTerminalMini` from bottom-center to inside the right panel (below ChatFeedPanel tabs) or make it a small overlay at bottom-right that doesn't block globe center
- Ensure globe container div has `pointer-events-auto` and panels use `pointer-events-none` on wrappers with `pointer-events-auto` only on the panel content itself (already partially done, but the right panel blocks the entire right side)
- Reduce right panel to `w-[280px]` and make it scrollable
- Fix the center bottom menu bar position so it doesn't overlap with globe interaction

**File 3: `src/components/dashboard/MarketsTerminalMini.tsx`**
- Fix column headers to proper labels: "Pair", "Trend", "Price", "Change"
- Map real crypto data properly: show BTC, ETH, SOL, BNB with actual prices instead of fake pair names
- Fix sparkline to reflect actual price direction based on `change24h`

**File 4: `src/components/dashboard/ChatFeedPanel.tsx`**
- Replace static lorem-ipsum posts with real-time data from earthquakes and NASA events passed as props
- Add props for `earthquakes` and `nasaEvents`
- Show actual earthquake alerts, NASA event warnings, and space weather alerts as feed items
- Keep the search/filter UI but populate with real data

**File 5: `src/components/dashboard/NavigatePanel.tsx`**
- Verify `onNavigate` prop is correctly wired. The issue may be that `globeNavFn` stored via `useState` loses the closure. Fix by using `useRef` for the navigation function instead of `useState`.

**File 6: `src/components/dashboard/GlobeDashboard.tsx` (navigation fix)**
- Change `globeNavFn` from `useState` to `useRef` to prevent stale closures:
  ```
  const globeNavRef = useRef<(lat, lng, alt) => void>()
  ```
- Pass `globeNavRef.current` in `handleNavigate`

---

### Execution Order

1. Fix globe interactivity (GlobeDashboard pointer-events + right panel sizing)
2. Fix navigation (useRef instead of useState for globeNavFn)
3. Add night lights to GlobeScene
4. Fix MarketsTerminalMini data and headers
5. Make ChatFeedPanel consume real data
6. Reposition MarketsTerminalMini to not block globe

### Files Modified

| File | Action |
|------|--------|
| `src/components/globe/GlobeScene.tsx` | Add nightImageUrl, adjust controls |
| `src/components/dashboard/GlobeDashboard.tsx` | Fix pointer-events, nav ref, panel layout |
| `src/components/dashboard/MarketsTerminalMini.tsx` | Fix data mapping and headers |
| `src/components/dashboard/ChatFeedPanel.tsx` | Real-time feed from APIs |
| `src/components/dashboard/NavigatePanel.tsx` | Minor — already correct, fix is in parent |

