import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { existsSync } from "node:fs";
import path from "path";
import cesium from "vite-plugin-cesium";
import { fetchVenue, isSafeInterval, isSafeSlug, isSafeToken, isVenueId } from "./api/_venues";

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
          res.end(JSON.stringify({ error: "unknown venue; use polymarket, kalshi or limitless" }));
          return;
        }
        const limit = Number(url.searchParams.get("limit") ?? "25");
        const slug = url.searchParams.get("slug");
        const token = url.searchParams.get("token");
        const interval = url.searchParams.get("interval");
        try {
          const result = await fetchVenue({
            venue,
            limit,
            slug: isSafeSlug(slug) ? slug : null,
            token: isSafeToken(token) ? token : null,
            interval: isSafeInterval(interval) ? interval : null,
          });
          res.statusCode = result.ok ? 200 : 502;
          res.setHeader("content-type", "application/json");
          res.setHeader("x-aitor-egress", result.egress);
          res.end(
            JSON.stringify(
              result.ok
                ? result.body
                : { error: `${venue} no respondió por ninguno de los dos caminos`, detail: result.reason },
            ),
          );
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

/**
 * Ejecuta las funciones de `api/` desde el servidor de desarrollo.
 *
 * Sin esto, una petición a `/api/traffic` no llega a ninguna función: Vite la
 * resuelve como módulo, transforma `api/traffic.ts` y contesta
 * `text/javascript` con el código fuente. El cliente hace `response.json()`
 * sobre ese texto y el globo se queda sin aviones ni barcos con un
 * «Unexpected token '/'» en la consola; lo mismo con `/api/gdelt` y la capa de
 * conflictos, que se apagaba sin decir por qué.
 *
 * El middleware reproduce el contrato mínimo de Vercel sobre Node —`req.query`
 * y `res.status().send()`— y ejecuta el handler real, así que en local se ve lo
 * mismo que desplegado, sin `vercel dev` ni variables de entorno distintas.
 */
function apiDevFunctions(): Plugin {
  return {
    name: "api-dev-functions",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url ?? "";
        const pathname = raw.split("?")[0];
        const name = pathname.startsWith("/api/") ? pathname.slice("/api/".length) : "";
        if (!/^[a-z0-9-]+$/.test(name)) return next();
        if (!existsSync(path.resolve(__dirname, "api", `${name}.ts`))) return next();

        const url = new URL(raw, "http://localhost");
        const devReq = {
          url: raw,
          method: req.method,
          query: Object.fromEntries(url.searchParams.entries()) as Record<string, string>,
        };

        // El `res` de Vercel encadena (`res.status(400).send(...)`) y escribe el
        // cuerpo ya serializado. Sobre Node eso son tres operaciones sueltas:
        // guardar el código, fijar la cabecera y cerrar la respuesta.
        const devRes: Record<string, unknown> = { statusCode: 200 };
        const send = (body?: unknown) => {
          let payload: string | Buffer | undefined;
          if (body === undefined || typeof body === "string" || Buffer.isBuffer(body)) {
            payload = body;
          } else {
            payload = JSON.stringify(body);
            res.setHeader("content-type", "application/json; charset=utf-8");
          }
          res.statusCode = Number(devRes.statusCode ?? 200);
          if (payload === undefined) res.end();
          else res.end(payload);
          return devRes;
        };
        devRes.status = (code: number) => {
          devRes.statusCode = code;
          return devRes;
        };
        devRes.send = send;
        devRes.end = send;
        devRes.json = (body: unknown) => {
          res.setHeader("content-type", "application/json; charset=utf-8");
          return send(JSON.stringify(body));
        };
        devRes.setHeader = (key: string, value: string) => {
          res.setHeader(key, value);
          return devRes;
        };

        server
          .ssrLoadModule(`/api/${name}.ts`)
          .then((mod: Record<string, unknown>) => {
            const handler = (mod.default ?? mod.handler) as
              | ((request: unknown, response: unknown) => unknown)
              | undefined;
            if (typeof handler !== "function") {
              throw new Error(`api/${name}.ts no exporta un handler por defecto`);
            }
            return handler(devReq, devRes);
          })
          .catch((error: unknown) => {
            server.config.logger.error(
              `[api-dev] ${name}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
            );
            if (!res.writableEnded) {
              res.statusCode = 502;
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify({ error: "la función de api/ falló en desarrollo" }));
            }
          });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), cesium(), predictionsDevApi(), apiDevFunctions()],

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
});
