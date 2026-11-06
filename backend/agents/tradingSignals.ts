/**
 * 📈 Trading Signals Agent
 * Generación de señales de trading automatizadas
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";

const llm = new ChatGoogleGenerativeAI({
  modelName: "gemini-2.5-flash",
  temperature: 0.4,
});

export type SignalType = 'entry' | 'exit' | 'alert' | 'update';
export type SignalStrength = 'strong' | 'moderate' | 'weak';

export interface TradingSignal {
  id: string;
  symbol: string;
  type: SignalType;
  direction: 'long' | 'short';
  strength: SignalStrength;
  entryPrice: number;
  targetPrice?: number;
  stopLoss: number;
  timestamp: Date;
  expiresAt: Date;
  reason: string;
  riskReward?: number;
  timeframe: '1h' | '4h' | '1d' | '1w';
  status: 'active' | 'triggered' | 'expired' | 'cancelled';
}

export interface PriceAlert {
  id: string;
  symbol: string;
  condition: 'above' | 'below' | 'crosses';
  price: number;
  currentPrice: number;
  triggered: boolean;
  message: string;
  createdAt: Date;
}

class TradingSignalStore {
  private static signals: Map<string, TradingSignal> = new Map();
  private static alerts: Map<string, PriceAlert> = new Map();

  static addSignal(signal: TradingSignal): void {
    this.signals.set(signal.id, signal);
  }

  static getActiveSignals(): TradingSignal[] {
    return Array.from(this.signals.values())
      .filter(s => s.status === 'active' && s.expiresAt > new Date());
  }

  static getSignalBySymbol(symbol: string): TradingSignal[] {
    return Array.from(this.signals.values())
      .filter(s => s.symbol === symbol && s.status === 'active');
  }

  static updateSignalStatus(id: string, status: TradingSignal['status']): void {
    const signal = this.signals.get(id);
    if (signal) {
      signal.status = status;
    }
  }

  static addAlert(alert: PriceAlert): void {
    this.alerts.set(alert.id, alert);
  }

  static checkAlerts(prices: Map<string, number>): PriceAlert[] {
    const triggered: PriceAlert[] = [];

    this.alerts.forEach((alert, id) => {
      if (alert.triggered) return;

      const currentPrice = prices.get(alert.symbol);
      if (currentPrice === undefined) return;

      let isTriggered = false;
      
      switch (alert.condition) {
        case 'above':
          isTriggered = currentPrice > alert.price;
          break;
        case 'below':
          isTriggered = currentPrice < alert.price;
          break;
        case 'crosses':
          isTriggered = (alert.currentPrice < alert.price && currentPrice >= alert.price) ||
                        (alert.currentPrice > alert.price && currentPrice <= alert.price);
          break;
      }

      if (isTriggered) {
        alert.triggered = true;
        triggered.push(alert);
      }

      alert.currentPrice = currentPrice;
    });

    return triggered;
  }

  static cleanup(): void {
    const now = new Date();
    // Remove expired signals
    this.signals.forEach((signal, id) => {
      if (signal.expiresAt < now) {
        signal.status = 'expired';
      }
    });
    // Remove old triggered alerts
    this.alerts.forEach((alert, id) => {
      if (alert.triggered) {
        const hoursOld = (now.getTime() - alert.createdAt.getTime()) / (1000 * 60 * 60);
        if (hoursOld > 24) {
          this.alerts.delete(id);
        }
      }
    });
  }
}

const signalGenerationPrompt = PromptTemplate.fromTemplate(`
Eres el ANALISTA DE SEÑALES DE TRADING de AlienFlowSpace DAO.
Genera señales de trading basadas en análisis técnico.

DATOS DE PRECIOS:
{priceData}

INDICADORES TÉCNICOS:
{technicalData}

Instrucciones:
1. Identifica oportunidades de entrada/salida
2. Calcula ratio risk/reward
3. Define niveles de stop loss y take profit
4. Evalúa fuerza de la señal

Responde en formato JSON:
{
  "signals": [
    {
      "symbol": "BTC",
      "type": "entry",
      "direction": "long",
      "strength": "moderate",
      "entryPrice": 64000,
      "targetPrice": 66000,
      "stopLoss": 62000,
      "reason": "Rompimiento de resistencia",
      "riskReward": 2.5,
      "timeframe": "4h"
    }
  ]
}
`);

export class TradingSignals {
  /**
   * Genera nuevas señales de trading
   */
  static async generateSignals(prices: any[], technicalData: any[]): Promise<TradingSignal[]> {
    try {
      const chain = signalGenerationPrompt.pipe(llm);
      const response = await chain.invoke({
        priceData: JSON.stringify(prices.slice(0, 10)),
        technicalData: JSON.stringify(technicalData.slice(0, 10)),
      });

      const content = response.content.toString();
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const signals: TradingSignal[] = (parsed.signals || []).map((s: any) => ({
          ...s,
          id: `sig_${s.symbol}_${Date.now()}`,
          timestamp: new Date(),
          expiresAt: new Date(Date.now() + this.getExpiryTime(s.timeframe)),
          status: 'active' as const,
        }));

        signals.forEach(s => TradingSignalStore.addSignal(s));
        return signals;
      }
    } catch (error) {
      console.error("[TradingSignals] Error generating signals:", error);
    }

    return [];
  }

  /**
   * Crea una alerta de precio
   */
  static createPriceAlert(
    symbol: string,
    condition: PriceAlert['condition'],
    price: number,
    message: string
  ): PriceAlert {
    const alert: PriceAlert = {
      id: `alert_${symbol}_${Date.now()}`,
      symbol,
      condition,
      price,
      currentPrice: 0,
      triggered: false,
      message,
      createdAt: new Date(),
    };

    TradingSignalStore.addAlert(alert);
    return alert;
  }

  /**
   * Obtiene señales activas
   */
  static getActiveSignals(): TradingSignal[] {
    return TradingSignalStore.getActiveSignals();
  }

  /**
   * Obtiene señales por símbolo
   */
  static getSignalsBySymbol(symbol: string): TradingSignal[] {
    return TradingSignalStore.getSignalBySymbol(symbol);
  }

  /**
   * Verifica y retorna alertas disparadas
   */
  static checkPriceAlerts(prices: Map<string, number>): PriceAlert[] {
    return TradingSignalStore.checkAlerts(prices);
  }

  /**
   * Cancela una señal
   */
  static cancelSignal(id: string): boolean {
    TradingSignalStore.updateSignalStatus(id, 'cancelled');
    return true;
  }

  /**
   * Obtiene historial de señales
   */
  static getSignalHistory(limit: number = 50): TradingSignal[] {
    return Array.from(TradingSignalStore['signals'].values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Formatea señales para display
   */
  static formatSignalsReport(): string {
    const signals = this.getActiveSignals();
    
    if (signals.length === 0) {
      return "📊 **REPORTE DE SEÑALES**\n\nNo hay señales activas en este momento.";
    }

    let report = `📊 **SEÑALES ACTIVAS** (${signals.length})\n\n`;

    signals.forEach(s => {
      const emoji = s.direction === 'long' ? '🟢' : '🔴';
      const strengthEmoji = s.strength === 'strong' ? '💪' : s.strength === 'moderate' ? '⚡' : '📉';
      
      report += `${emoji} **${s.symbol}** ${strengthEmoji}\n`;
      report += `   Tipo: ${s.type} ${s.direction}\n`;
      report += `   Entrada: $${s.entryPrice.toLocaleString()}\n`;
      if (s.targetPrice) report += `   Objetivo: $${s.targetPrice.toLocaleString()}\n`;
      report += `   Stop Loss: $${s.stopLoss.toLocaleString()}\n`;
      if (s.riskReward) report += `   Risk/Reward: ${s.riskReward}x\n`;
      report += `   Timeframe: ${s.timeframe}\n`;
      report += `   Razón: ${s.reason}\n\n`;
    });

    return report;
  }

  private static getExpiryTime(timeframe: string): number {
    const timeouts: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
    };
    return timeouts[timeframe] || 4 * 60 * 60 * 1000;
  }
}
