import { createMcpServer, type McpDatabase, type McpGitHub, type McpServer, type McpTool } from "./registry";
import { databaseTools } from "./tools/database";
import { githubTools } from "./tools/github";
import { osintTools } from "./tools/osint";
import { satelliteTools } from "./tools/satellites";
import { weatherTools } from "./tools/weather";

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

export const MCP_TOOLS: McpTool[] = [
  ...satelliteTools,
  ...osintTools,
  ...databaseTools,
  ...githubTools,
  ...weatherTools,
];

export function createAiTorMcpServer(options: { db?: McpDatabase; github?: McpGitHub } = {}): McpServer {
  const server = createMcpServer({
    name: "aitor-mcp",
    version: "1.0.0",
    tools: MCP_TOOLS,
  });

  if (!options.db && !options.github) return server;

  // Los puertos se inyectan al llamar, no se cierran aquí: el mismo servidor
  // sirve para un usuario con sesión y para el proceso de servidor, sin
  // arrastrar credenciales dentro del catálogo de herramientas.
  return {
    ...server,
    callTool: (name, args, context) =>
      server.callTool(name, args, { ...context, db: options.db, github: options.github }),
    handle: (request, context) =>
      server.handle(request, { ...context, db: options.db, github: options.github }),
  };
}

export { createMcpServer, McpError, allowedByTier, toolResult } from "./registry";
export type {
  McpDatabase,
  McpGitHub,
  McpServer,
  McpTool,
  McpToolContext,
} from "./registry";
export { branchName as githubBranchName } from "./tools/github";
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
