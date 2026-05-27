import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";

const llm = new ChatGoogleGenerativeAI({
  modelName: "gemini-2.5-pro",
  temperature: 0.4, // Un poco más creativo que el Supervisor para resolver problemas
});

const manusPrompt = PromptTemplate.fromTemplate(`
Eres MANUS, el agente ejecutor técnico del Swarm AI-TOR.
Perteneces al ecosistema AlienFlowSpace DAO.
Tu objetivo es analizar la tarea solicitada y devolver un plan de ejecución estructurado y letal, listo para ser implementado o automatizado.

Tarea solicitada: {task}
Contexto del sistema: {context}

Devuelve la respuesta estructurada en pasos claros, sin rodeos.
`);

export class ManusAgent {
  /**
   * Ejecuta una tarea técnica o de automatización.
   */
  static async executeTask(task: string, context: string = "Sin contexto previo"): Promise<string> {
    console.log(`[Manus] Iniciando protocolo de ejecución para: "${task}"`);
    
    try {
      const chain = manusPrompt.pipe(llm);
      const response = await chain.invoke({ task, context });
      
      return response.content.toString();
    } catch (error) {
      console.error("[Manus] Fallo crítico en la ejecución de la tarea.", error);
      return "Error del sistema: Manus no pudo procesar la orden.";
    }
  }
}
