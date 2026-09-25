/**
 * 📈 Market Automation Loops
 * Loops automatizados para monitoreo de mercado
 */

import { MarketAnalyzer, PriceData } from "../agents/marketAnalyzer";
import { TradingSignals, PriceAlert } from "../agents/tradingSignals";
import { PortfolioManager } from "../agents/portfolioManager";

export interface PriceAlertConfig {
  symbol: string;
  condition: 'above' | 'below' | 'crosses';
  price: number;
  message: string;
  notifyTelegram?: boolean;
  notifyEmail?: boolean;
}

export interface WhaleAlert {
  address: string;
  symbol: string;
  amount: number;
  usdValue: number;
  type: 'buy' | 'sell' | 'transfer';
  timestamp: Date;
}

export interface TVLData {
  protocol: string;
  tvl: number;
  change24h: number;
  category: string;
}

class MarketLoopStore {
  private static alerts: Map<string, PriceAlertConfig> = new Map();
  private static whaleAlerts: WhaleAlert[] = [];
  private static tvlData: Map<string, TVLData> = new Map();
  private static lastPrices: Map<string, number> = new Map();

  static addPriceAlert(config: PriceAlertConfig): void {
    this.alerts.set(`${config.symbol}_${config.condition}_${config.price}`, config);
  }

  static removePriceAlert(key: string): boolean {
    return this.alerts.delete(key);
  }

  static getPriceAlerts(): PriceAlertConfig[] {
    return Array.from(this.alerts.values());
  }

  static getAlertsForSymbol(symbol: string): PriceAlertConfig[] {
    return Array.from(this.alerts.values()).filter(a => a.symbol === symbol);
  }

  static addWhaleAlert(alert: WhaleAlert): void {
    this.whaleAlerts.unshift(alert);
    if (this.whaleAlerts.length > 100) {
      this.whaleAlerts.pop();
    }
  }

  static getWhaleAlerts(limit: number = 20): WhaleAlert[] {
    return this.whaleAlerts.slice(0, limit);
  }

  static setTVL(protocol: string, data: TVLData): void {
    this.tvlData.set(protocol, data);
  }

  static getTVL(protocol?: string): TVLData | TVLData[] {
    if (protocol) {
      return this.tvlData.get(protocol) as TVLData;
    }
    return Array.from(this.tvlData.values());
  }

  static updateLastPrice(symbol: string, price: number): void {
    this.lastPrices.set(symbol, price);
  }

  static getLastPrice(symbol: string): number | undefined {
    return this.lastPrices.get(symbol);
  }
}

export class MarketLoops {
  private static priceCheckInterval: NodeJS.Timeout | null = null;
  private static tvlInterval: NodeJS.Timeout | null = null;
  private static whaleInterval: NodeJS.Timeout | null = null;

  /**
   * Configura una alerta de precio
   */
  static setPriceAlert(config: PriceAlertConfig): PriceAlert {
    MarketLoopStore.addPriceAlert(config);
    
    return TradingSignals.createPriceAlert(
      config.symbol,
      config.condition,
      config.price,
      config.message
    );
  }

  /**
   * Remueve una alerta de precio
   */
  static removePriceAlert(symbol: string, condition: string, price: number): boolean {
    const key = `${symbol}_${condition}_${price}`;
    return MarketLoopStore.removePriceAlert(key);
  }

  /**
   * Inicia el loop de monitoreo de precios
   */
  static startPriceMonitoring(
    prices: PriceData[],
    onAlert?: (alert: PriceAlert) => void,
    intervalMs: number = 60000
  ): void {
    if (this.priceCheckInterval) {
      clearInterval(this.priceCheckInterval);
    }

    // Update last prices
    prices.forEach(p => {
      MarketLoopStore.updateLastPrice(p.symbol, p.price);
    });

    this.priceCheckInterval = setInterval(() => {
      const alerts = TradingSignals.checkPriceAlerts(MarketLoopStore['lastPrices']);
      
      if (alerts.length > 0 && onAlert) {
        alerts.forEach(alert => onAlert(alert));
      }
    }, intervalMs);
  }

  /**
   * Detiene el monitoreo de precios
   */
  static stopPriceMonitoring(): void {
    if (this.priceCheckInterval) {
      clearInterval(this.priceCheckInterval);
      this.priceCheckInterval = null;
    }
  }

  /**
   * Inicia el loop de tracking de TVL
   */
  static startTVLTracking(
    protocols: string[],
    onUpdate?: (data: TVLData[]) => void,
    intervalMs: number = 300000
  ): void {
    if (this.tvlInterval) {
      clearInterval(this.tvlInterval);
    }

    const fetchTVL = async () => {
      try {
        const response = await fetch(
          `https://api.llama.fi/tvl/${encodeURIComponent(protocols[0] ?? '')}`,
          { headers: { Accept: 'application/json' } },
        );

        if (!response.ok) {
          throw new Error(`DeFiLlama returned HTTP ${response.status}`);
        }

        const data = await response.json() as {
          tvl?: number;
          chainTvls?: Record<string, { tvl?: number }>;
        };

        const tvl = typeof data.tvl === 'number'
          ? data.tvl
          : Object.values(data.chainTvls ?? {}).reduce(
              (sum, chain) => sum + (typeof chain.tvl === 'number' ? chain.tvl : 0),
              0,
            );

        if (!Number.isFinite(tvl) || tvl <= 0) {
          throw new Error('DeFiLlama returned no usable TVL');
        }

        const tvlData: TVLData[] = protocols.map(protocol => ({
          protocol,
          tvl,
          change24h: 0,
          category: 'DeFi',
        }));

        tvlData.forEach(d => MarketLoopStore.setTVL(d.protocol, d));
        onUpdate?.(tvlData);
      } catch (error) {
        console.error('[MarketLoops] Live TVL error:', error);
        // Do not replace unavailable live data with random/demo values.
      }
    };

    void fetchTVL();
    this.tvlInterval = setInterval(() => {
      void fetchTVL();
    }, intervalMs);
  }

  /**
   * Detiene el tracking de TVL
   */
  static stopTVLTracking(): void {
    if (this.tvlInterval) {
      clearInterval(this.tvlInterval);
      this.tvlInterval = null;
    }
  }

  /**
   * Añade una alerta de whale
   */
  static addWhaleAlert(alert: Omit<WhaleAlert, 'timestamp'>): void {
    MarketLoopStore.addWhaleAlert({
      ...alert,
      timestamp: new Date(),
    });
  }

  /**
   * Obtiene alertas de whales recientes
   */
  static getWhaleAlerts(limit?: number): WhaleAlert[] {
    return MarketLoopStore.getWhaleAlerts(limit);
  }

  /**
   * Detecta movimientos grandes (> $1M)
   */
  static detectLargeMovements(prices: Map<string, number>): WhaleAlert[] {
    // Whale alerts require real on-chain transaction data. Do not synthesize
    // wallet addresses, trade direction, amounts, or timestamps as market facts.
    console.warn('[MarketLoops] Whale detection requires an on-chain data adapter.');
    return [];
  }

  /**
   * Genera reporte de monitoreo
   */
  static generateMonitoringReport(): string {
    const alerts = MarketLoopStore.getPriceAlerts();
    const whaleAlerts = MarketLoopStore.getWhaleAlerts(10);
    const tvlData = MarketLoopStore.getTVL() as TVLData[];

    let report = `📊 **REPORTE DE MONITOREO DE MERCADO**

**ALERTAS DE PRECIO CONFIGURADAS:** ${alerts.length}\n`;

    if (alerts.length > 0) {
      alerts.slice(0, 5).forEach(a => {
        report += `• ${a.symbol} ${a.condition} $${a.price}\n`;
      });
    }

    report += `\n**WHALE ALERTS (últimas 24h):** ${whaleAlerts.length}\n`;
    
    if (whaleAlerts.length > 0) {
      whaleAlerts.slice(0, 3).forEach(w => {
        const emoji = w.type === 'buy' ? '🟢' : w.type === 'sell' ? '🔴' : '⚪';
        report += `${emoji} ${w.symbol}: $${(w.usdValue / 1e6).toFixed(2)}M ${w.type}\n`;
      });
    }

    report += `\n**TVL PROTOCOLS MONITOREADOS:** ${tvlData.length}\n`;

    if (tvlData.length > 0) {
      const sorted = [...tvlData].sort((a, b) => b.tvl - a.tvl).slice(0, 5);
      sorted.forEach(t => {
        report += `• ${t.protocol}: $${(t.tvl / 1e9).toFixed(2)}B (${t.change24h >= 0 ? '+' : ''}${t.change24h.toFixed(1)}%)\n`;
      });
    }

    return report;
  }

  /**
   * Detiene todos los loops
   */
  static stopAll(): void {
    this.stopPriceMonitoring();
    this.stopTVLTracking();
  }
}
