import type { McpServer, McpToolContext } from "./registry";
import type { JsonSchemaProperty, McpToolDefinition, McpTier } from "./types";

/**
 * Adaptador entre el catálogo MCP y la API de Gemini.
 *
 * Va por REST y no por un SDK a propósito: una dependencia menos que romper y
 * el mismo código sirve en Node, en una función de Vercel y en Deno. La clave
 * **nunca** se lee aquí; la recibe quien construye el cliente, que es el único
 * que debe tenerla (el servidor).
 *
 * Modelo: `gemini-1.5-flash` está retirado y responde 404, así que el modelo se
 * resuelve contra `/models` cuando no se fija uno a mano. Preferimos descubrirlo
 * a incrustar un nombre que caduque.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

/** Límites del free tier de la familia Flash. Se pueden endurecer por plan. */
export const FREE_TIER_LIMITS = { perMinute: 10, perDay: 1500 } as const;

/** Modelos que no sirven para function calling aunque respondan a generateContent. */
const NOT_A_CHAT_MODEL = /embedding|imagen|image|tts|veo|robotics|vision|learnlm/i;

export type GeminiSchemaType =
  | "STRING"
  | "NUMBER"
  | "INTEGER"
  | "BOOLEAN"
  | "ARRAY"
  | "OBJECT";

export interface GeminiSchema {
  type: GeminiSchemaType;
  description?: string;
  enum?: string[];
  items?: GeminiSchema;
  properties?: Record<string, GeminiSchema>;
  required?: string[];
  minimum?: number;
  maximum?: number;
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters?: GeminiSchema;
}

export interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

const SCHEMA_TYPES: Record<JsonSchemaProperty["type"], GeminiSchemaType> = {
  string: "STRING",
  number: "NUMBER",
  integer: "INTEGER",
  boolean: "BOOLEAN",
  array: "ARRAY",
  object: "OBJECT",
};

/** JSON Schema en minúsculas → `Schema` de Gemini en mayúsculas. */
export function toGeminiSchema(property: JsonSchemaProperty): GeminiSchema {
  const schema: GeminiSchema = { type: SCHEMA_TYPES[property.type] ?? "STRING" };
  if (property.description) schema.description = property.description;
  if (property.enum) schema.enum = property.enum;
  if (property.items) schema.items = toGeminiSchema(property.items);
  if (property.minimum !== undefined) schema.minimum = property.minimum;
  if (property.maximum !== undefined) schema.maximum = property.maximum;
  return schema;
}

/** Catálogo MCP → `tools` de Gemini, conservando el orden de las herramientas. */
export function toGeminiTools(
  definitions: McpToolDefinition[],
): Array<{ functionDeclarations: GeminiFunctionDeclaration[] }> {
  return [
    {
      functionDeclarations: definitions.map((definition) => {
        const declared: Record<string, JsonSchemaProperty> = definition.inputSchema.properties ?? {};
        const parameters: GeminiSchema = {
          type: "OBJECT",
          properties: Object.fromEntries(
            Object.entries(declared).map(([key, value]) => [key, toGeminiSchema(value)]),
          ),
        };
        if (definition.inputSchema.required?.length) {
          parameters.required = definition.inputSchema.required;
        }
        return {
          name: definition.name,
          description: definition.description,
          parameters,
        };
      }),
    },
  ];
}

/** Elige el modelo Flash utilizable más reciente del catálogo de la cuenta. */
export function pickModel(names: string[]): string | null {
  const usable = names
    .map((name) => name.replace(/^models\//, ""))
    .filter((name) => !NOT_A_CHAT_MODEL.test(name));
  if (usable.length === 0) return null;

  const score = (name: string) => {
    let value = 0;
    if (/flash/i.test(name)) value += 4;
    if (/lite/i.test(name)) value += 1;
    if (/preview|exp/i.test(name)) value -= 2;
    // Versión mayor y menor: 3.8 Flash gana a 3 Flash y a 2.5 Flash.
    const version = /gemini-(\d+)(?:\.(\d+))?/i.exec(name);
    if (version) value += Number(version[1]) * 2 + Number(version[2] ?? 0) / 10;
    return value;
  };

  return usable.sort((a, b) => score(b) - score(a))[0] ?? null;
}

export interface RateLimitVerdict {
  ok: boolean;
  reason?: string;
  retryAfterMs?: number;
}

/** Límite de peticiones en memoria. Una instancia por proceso: es una defensa
 *  básica, no un sustituto de la cuota real de Google. */
export function createRateLimiter(
  options: { perMinute?: number; perDay?: number; now?: () => number } = {},
) {
  const perMinute = options.perMinute ?? FREE_TIER_LIMITS.perMinute;
  const perDay = options.perDay ?? FREE_TIER_LIMITS.perDay;
  const now = options.now ?? Date.now;
  const minute: number[] = [];
  let day = { start: now(), count: 0 };

  return {
    check(): RateLimitVerdict {
      const current = now();
      while (minute.length > 0 && current - minute[0] > 60_000) minute.shift();
      if (current - day.start > 86_400_000) day = { start: current, count: 0 };

      if (day.count >= perDay) {
        return { ok: false, reason: "cuota diaria agotada", retryAfterMs: day.start + 86_400_000 - current };
      }
      if (minute.length >= perMinute) {
        return { ok: false, reason: "demasiadas peticiones por minuto", retryAfterMs: minute[0] + 60_000 - current };
      }
      minute.push(current);
      day.count += 1;
      return { ok: true };
    },
  };
}

export interface GeminiClientOptions {
  apiKey: string;
  /** Fijar el modelo salta el descubrimiento (útil para anclar uno concreto). */
  model?: string;
  fetch?: typeof fetch;
}

export interface GeminiClient {
  /** Modelo resuelto: el fijado o el mejor del catálogo. */
  model: () => Promise<string>;
  listModels: () => Promise<string[]>;
  generateContent: (body: Record<string, unknown>) => Promise<{ model: string; content: GeminiContent }>;
}

export function createGeminiClient(options: GeminiClientOptions): GeminiClient {
  if (!options.apiKey) throw new Error("Falta GEMINI_API_KEY");
  const doFetch = options.fetch ?? fetch;
  let resolved = options.model ?? null;

  const listModels = async (): Promise<string[]> => {
    const response = await doFetch(`${API_BASE}/models`, {
      headers: { "x-goog-api-key": options.apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Gemini /models respondió ${response.status}`);
    const payload = (await response.json()) as {
      models?: { name: string; supportedGenerationMethods?: string[] }[];
    };
    return (payload.models ?? [])
      .filter((model) => (model.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((model) => model.name.replace(/^models\//, ""));
  };

  const model = async (): Promise<string> => {
    if (resolved) return resolved;
    const chosen = pickModel(await listModels());
    if (!chosen) throw new Error("La cuenta no expone ningún modelo de chat con generateContent");
    resolved = chosen;
    return chosen;
  };

  const generateContent = async (body: Record<string, unknown>) => {
    const name = await model();
    const response = await doFetch(`${API_BASE}/models/${name}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": options.apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Gemini ${response.status}: ${detail.slice(0, 300)}`);
    }
    const payload = (await response.json()) as {
      candidates?: { content?: { role?: string; parts?: GeminiPart[] } }[];
    };
    const content = payload.candidates?.[0]?.content;
    if (!content?.parts?.length) throw new Error("Gemini devolvió una respuesta sin partes");
    return { model: name, content: { role: "model" as const, parts: content.parts } };
  };

  return { model, listModels, generateContent };
}

export interface ToolLoopResult {
  text: string;
  model: string;
  toolCalls: Array<{ name: string; args: Record<string, unknown>; isError: boolean }>;
}

/**
 * Pregunta al modelo dejándole invocar las herramientas MCP.
 *
 * El bucle está acotado: cada ronda puede pedir herramientas, y como mucho
 * `maxRounds` vueltas. Sin ese tope, un modelo empeñado en llamar herramientas
 * gastaría la cuota del free tier en un solo turno.
 */
export async function runToolLoop(options: {
  client: GeminiClient;
  server: McpServer;
  context: McpToolContext;
  prompt: string;
  systemInstruction?: string;
  maxRounds?: number;
  limiter?: ReturnType<typeof createRateLimiter>;
}): Promise<ToolLoopResult> {
  const maxRounds = options.maxRounds ?? 3;
  const limiter = options.limiter ?? createRateLimiter();
  const tools = toGeminiTools(options.server.listTools(options.context.tier));

  const contents: GeminiContent[] = [{ role: "user", parts: [{ text: options.prompt }] }];
  const toolCalls: ToolLoopResult["toolCalls"] = [];
  let model = "";

  for (let round = 0; round < maxRounds; round++) {
    const verdict = limiter.check();
    if (!verdict.ok) {
      throw new Error(`Límite de peticiones: ${verdict.reason} (reintenta en ${Math.ceil((verdict.retryAfterMs ?? 0) / 1000)} s)`);
    }

    const body: Record<string, unknown> = { contents };
    if (tools[0].functionDeclarations.length > 0) body.tools = tools;
    if (options.systemInstruction) {
      body.systemInstruction = { parts: [{ text: options.systemInstruction }] };
    }

    const { model: usedModel, content } = await options.client.generateContent(body);
    model = usedModel;

    const calls = content.parts.filter((part) => part.functionCall?.name);
    if (calls.length === 0) {
      const text = content.parts
        .map((part) => part.text ?? "")
        .join("")
        .trim();
      return { text, model, toolCalls };
    }

    contents.push(content);
    const responses: GeminiPart[] = [];

    for (const part of calls) {
      const name = part.functionCall?.name as string;
      const args = part.functionCall?.args ?? {};
      const result = await options.server.callTool(name, args, options.context);
      toolCalls.push({ name, args, isError: result.isError === true });
      responses.push({
        functionResponse: {
          name,
          response: result.structuredContent ?? { text: result.content[0]?.text ?? "" },
        },
      });
    }

    contents.push({ role: "user", parts: responses });
  }

  return {
    text: "Se agotaron las rondas de herramientas sin una respuesta final.",
    model,
    toolCalls,
  };
}

/** Plan por defecto de una cuenta sin `profiles.tier` legible. */
export const DEFAULT_TIER: McpTier = "free";
