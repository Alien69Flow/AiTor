import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";

// Inicializamos el modelo de Gemini (Asegúrate de tener GEMINI_API_KEY en tu .env)
const llm = new ChatGoogleGenerativeAI({
  modelName: "gemini-2.5-pro",
  maxOutputTokens: 2048,
  temperature: 0.2, // Temperatura baja para que tome decisiones frías y precisas
});

// El prompt cuántico del Supervisor
const supervisorPrompt = PromptTemplate.fromTemplate(`
Eres el Supervisor Central del Swarm AI-TOR. 
Tu única misión es analizar el mensaje del usuario y clasificarlo en una de estas categorías para derivarlo al agente adecuado.

CATEGORÍAS DISPONIBLES:
1. "RAG_PHYSICS": Si el mensaje habla de Nikola Tesla, neutrinos, factor 16.18, gravedad, frecuencias o física unificada.
2. "MARKET_DAO": Si el mensaje habla de liquidez, AlienFlowSpace DAO, tokens, o mercados DeFi.
3. "TASK_MANUS": Si el usuario pide automatizar algo, ejecutar código, o buscar información externa.
4. "CHAT_GENERAL": Para saludos, soporte general o cualquier otra cosa.

Mensaje del usuario: {input}

Responde ÚNICAMENTE con el nombre exacto de la categoría. No añadas texto extra.
`);

export class SupervisorAgent {
  /**
   * Analiza el input y decide qué módulo del sistema debe procesarlo.
   */
  static async routeRequest(userInput: string): Promise<string> {
    try {
      const chain = supervisorPrompt.pipe(llm);
      const decision = await chain.invoke({ input: userInput });
      
      // Limpiamos la respuesta por si el LLM añade espacios
      const route = decision.content.toString().trim();
      console.log(`[Supervisor] Ruta decidida: ${route} para el input: "${userInput}"`);
      
      return route;
    } catch (error) {
      console.error("[Supervisor] Error al enrutar. Fallback a CHAT_GENERAL.", error);
      return "CHAT_GENERAL";
    }
  }
}
