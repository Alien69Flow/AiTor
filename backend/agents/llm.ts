import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

export interface GeminiModelOptions {
  /** Por defecto `gemini-2.5-flash`, el que entra en el plan gratuito. */
  modelName?: string;
  maxOutputTokens?: number;
  temperature?: number;
}

/**
 * Devuelve un `get()` que construye el modelo la **primera** vez que se pide.
 *
 * Antes cada agente hacía `const llm = new ChatGoogleGenerativeAI(...)` al
 * importarse, y el constructor lanza si no hay clave: con `GEMINI_API_KEY`
 * ausente, arrancar el servidor (o pedir `/health`, o listar herramientas MCP)
 * mataba el proceso entero por un módulo que ni siquiera se iba a usar.
 *
 * Ahora el fallo ocurre cuando de verdad se pide una respuesta, que es donde
 * cada agente ya lo captura y sigue por su camino de respaldo.
 */
export function createGeminiModel(options: GeminiModelOptions = {}): () => ChatGoogleGenerativeAI {
  let model: ChatGoogleGenerativeAI | null = null;
  return () => {
    if (model) return model;
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("Falta GEMINI_API_KEY: no se puede consultar al modelo.");
    }
    model = new ChatGoogleGenerativeAI({
      apiKey,
      modelName: options.modelName ?? "gemini-2.5-flash",
      ...(options.maxOutputTokens ? { maxOutputTokens: options.maxOutputTokens } : {}),
      temperature: options.temperature ?? 0.7,
    });
    return model;
  };
}
