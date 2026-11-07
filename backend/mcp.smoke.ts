/**
 * Prueba de humo del router MCP: monta el handler en un Express mínimo, se
 * llama a sí misma y comprueba lo que no se puede verificar con tipos.
 *
 * Se ejecuta con `npx tsx mcp.smoke.ts` desde `backend/` y borra el servidor al
 * terminar. No sale a internet: sin JWT válido, todo debe ser 401 antes de
 * tocar Supabase.
 */
import express from "express";
import { createMcpRouter } from "./mcp";

const app = express();
app.use(express.json());
app.use(
  createMcpRouter({
    supabaseUrl: "https://ejemplo.supabase.co",
    supabaseAnonKey: "clave-de-prueba",
    geminiKey: undefined,
    // Cualquier intento de red es un fallo de la prueba, no un caso válido.
    fetchImpl: (async () => {
      throw new Error("la prueba de humo no debe salir a la red");
    }) as unknown as typeof fetch,
  }),
);

const server = app.listen(4599, async () => {
  const base = "http://127.0.0.1:4599";
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });

  const results: Array<[string, number, number]> = [];
  results.push(["JSON-RPC sin sesión", (await post("/mcp", { jsonrpc: "2.0", method: "tools/list" })).status, 401]);
  results.push(["agente sin sesión", (await post("/mcp", { prompt: "hola" })).status, 401]);
  results.push([
    "token inventado",
    (await post("/mcp", { jsonrpc: "2.0", method: "tools/list" }, { Authorization: "Bearer no-es-un-jwt" })).status,
    401,
  ]);
  results.push(["listado sin sesión", (await fetch(`${base}/mcp/tools`)).status, 401]);

  let failed = false;
  for (const [name, got, want] of results) {
    const ok = got === want;
    if (!ok) failed = true;
    console.log(`${ok ? "✓" : "✗"} ${name}: ${got} (esperado ${want})`);
  }

  server.close(() => process.exit(failed ? 1 : 0));
});
