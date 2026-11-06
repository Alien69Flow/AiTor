/**
 * 🔄 Social Automation Loops
 * Sistema de automatización para generar contenido según diferentes frecuencias
 */

import { SocialMediaManager, FrequencyType, SocialContent } from "../agents/socialMediaManager";
import { ProposalQueue } from "./socialProposalQueue";
import { SocialPublisher } from "../socialPublisher";

export interface AutomationConfig {
  enabled: boolean;
  frequency: FrequencyType;
  lastRun?: Date;
  nextRun?: Date;
  autoApprove?: boolean; // Si true, approved automáticamente (no recomendado)
  platforms?: string[];
  theme?: string;
  tone?: 'technical' | 'casual' | 'professional' | 'inspirational';
}

export class SocialAutomationLoops {
  private static configs: Map<FrequencyType, AutomationConfig> = new Map();
  private static timers: Map<FrequencyType, NodeJS.Timeout> = new Map();

  /**
   * Inicializa las configuraciones por defecto
   */
  static initialize(): void {
    this.configs.set('daily', {
      enabled: true,
      frequency: 'daily',
      autoApprove: false,
      platforms: ['twitter', 'linkedin', 'telegram'],
      tone: 'technical',
    });

    this.configs.set('weekly', {
      enabled: true,
      frequency: 'weekly',
      autoApprove: false,
      platforms: ['twitter', 'linkedin', 'instagram', 'discord'],
      tone: 'professional',
    });

    this.configs.set('monthly', {
      enabled: true,
      frequency: 'monthly',
      autoApprove: false,
      platforms: ['linkedin', 'hackmd'],
      tone: 'professional',
    });

    this.configs.set('quarterly', {
      enabled: true,
      frequency: 'quarterly',
      autoApprove: false,
      platforms: ['hackmd', 'github'],
      tone: 'inspirational',
    });

    this.configs.set('yearly', {
      enabled: false, // Deshabilitado por defecto - requiere revisión manual
      frequency: 'yearly',
      autoApprove: false,
      platforms: ['hackmd'],
      tone: 'inspirational',
    });

    console.log('[AutomationLoops] Configuraciones inicializadas');
  }

  /**
   * Inicia el loop de automatización
   */
  static start(): void {
    this.initialize();
    
    // Programar loops basados en frecuencia
    this.scheduleNext('daily');
    this.scheduleNext('weekly');
    this.scheduleNext('monthly');
    this.scheduleNext('quarterly');
    
    console.log('[AutomationLoops] Loops de automatización iniciados');
  }

  /**
   * Detiene todos los loops
   */
  static stop(): void {
    for (const [freq, timer] of this.timers.entries()) {
      clearTimeout(timer);
      this.timers.delete(freq);
    }
    console.log('[AutomationLoops] Loops de automatización detenidos');
  }

  /**
   * Ejecuta un ciclo de generación para una frecuencia específica
   */
  static async runCycle(frequency: FrequencyType): Promise<{
    success: boolean;
    proposalsGenerated: number;
    summary: string;
  }> {
    const config = this.configs.get(frequency);
    
    if (!config || !config.enabled) {
      console.log(`[AutomationLoops] ${frequency} no está habilitado`);
      return { success: false, proposalsGenerated: 0, summary: 'Loop deshabilitado' };
    }

    console.log(`[AutomationLoops] Ejecutando ciclo ${frequency}...`);
    
    try {
      const { proposals, summary } = await SocialMediaManager.generateContent(frequency, {
        platform: config.platforms?.[0] as any,
        theme: config.theme,
        tone: config.tone,
      });

      config.lastRun = new Date();
      this.scheduleNext(frequency);

      return {
        success: true,
        proposalsGenerated: proposals.length,
        summary: `${proposals.length} propuesta(s) de ${frequency} generadas. ${summary}`,
      };
    } catch (error) {
      console.error(`[AutomationLoops] Error en ciclo ${frequency}:`, error);
      return {
        success: false,
        proposalsGenerated: 0,
        summary: `Error ejecutando ciclo ${frequency}`,
      };
    }
  }

  /**
   * Programa el próximo ciclo
   */
  private static scheduleNext(frequency: FrequencyType): void {
    const config = this.configs.get(frequency);
    if (!config) return;

    const delays: Record<FrequencyType, number> = {
      daily: 24 * 60 * 60 * 1000,      // 24 horas
      weekly: 7 * 24 * 60 * 60 * 1000, // 7 días
      monthly: 30 * 24 * 60 * 60 * 1000, // 30 días
      quarterly: 90 * 24 * 60 * 60 * 1000, // 90 días
      yearly: 365 * 24 * 60 * 60 * 1000,  // 365 días
    };

    // Para la primera ejecución, usar tiempos específicos del día
    const baseDelay = delays[frequency];
    let initialDelay = baseDelay;

    if (!config.lastRun) {
      // Primera ejecución - programar para hora óptima
      const now = new Date();
      const optimalHours: Record<FrequencyType, number> = {
        daily: 9,    // 9 AM
        weekly: 10,  // Lunes 10 AM
        monthly: 9,  // Día 1 del mes 9 AM
        quarterly: 9,
        yearly: 9,
      };

      const nextRun = new Date();
      nextRun.setHours(optimalHours[frequency], 0, 0, 0);
      
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + (frequency === 'weekly' ? 7 : 1));
      }

      initialDelay = nextRun.getTime() - now.getTime();
      config.nextRun = nextRun;
    } else {
      config.nextRun = new Date(config.lastRun.getTime() + baseDelay);
    }

    // Limpiar timer anterior si existe
    const existingTimer = this.timers.get(frequency);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Programar nuevo timer
    const timer = setTimeout(async () => {
      await this.runCycle(frequency);
    }, initialDelay);

    this.timers.set(frequency, timer);
    
    console.log(`[AutomationLoops] ${frequency} programado para ${config.nextRun?.toISOString()}`);
  }

  /**
   * Obtiene el estado de todos los loops
   */
  static getStatus(): {
    loops: Record<FrequencyType, AutomationConfig & { isRunning: boolean }>;
    stats: ReturnType<typeof ProposalQueue.getStats>;
  } {
    const loops: any = {};
    
    for (const [freq, config] of this.configs.entries()) {
      loops[freq] = {
        ...config,
        isRunning: this.timers.has(freq),
      };
    }

    return {
      loops,
      stats: ProposalQueue.getStats(),
    };
  }

  /**
   * Actualiza la configuración de un loop
   */
  static configure(frequency: FrequencyType, updates: Partial<AutomationConfig>): boolean {
    const config = this.configs.get(frequency);
    if (!config) return false;

    Object.assign(config, updates);
    this.scheduleNext(frequency);
    
    console.log(`[AutomationLoops] Configuración de ${frequency} actualizada`);
    return true;
  }

  /**
   * Ejecuta inmediatamente un ciclo (útil para testing o ejecución manual)
   */
  static async runNow(frequency: FrequencyType): Promise<{
    success: boolean;
    proposalsGenerated: number;
    summary: string;
  }> {
    return this.runCycle(frequency);
  }

  /**
   * Procesa todas las propuestas aprobadas (ejecuta publicaciones programadas)
   */
  static async processScheduledPublications(): Promise<number> {
    const results = await SocialPublisher.processApprovedProposals();
    return results.filter(r => r.success).length;
  }
}
