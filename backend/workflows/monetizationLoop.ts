export interface UserAccount {
  telegramId: string;
  walletAddress?: string;
  credits: number;
  isPremium: boolean; // Miembros activos de la DAO con acceso ilimitado
}

export class MonetizationManager {
  // Base de datos temporal en memoria para pruebas
  private static mockDatabase: Record<string, UserAccount> = {
    "admin_test": { telegramId: "admin_test", credits: 100, isPremium: true },
    "usuario_comun": { telegramId: "usuario_comun", credits: 3, isPremium: false }
  };

  /**
   * Calcula el coste computacional según el agente que se vaya a despertar
   */
  private static calculateCost(route: string): number {
    switch (route) {
      case "TASK_MANUS":
        return 5; // Automatizar tareas con Manus consume más recursos
      case "RAG_PHYSICS":
      case "MARKET_DAO":
        return 2; // El Cerebro Cuántico requiere consultas pesadas al RAG
      case "CHAT_GENERAL":
      default:
        return 1; // Una respuesta de chat básica
    }
  }

  /**
   * Intercepta la petición y comprueba si el usuario puede pagar la consulta
   */
  static async checkAccess(chatId: string, route: string): Promise<{ allowed: boolean; reason?: string }> {
    console.log(`[Monetización] Validando acceso para Chat: ${chatId} en ruta: ${route}`);

    // Si el usuario no existe, lo registramos con un saldo de bienvenida de 10 créditos
    if (!this.mockDatabase[chatId]) {
      this.mockDatabase[chatId] = {
        telegramId: chatId,
        credits: 10,
        isPremium: false
      };
      console.log(`[Monetización] Usuario nuevo detectado. Otorgados 10 créditos de prueba.`);
    }

    const user = this.mockDatabase[chatId];

    // Si es miembro Premium de la DAO, no gasta créditos, pasa directo
    if (user.isPremium) {
      return { allowed: true };
    }

    const cost = this.calculateCost(route);

    if (user.credits < cost) {
      return {
        allowed: false,
        reason: `⚠️ Saldo insuficiente.\n\nEsta acción con el agente requiere *${cost} créditos* y actualmente te quedan *${user.credits}*.\n\nPara seguir operando con el Swarm, recarga créditos a través de la DApp de AlienFlowSpace DAO.`
      };
    }

    return { allowed: true };
  }

  /**
   * Descuenta los créditos tras una ejecución exitosa de la IA
   */
  static async deductCredits(chatId: string, route: string): Promise<number> {
    const user = this.mockDatabase[chatId];
    if (user && !user.isPremium) {
      const cost = this.calculateCost(route);
      user.credits -= cost;
      console.log(`[Monetización] Descontados ${cost} créditos a ${chatId}. Saldo restante: ${user.credits}`);
      return user.credits;
    }
    return user ? user.credits : 0;
  }
}
