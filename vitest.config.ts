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
    include: [
      "src/**/*.test.{ts,tsx}",
      "tests/**/*.test.{ts,tsx}",
      "scripts/**/*.test.mjs",
      // `_shared/` de las edge functions es TypeScript sin APIs de Deno a
      // propósito, así que se puede probar aquí (la sonda de oráculos vive ahí).
      "supabase/functions/_shared/**/*.test.ts",
    ],
    // React Testing Library solo registra su limpieza automática (afterEach →
    // cleanup) si hay globales de Vitest; sin esto los renders se acumulan y
    // los tests se encuentran con elementos de los anteriores.
    globals: true,
    restoreMocks: true,
    // The login page schedules async work (passkey autofill, wallet probes);
    // a generous timeout keeps a slow CI runner from reporting flakes as bugs.
    testTimeout: 15_000,
    // En Actions, un test rojo se publica como anotación con su fichero y su
    // línea. Antes el fallo se quedaba dentro de las dos mil líneas del log y
    // había que descargar el zip del run para saber qué había caído.
    reporters: process.env.GITHUB_ACTIONS ? ["default", "github-actions"] : ["default"],
  },
});
