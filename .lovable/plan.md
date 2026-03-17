

## Diagnosis

The console logs confirm the issue: **`INVALID_TOKEN` error from Cesium Ion**. 

Line 21 of `CesiumGlobe.tsx` reads:
```ts
const CESIUM_TOKEN = import.meta.env.VITE_CESIUM_TOKEN || "";
```

The problem: `VITE_CESIUM_TOKEN` does not exist as a runtime secret (not in the secrets list), nor as a build secret. So the token resolves to `""`, and Cesium rejects it.

**Key insight**: Cesium Ion tokens are **publishable client-side keys** (like Google Maps API keys). They are designed to be used in browsers. Storing them in environment variables that aren't available at build time breaks the app without adding real security.

## Plan

### 1. Restore the hardcoded Cesium Ion token in `CesiumGlobe.tsx`

Since this is a publishable key, put it back directly in the code. The original token needs to be provided by the user — I'll need to ask for it, or we can use the Cesium Ion default demo token as a fallback.

**Two options:**

- **Option A**: Ask the user for their Cesium Ion token and hardcode it (it's a publishable key, safe to store in code)
- **Option B**: Use Cesium's default community token as a temporary fallback so the globe renders immediately, and let the user replace it later

### File to modify
| File | Change |
|---|---|
| `src/components/globe/CesiumGlobe.tsx` | Line 21: restore the Cesium Ion access token as a hardcoded string |

