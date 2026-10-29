import { createMcpServer, type McpDatabase, type McpServer, type McpTool } from "./registry";
import { databaseTools } from "./tools/database";
import { osintTools } from "./tools/osint";
import { satelliteTools } from "./tools/satellites";

/**
 * Servidor MCP local de AI-TOR.
 *
 * Agrupa las herramientas que el proyecto ya sabe servir —telemetría orbital,
 * OSINT y las filas propias de Supabase— detrás de la interfaz estándar
 * (`initialize` / `tools/list` / `tools/call`), para que cualquier cliente MCP
 * o un modelo con *function calling* las use igual.
 *
 * Es isomorfo a propósito: el navegador lo crea con la sesión del usuario y el
 * RLS decide las filas; una función de servidor lo crea con su propio cliente y
 * ahí es donde vive la clave del modelo. Ninguna herramienta lee variables de
 * entorno ni conoce credenciales.
 */

export const MCP_TOOLS: McpTool[] = [...satelliteTools, ...osintTools, ...databaseTools];

export function createAiTorMcpServer(options: { db?: McpDatabase } = {}): McpServer {
  const server = createMcpServer({
    name: "aitor-mcp",
    version: "1.0.0",
    tools: MCP_TOOLS,
  });

  if (!options.db) return server;

  // El puerto de base de datos se inyecta al llamar, no se cierra aquí: el
  // mismo servidor sirve para un usuario con sesión y para el proceso de
  // servidor, sin arrastrar credenciales dentro del catálogo de herramientas.
  return {
    ...server,
    callTool: (name, args, context) => server.callTool(name, args, { ...context, db: options.db }),
    handle: (request, context) => server.handle(request, { ...context, db: options.db }),
  };
}

export { createMcpServer, McpError, allowedByTier, toolResult } from "./registry";
export type {
  McpDatabase,
  McpServer,
  McpTool,
  McpToolContext,
} from "./registry";
export { MCP_PROTOCOL_VERSION, MCP_TIER_RANK, JSON_RPC_ERRORS } from "./types";
export type {
  JsonRpcRequest,
  JsonRpcResponse,
  McpServerInfo,
  McpTier,
  McpToolDefinition,
  McpToolResult,
} from "./types";
export { READABLE_TABLES } from "./tools/database";
