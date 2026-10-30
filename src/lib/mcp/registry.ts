import {
  JSON_RPC_ERRORS,
  MCP_PROTOCOL_VERSION,
  MCP_TIER_RANK,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type McpServerInfo,
  type McpTier,
  type McpToolDefinition,
  type McpToolResult,
} from "./types";

/**
 * Registro de herramientas MCP.
 *
 * Es el único sitio que decide quién puede ver y ejecutar cada herramienta, y
 * lo hace con el plan que llega del servidor (`profiles.tier`), nunca con algo
 * que envíe el cliente en la petición. Filtrar `tools/list` no es suficiente
 * por sí solo: `tools/call` vuelve a comprobar el plan, porque un cliente puede
 * pedir una herramienta que nunca llegó a listar.
 */

export class McpError extends Error {
  readonly code: number;
  readonly data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = "McpError";
    this.code = code;
    this.data = data;
  }
}

/** Consulta a tablas del proyecto de identidad, respetando el RLS del llamante. */
export interface McpDatabase {
  select(
    table: string,
    columns: string,
    limit: number,
    filters: Record<string, string>,
  ): Promise<Record<string, unknown>[]>;
}

export interface McpGitHub {
  /**
   * Llamada al proxy de GitHub, que es quien tiene el token y la allowlist.
   * La herramienta manda la acción y los parámetros; nunca credenciales.
   */
  call(params: Record<string, unknown>): Promise<unknown>;
}

export interface McpToolContext {
  /** Plan efectivo del llamante, resuelto en servidor. */
  tier: McpTier;
  /** Inyectado: el navegador usa la sesión, el servidor su propio cliente. */
  fetch: typeof fetch;
  db?: McpDatabase;
  /** Sólo existe cuando hay una identidad con permiso sobre el repositorio. */
  github?: McpGitHub;
}

export interface McpTool {
  definition: McpToolDefinition;
  run: (args: Record<string, unknown>, context: McpToolContext) => Promise<McpToolResult>;
}

export interface McpServer {
  info: McpServerInfo;
  /** Herramientas visibles para ese plan. */
  listTools: (tier: McpTier) => McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>, context: McpToolContext) => Promise<McpToolResult>;
  /** Despacha una petición JSON-RPC completa, como pide el protocolo. */
  handle: (request: JsonRpcRequest, context: McpToolContext) => Promise<JsonRpcResponse>;
}

export function allowedByTier(required: McpTier | undefined, tier: McpTier): boolean {
  return MCP_TIER_RANK[tier] >= MCP_TIER_RANK[required ?? "free"];
}

function ok(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function fail(id: string | number | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export function createMcpServer(options: {
  name: string;
  version: string;
  tools: McpTool[];
}): McpServer {
  const byName = new Map(options.tools.map((tool) => [tool.definition.name, tool]));

  const info: McpServerInfo = {
    name: options.name,
    version: options.version,
    protocolVersion: MCP_PROTOCOL_VERSION,
  };

  const listTools = (tier: McpTier): McpToolDefinition[] =>
    options.tools
      .filter((tool) => allowedByTier(tool.definition.minTier, tier))
      .map((tool) => tool.definition);

  const callTool = async (
    name: string,
    args: Record<string, unknown>,
    context: McpToolContext,
  ): Promise<McpToolResult> => {
    const tool = byName.get(name);
    if (!tool) {
      throw new McpError(JSON_RPC_ERRORS.METHOD_NOT_FOUND, `Herramienta desconocida: ${name}`);
    }
    if (!allowedByTier(tool.definition.minTier, context.tier)) {
      throw new McpError(
        JSON_RPC_ERRORS.FORBIDDEN,
        `La herramienta ${name} requiere el plan ${tool.definition.minTier ?? "free"} (tienes ${context.tier}).`,
      );
    }

    const missing = requiredMissing(tool.definition, args);
    if (missing.length > 0) {
      throw new McpError(
        JSON_RPC_ERRORS.INVALID_PARAMS,
        `Faltan parámetros obligatorios: ${missing.join(", ")}`,
      );
    }

    try {
      return await tool.run(args, context);
    } catch (error) {
      // Un fallo de la fuente no es un fallo del protocolo: se devuelve como
      // resultado marcado para que el modelo pueda explicarlo y seguir.
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `${name} falló: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  };

  const handle = async (
    request: JsonRpcRequest,
    context: McpToolContext,
  ): Promise<JsonRpcResponse> => {
    const id = request.id ?? null;

    if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
      return fail(id, JSON_RPC_ERRORS.INVALID_REQUEST, "Se esperaba JSON-RPC 2.0 con method.");
    }

    switch (request.method) {
      case "initialize":
        return ok(id, {
          protocolVersion: info.protocolVersion,
          serverInfo: { name: info.name, version: info.version },
          capabilities: { tools: { listChanged: false } },
          instructions:
            "Herramientas de AI-TOR: telemetría orbital, eventos OSINT y lecturas propias de la base de datos.",
        });

      case "ping":
        return ok(id, {});

      case "tools/list":
        return ok(id, { tools: listTools(context.tier) });

      case "tools/call": {
        const params = request.params ?? {};
        const name = params.name;
        if (typeof name !== "string" || !name) {
          return fail(id, JSON_RPC_ERRORS.INVALID_PARAMS, "tools/call necesita `name`.");
        }
        const rawArgs = params.arguments ?? {};
        if (typeof rawArgs !== "object" || rawArgs === null || Array.isArray(rawArgs)) {
          return fail(id, JSON_RPC_ERRORS.INVALID_PARAMS, "`arguments` debe ser un objeto.");
        }
        try {
          const result = await callTool(name, rawArgs as Record<string, unknown>, context);
          return ok(id, result);
        } catch (error) {
          if (error instanceof McpError) return fail(id, error.code, error.message);
          return fail(
            id,
            JSON_RPC_ERRORS.INTERNAL,
            error instanceof Error ? error.message : "Error ejecutando la herramienta",
          );
        }
      }

      default:
        return fail(id, JSON_RPC_ERRORS.METHOD_NOT_FOUND, `Método no soportado: ${request.method}`);
    }
  };

  return { info, listTools, callTool, handle };
}

function requiredMissing(definition: McpToolDefinition, args: Record<string, unknown>): string[] {
  return (definition.inputSchema.required ?? []).filter((key) => args[key] === undefined);
}

/** Envuelve datos en el formato de resultado MCP (texto + contenido estructurado). */
export function toolResult(
  structured: Record<string, unknown>,
  text?: string,
): McpToolResult {
  return {
    content: [{ type: "text", text: text ?? JSON.stringify(structured, null, 2) }],
    structuredContent: structured,
  };
}
