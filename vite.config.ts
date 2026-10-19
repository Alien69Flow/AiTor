import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import cesium from "vite-plugin-cesium";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
import { fetchVenue, isVenueId } from "./api/_venues";

/**
 * En local no hay función de Vercel, así que el middleware reproduce
 * `GET /api/predictions?venue=…` con la misma whitelist y límites que
 * api/predictions.ts. Producción la sirve la función serverless.
 */
function predictionsDevApi(): Plugin {
  return {
    name: "predictions-dev-api",
    configureServer(server) {
      server.middlewares.use("/api/predictions", async (req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const venue = url.searchParams.get("venue");
        if (!isVenueId(venue)) {
          res.statusCode = 400;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "unknown venue; use kalshi or limitless" }));
          return;
        }
        const limit = Number(url.searchParams.get("limit") ?? "25");
        try {
          const result = await fetchVenue(venue, limit);
          res.statusCode = result.ok ? 200 : 502;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(result.ok ? result.body : { error: `${venue} respondió HTTP ${result.status}` }));
        } catch (error) {
          const message = error instanceof Error ? error.message : "upstream fetch failed";
          res.statusCode = 502;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: `${venue} inaccesible: ${message}` }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    cesium(),
    mcpPlugin(),
    predictionsDevApi(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),

  build: {
    // The globe pulls three.js and the wallet stack pulls viem/wagmi; keeping
    // them in their own chunks lets the shell and the chat load without them.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("three")) return "vendor-three";
          if (id.includes("@reown") || id.includes("wagmi") || id.includes("viem")) return "vendor-web3";
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("react") || id.includes("scheduler")) return "vendor-react";
          return undefined;
        },
      },
    },
  },

  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      { find: /^three$/, replacement: path.resolve(__dirname, "./node_modules/three/build/three.module.js") },
      { find: /^three\/webgpu$/, replacement: path.resolve(__dirname, "./node_modules/three/build/three.webgpu.js") },
      { find: /^three\/examples\/jsm\/(.*)$/, replacement: path.resolve(__dirname, "./node_modules/three/examples/jsm/$1") },
    ],
    dedupe: ["three", "react", "react-dom"],
  },
}));
