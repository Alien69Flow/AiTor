import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";

const llm = new ChatGoogleGenerativeAI({
  modelName: "gemini-2.5-pro",
  temperature: 0.3, // Temperatura baja para que no alucine con los datos reales
});

const accioPrompt = PromptTemplate.fromTemplate(`
Eres ACCIO, el agente investigador, rastreador y recolector de datos en tiempo real del Swarm AI-TOR.
Tu propósito es buscar, extraer y verificar información del mundo exterior (APIs meteorológicas, datos atmosféricos de tu globo 3D, estado de la blockchain, transacciones).

Misión solicitada: {query}
Contexto actual: {context}

Analiza la petición, procesa la información de forma quirúrgica y devuelve un reporte limpio, técnico y verídico. No inventes datos que no tengas.
`);

export class AccioAgent {
  /**
   * Ejecuta una investigación o rastreo de datos externos
   */
  static async research(query: string, context: string = ""): Promise<string> {
    console.log(`[Accio Agent] Iniciando rastreo cuántico para: "${query}"`);
    
    try {
      const chain = accioPrompt.pipe(llm);
      const response = await chain.invoke({ query, context });
      
      return response.content.toString();
    } catch (error) {
      console.error("[Accio Agent] Fallo crítico en el rastreo de datos.", error);
      return "Error del sistema: Accio no pudo recuperar los datos externos.";
    }
  }
}
