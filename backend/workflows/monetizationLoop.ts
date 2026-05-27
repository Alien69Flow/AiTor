export type PlanTier = 'free' | 'registered' | 'basic' | 'pro' | 'quantum';

export interface UserAccount {
  telegramId: string;
  tier: PlanTier;
  isRegistered: boolean;
  dailyCreditsUsed: number;
  lastResetTime: number; // Timestamp para controlar las 24 horas
}

export class MonetizationManager {
  // Simulación de base de datos en RAM con usuarios en diferentes estados
  private static mockDatabase: Record<string, UserAccount> = {
    "test_anonimo": { telegramId: "test_anonimo", tier: 'free', isRegistered: false, dailyCreditsUsed: 0, lastResetTime: Date.now() },
    "test_registrado": { telegramId: "test_registrado", tier: 'registered', isRegistered: true, dailyCreditsUsed: 0, lastResetTime: Date.now() }
  };

  // Límites de créditos diarios por Plan
  private static TIER_LIMITS: Record<PlanTier, number> = {
    'free': 5,          // 5 créditos/día para cualquiera que entre
    'registered': 15,   // 15 créditos/día si se registra e inicia sesión
    'basic': 60,        // Plan Barato: 60 créditos/día
    'pro': 200,         // Plan Medio: 200 créditos/día
    'quantum': 99999    // Plan Caro: Acceso ilimitado total a la Física y a Manus
  };

  /**
   * Calcula el coste de ejecución según la ruta del Supervisor
   */
  private static calculateCost(route: string): number {
    switch (route) {
      case "TASK_MANUS": return 5;     // Manus consume mucha potencia
      case "RAG_PHYSICS":
      case "MARKET_DAO": return 2;     // Consultar el RAG del 16.18 cuesta un poco más
      case "CHAT_GENERAL":
      default: return 1;
    }
  }

  /**
   * Verifica los límites del usuario y procesa el reseteo de 24 horas
   */
  static async checkAccess(chatId: string, route: string): Promise<{ allowed: boolean; reason?: string }> {
    // Si el usuario no existe en la base de datos, lo creamos como Free Anónimo
    if (!this.mockDatabase[chatId]) {
      this.mockDatabase[chatId] = {
        telegramId: chatId,
        tier: 'free',
        isRegistered: false,
        dailyCreditsUsed: 0,
        lastResetTime: Date.now()
      };
    }

    const user = this.mockDatabase[chatId];
    const currentTime = Date.now();
    const oneDayInMs = 24 * 60 * 60 * 1000;

    // Comprobamos si han pasado 24 horas para resetear su consumo diario
    if (currentTime - user.lastResetTime > oneDayInMs) {
      user.dailyCreditsUsed = 0;
      user.lastResetTime = currentTime;
      console.log(`[Monetización] Ciclo de 24h cumplido para ${chatId}. Créditos diarios reseteados.`);
    }

    const cost = this.calculateCost(route);
    const limit = this.TIER_LIMITS[user.tier];
    const creditsLeft = limit - user.dailyCreditsUsed;

    if (creditsLeft < cost) {
      // Generamos un mensaje dinámico de venta según su estado actual
      let upsellMessage = `⚠️ Has agotado tus créditos gratis de hoy (${user.dailyCreditsUsed}/${limit} usados).\n\n`;
      
      if (!user.isRegistered) {
        upsellMessage += `🚀 *¡Amplía gratis!* Registrate e inicia sesión en nuestra plataforma para subir a **15 créditos diarios** de forma inmediata.\n\n🔗 [Registrarse en AlienFlowSpace]`;
      } else if (user.tier === 'registered') {
        upsellMessage += `💎 *Elige tu plan en la DAO:*\n` +
                         `• *Plan Esencial:* 60 créditos/día (Ideal para consultas frecuentes)\n` +
                         `• *Plan Avanzado:* 200 créditos/día (Para uso intensivo de Manus)\n` +
                         `• *Plan Quantum:* Ilimitado + Acceso prioritario a la Singularidad.\n\n` +
                         `🔗 [Ver Planes de Suscripción]`;
      } else {
        upsellMessage += `💼 Tu plan actual (${user.tier.toUpperCase()}) se ha quedado corto para tu ritmo de trabajo de hoy. Considera subir de nivel para no frenar tus ejecuciones.`;
      }

      return { allowed: false, reason: upsellMessage };
    }

    return { allowed: true };
  }

  /**
   * Suma el coste al contador de consumo diario del usuario
   */
  static async deductCredits(chatId: string, route: string): Promise<void> {
    const user = this.mockDatabase[chatId];
    if (user) {
      const cost = this.calculateCost(route);
      user.dailyCreditsUsed += cost;
      const limit = this.TIER_LIMITS[user.tier];
      console.log(`[Monetización] Chat ${chatId} consumió ${cost} créditos. Estado actual: ${user.dailyCreditsUsed}/${limit}`);
    }
  }
}
