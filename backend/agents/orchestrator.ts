import { SupervisorAgent } from "./supervisor";
import { ThreadManager } from "../memory/threadManager";
import { KnowledgeBase } from "../rag/knowledge";
import { ManusAgent } from "./manus";
import { MonetizationManager } from "../workflows/monetizationLoop"; // Importamos tu flujo freemium
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

// Inicializamos un modelo general para las respuestas ordinarias
const llmGeneral = new ChatGoogleGenerativeAI({
  modelName: "gemini-2.5-flash", 
  temperature: 0.7,
});

export class SwarmOrchestrator {
  /**
   * El punto de entrada único para cualquier mensaje que llegue (Telegram, Web, etc.)
   */
  static async processMessage(chatId: string, userInput: string): Promise<string> {
    console.log(`\n[Orquestador] Nueva petición en Chat: ${chatId} -> "${userInput}"`);

    // 1. Recuperar la memoria de este usuario para no perder el hilo
    const history = ThreadManager.getHistory(chatId);
    
    // Guardamos el mensaje actual del usuario en su historial
    ThreadManager.addMessage(chatId, "user", userInput);

    // 2. El Supervisor toma el control y decide la ruta estratégica
    const route = await SupervisorAgent.routeRequest(userInput);

    // =========================================================================
    // 🔏 CANDADO DE MONETIZACIÓN TIERRADA (FREEMIUM / REGISTRO / SUSCRIPCIÓN)
    // =========================================================================
    const access = await MonetizationManager.checkAccess(chatId, route);
    if (!access.allowed) {
      const rejectionMsg = access.reason || "Límite de créditos alcanzado por hoy.";
      // Registramos el aviso en la memoria del bot para que sepa por qué se detuvo
      ThreadManager.addMessage(chatId, "assistant", rejectionMsg);
      return rejectionMsg; // Frenamos la ejecución antes de llamar a los LLM caros
    }

    let finalResponse = "";

    // 3. Enrutamiento dinámico según la decisión del Supervisor
    switch (route) {
      case "RAG_PHYSICS":
      case "MARKET_DAO": {
        // Activamos el Cerebro Cuántico: Extraemos tu conocimiento del 16.18 / Tesla
        const context = await KnowledgeBase.retrieveContext(route);
        
        console.log(`[Orquestador] Generando respuesta con RAG e inyección de contexto.`);
        const response = await llmGeneral.invoke([
          { role: "system", content: `Eres AI-TOR, la inteligencia central de AlienFlowSpace DAO. Responde al usuario utilizando estrictamente este contexto fundacional:\n${context}` },
          { role: "system", content: `Historial reciente:\n${history}` },
          { role: "user", content: userInput }
        ]);
        
        finalResponse = response.content.toString();
        break;
      }

      case "TASK_MANUS": {
        // Despertamos al ejecutor técnico
        finalResponse = await ManusAgent.executeTask(userInput, history);
        break;
      }

      case "CHAT_GENERAL":
      default: {
        // Chat normal, soporte o saludos
        console.log(`[Orquestador] Procesando como conversación general.`);
        const response = await llmGeneral.invoke([
          { role: "system", content: "Eres AI-TOR, un aliado inteligente, directo y avanzado. Estás ayudando al usuario a gestionar su ecosistema." },
          { role: "system", content: `Historial reciente:\n${history}` },
          { role: "user", content: userInput }
        ]);
        
        finalResponse = response.content.toString();
        break;
      }
    }

    // =========================================================================
    // 💳 COBRO DEL CONSUMO DIARIO
    // =========================================================================
    // Una vez que la IA ha respondido con éxito, le cargamos el coste a su cuenta
    await MonetizationManager.deductCredits(chatId, route);

    // 4. Guardamos la respuesta del sistema en la memoria para el próximo turno
    ThreadManager.addMessage(chatId, "assistant", finalResponse);

    return finalResponse;
  }
}
