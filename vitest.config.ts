import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/**
 * Tests configuration kept apart from vite.config.ts on purpose: the app config
 * loads the Cesium plugin plus a local /api middleware, none of which a unit
 * test needs — and Cesium pulls a large WASM asset on start.
 *
 * Only the `@` alias is carried over, so tests resolve imports exactly like the
 * app does.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: "@", replacement: path.resolve(__dirname, "./src") }],
  },
  test: {
    environment: "jsdom",
    // `scripts/` is included for the checks that are plain Node modules (the CI
    // gates): they cannot live in src because the Node 22 runner imports them
    // directly, so their tests follow them out here.
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
    // React Testing Library solo registra su limpieza automática (afterEach →
    // cleanup) si hay globales de Vitest; sin esto los renders se acumulan y
    // los tests se encuentran con elementos de los anteriores.
    globals: true,
    restoreMocks: true,
    // The login page schedules async work (passkey autofill, wallet probes);
    // a generous timeout keeps a slow CI runner from reporting flakes as bugs.
    testTimeout: 15_000,
  },
});
