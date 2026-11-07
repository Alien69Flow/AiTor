/**
 * Pregunta a Gemini con las herramientas MCP del proyecto.
 *
 *   GEMINI_API_KEY=... npx tsx scripts/mcp-ask.ts "¿dónde está la ISS ahora?"
 *
 * Es la forma de comprobar el circuito completo sin desplegar nada: catalogo
 * MCP → declaraciones de funciones → `generateContent` → `tools/call` →
 * respuesta. No usa la base de datos (no hay sesión), así que `db.select`
 * queda fuera por plan y por falta de puerto.
 *
 * Opcionales:
 *   GEMINI_MODEL   fija el modelo; si no, se descubre el mejor Flash disponible
 *                  (`gemini-1.5-flash` está retirado y responde 404).
 *   MCP_TIER       plan a simular: free (por defecto), pro o dao.
 */

import { createAiTorMcpServer } from "../src/lib/mcp";
import {
  createGeminiClient,
  createRateLimiter,
  runToolLoop,
} from "../src/lib/mcp/gemini";
import type { McpTier } from "../src/lib/mcp";

async function main() {
  const prompt = process.argv.slice(2).join(" ").trim();
  if (!prompt) {
    console.error('Uso: npx tsx scripts/mcp-ask.ts "tu pregunta"');
    process.exit(2);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("✖ Falta GEMINI_API_KEY (no se acepta en la línea de comandos del repo).");
    process.exit(2);
  }

  const tier = (process.env.MCP_TIER as McpTier) || "free";
  if (!["free", "pro", "dao"].includes(tier)) {
    console.error(`✖ MCP_TIER inválido: ${tier}`);
    process.exit(2);
  }

  const server = createAiTorMcpServer();
  const client = createGeminiClient({
    apiKey,
    model: process.env.GEMINI_MODEL || undefined,
  });

  console.log(`→ herramientas visibles (${tier}): ${server.listTools(tier).map((t) => t.name).join(", ")}`);

  const result = await runToolLoop({
    client,
    server,
    context: { tier, fetch },
    prompt,
    limiter: createRateLimiter(),
    systemInstruction:
      "Eres el operador de AI-TOR. Usa las herramientas cuando necesites telemetría orbital " +
      "o eventos OSINT, y di siempre la fuente y la hora del dato. Si una herramienta falla, " +
      "explícalo en vez de inventar cifras.",
  });

  console.log(`\nModelo: ${result.model}`);
  if (result.toolCalls.length > 0) {
    console.log("Herramientas usadas:");
    for (const call of result.toolCalls) {
      console.log(`  · ${call.name}${call.isError ? " (falló)" : ""} ${JSON.stringify(call.args)}`);
    }
  }
  console.log(`\n${result.text}`);
}

main().catch((error) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
