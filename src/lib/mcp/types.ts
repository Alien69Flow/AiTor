/**
 * Tipos del protocolo MCP (Model Context Protocol) sobre JSON-RPC 2.0.
 *
 * Se declaran aquí y no se importa ningún SDK: el transporte es HTTP y el
 * formato son cuatro métodos (`initialize`, `ping`, `tools/list`, `tools/call`).
 * Con eso el mismo servidor local sirve para el navegador (herramientas
 * públicas, RLS del usuario) y para una función de servidor (donde vive la
 * clave del modelo), sin acoplar el proyecto a la versión de un paquete.
 */

/** Planes de acceso. `free` es el de por defecto; `pro` y `dao` son de pago. */
export type McpTier = "free" | "pro" | "dao";

export const MCP_TIER_RANK: Record<McpTier, number> = { free: 0, pro: 1, dao: 2 };

/** Esquema de entrada de una herramienta: el subconjunto de JSON Schema que
 *  entienden tanto MCP como la API de Gemini (objeto plano de propiedades). */
export interface JsonSchema {
  type: "object";
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
}

export interface JsonSchemaProperty {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description?: string;
  enum?: string[];
  items?: JsonSchemaProperty;
  minimum?: number;
  maximum?: number;
  default?: unknown;
}

export interface McpToolDefinition {
  /** Identificador único y estable: `dominio.accion`. */
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  /** Plan mínimo que puede verla y ejecutarla. Por defecto, `free`. */
  minTier?: McpTier;
}

export interface McpTextContent {
  type: "text";
  text: string;
}

export interface McpToolResult {
  content: McpTextContent[];
  /** `true` cuando la herramienta falló al ejecutarse (no es un error de protocolo). */
  isError?: boolean;
  /** Mismo contenido que `content`, ya parseado, para quien no quiera releer texto. */
  structuredContent?: Record<string, unknown>;
}

export interface McpServerInfo {
  name: string;
  version: string;
  protocolVersion: string;
}

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcErrorBody {
  code: number;
  message: string;
  data?: unknown;
}

export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: string | number | null; result: unknown }
  | { jsonrpc: "2.0"; id: string | number | null; error: JsonRpcErrorBody };

/** Códigos que usa el servidor. `-32003` y `-32029` son de este proyecto. */
export const JSON_RPC_ERRORS = {
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL: -32603,
  FORBIDDEN: -32003,
  RATE_LIMITED: -32029,
} as const;

export const MCP_PROTOCOL_VERSION = "2024-11-05";
