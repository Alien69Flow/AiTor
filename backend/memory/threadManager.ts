// Gestor de Memoria en RAM (Para mantener el contexto en Telegram)

interface MessageContext {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export class ThreadManager {
  // Diccionario en memoria: { chatId: [mensajes] }
  private static memoryStore: Record<string, MessageContext[]> = {};
  private static MAX_HISTORY = 10; // Guardamos solo los últimos 10 mensajes para ahorrar tokens

  /**
   * Añade un mensaje al historial de un usuario
   */
  static addMessage(chatId: string, role: 'user' | 'assistant' | 'system', content: string) {
    if (!this.memoryStore[chatId]) {
      this.memoryStore[chatId] = [];
    }

    this.memoryStore[chatId].push({ role, content, timestamp: Date.now() });

    // Purgar mensajes viejos para no saturar al LLM
    if (this.memoryStore[chatId].length > this.MAX_HISTORY) {
      this.memoryStore[chatId].shift();
    }
  }

  /**
   * Recupera el historial formateado para dárselo a Manus o AI-TOR
   */
  static getHistory(chatId: string): string {
    const history = this.memoryStore[chatId];
    if (!history || history.length === 0) {
      return "No hay contexto previo de la conversación.";
    }

    return history.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n');
  }

  /**
   * Limpia la memoria (útil para cuando el usuario pide reiniciar)
   */
  static clearMemory(chatId: string) {
    delete this.memoryStore[chatId];
  }
}
