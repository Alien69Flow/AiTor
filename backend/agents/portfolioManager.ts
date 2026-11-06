/**
 * 💼 Portfolio Manager Agent
 * Gestión y tracking de portfolio crypto
 */

export interface PortfolioAsset {
  symbol: string;
  name: string;
  amount: number;
  avgBuyPrice: number;
  currentPrice: number;
  walletAddress?: string;
  addedAt: Date;
}

export interface PortfolioMetrics {
  totalValue: number;
  totalCost: number;
  pnl: number;
  pnlPercent: number;
  allocation: { symbol: string; percentage: number; value: number }[];
  bestPerformer: { symbol: string; change: number } | null;
  worstPerformer: { symbol: string; change: number } | null;
}

export interface RebalanceRecommendation {
  from: string;
  to: string;
  amount: number;
  reason: string;
}

class PortfolioStore {
  private static assets: Map<string, PortfolioAsset> = new Map();

  static addAsset(asset: PortfolioAsset): void {
    this.assets.set(asset.symbol.toUpperCase(), asset);
  }

  static removeAsset(symbol: string): boolean {
    return this.assets.delete(symbol.toUpperCase());
  }

  static updateAsset(symbol: string, updates: Partial<PortfolioAsset>): void {
    const asset = this.assets.get(symbol.toUpperCase());
    if (asset) {
      this.assets.set(symbol.toUpperCase(), { ...asset, ...updates });
    }
  }

  static getAsset(symbol: string): PortfolioAsset | undefined {
    return this.assets.get(symbol.toUpperCase());
  }

  static getAllAssets(): PortfolioAsset[] {
    return Array.from(this.assets.values());
  }

  static calculateMetrics(prices: Map<string, number>): PortfolioMetrics {
    const assets = this.getAllAssets();
    
    let totalValue = 0;
    let totalCost = 0;

    const assetsWithValue = assets.map(asset => {
      const currentPrice = prices.get(asset.symbol.toUpperCase()) || prices.get(asset.symbol.toLowerCase()) || asset.currentPrice;
      const value = asset.amount * currentPrice;
      const cost = asset.amount * asset.avgBuyPrice;
      
      totalValue += value;
      totalCost += cost;

      return {
        ...asset,
        currentPrice,
        value,
        cost,
        pnl: value - cost,
        pnlPercent: cost > 0 ? ((value - cost) / cost) * 100 : 0,
      };
    });

    const allocation = assetsWithValue
      .map(a => ({
        symbol: a.symbol,
        percentage: totalValue > 0 ? (a.value / totalValue) * 100 : 0,
        value: a.value,
      }))
      .sort((a, b) => b.percentage - a.percentage);

    const sortedByPerformance = [...assetsWithValue].sort((a, b) => b.pnlPercent - a.pnlPercent);

    return {
      totalValue,
      totalCost,
      pnl: totalValue - totalCost,
      pnlPercent: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
      allocation,
      bestPerformer: sortedByPerformance[0] ? {
        symbol: sortedByPerformance[0].symbol,
        change: sortedByPerformance[0].pnlPercent,
      } : null,
      worstPerformer: sortedByPerformance[sortedByPerformance.length - 1] ? {
        symbol: sortedByPerformance[sortedByPerformance.length - 1].symbol,
        change: sortedByPerformance[sortedByPerformance.length - 1].pnlPercent,
      } : null,
    };
  }
}

export class PortfolioManager {
  /**
   * Añade un activo al portfolio
   */
  static addAsset(symbol: string, name: string, amount: number, avgBuyPrice: number, walletAddress?: string): PortfolioAsset {
    const asset: PortfolioAsset = {
      symbol: symbol.toUpperCase(),
      name,
      amount,
      avgBuyPrice,
      currentPrice: avgBuyPrice,
      walletAddress,
      addedAt: new Date(),
    };
    
    PortfolioStore.addAsset(asset);
    return asset;
  }

  /**
   * Actualiza la cantidad de un activo
   */
  static updateAmount(symbol: string, amount: number): boolean {
    PortfolioStore.updateAsset(symbol, { amount });
    return true;
  }

  /**
   * Actualiza precio promedio de compra
   */
  static updateAvgPrice(symbol: string, newAvgPrice: number): boolean {
    PortfolioStore.updateAsset(symbol, { avgBuyPrice: newAvgPrice });
    return true;
  }

  /**
   * Elimina un activo
   */
  static removeAsset(symbol: string): boolean {
    return PortfolioStore.removeAsset(symbol);
  }

  /**
   * Obtiene todos los activos
   */
  static getAssets(): PortfolioAsset[] {
    return PortfolioStore.getAllAssets();
  }

  /**
   * Obtiene métricas del portfolio
   */
  static getMetrics(prices: Map<string, number>): PortfolioMetrics {
    return PortfolioStore.calculateMetrics(prices);
  }

  /**
   * Genera recomendaciones de rebalanceo
   */
  static suggestRebalance(targetAllocation: Record<string, number>, prices: Map<string, number>): RebalanceRecommendation[] {
    const metrics = this.getMetrics(prices);
    const recommendations: RebalanceRecommendation[] = [];

    for (const [symbol, targetPercent] of Object.entries(targetAllocation)) {
      const current = metrics.allocation.find(a => a.symbol === symbol);
      const currentPercent = current?.percentage || 0;
      const diff = targetPercent - currentPercent;

      if (Math.abs(diff) > 5) { // Only recommend if difference > 5%
        const targetValue = (metrics.totalValue * targetPercent) / 100;
        const currentValue = (metrics.totalValue * currentPercent) / 100;
        const amountToMove = Math.abs(targetValue - currentValue);

        if (diff > 0) {
          // Need to buy more
          recommendations.push({
            from: 'USDT',
            to: symbol,
            amount: amountToMove,
            reason: `Aumentar ${symbol} de ${currentPercent.toFixed(1)}% a ${targetPercent}%`,
          });
        } else {
          // Need to sell some
          recommendations.push({
            from: symbol,
            to: 'USDT',
            amount: amountToMove,
            reason: `Reducir ${symbol} de ${currentPercent.toFixed(1)}% a ${targetPercent}%`,
          });
        }
      }
    }

    return recommendations.sort((a, b) => b.amount - a.amount);
  }

  /**
   * Formatea reporte de portfolio
   */
  static formatPortfolioReport(prices: Map<string, number>): string {
    const assets = this.getAssets();
    const metrics = this.getMetrics(prices);

    let report = `💼 **PORFOLIO ALIENFLOWSPACE**

**Valor Total:** $${metrics.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
**Costo Total:** $${metrics.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
**P&L:** $${metrics.pnl >= 0 ? '+' : ''}${metrics.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${metrics.pnlPercent >= 0 ? '+' : ''}${metrics.pnlPercent.toFixed(2)}%)

`;

    if (metrics.bestPerformer) {
      report += `\n🟢 **Mejor:** ${metrics.bestPerformer.symbol} (${metrics.bestPerformer.change >= 0 ? '+' : ''}${metrics.bestPerformer.change.toFixed(2)}%)`;
    }
    if (metrics.worstPerformer) {
      report += `\n🔴 **Peor:** ${metrics.worstPerformer.symbol} (${metrics.worstPerformer.change >= 0 ? '+' : ''}${metrics.worstPerformer.change.toFixed(2)}%)`;
    }

    report += `\n\n**ACTIVOS:**\n`;
    
    assets.forEach(asset => {
      const currentPrice = prices.get(asset.symbol.toUpperCase()) || prices.get(asset.symbol.toLowerCase()) || asset.currentPrice;
      const value = asset.amount * currentPrice;
      const pnl = value - (asset.amount * asset.avgBuyPrice);
      const pnlPercent = ((currentPrice - asset.avgBuyPrice) / asset.avgBuyPrice) * 100;

      report += `\n**${asset.symbol}** (${asset.name})\n`;
      report += `   Cantidad: ${asset.amount}\n`;
      report += `   Precio: $${currentPrice.toLocaleString()}\n`;
      report += `   Valor: $${value.toLocaleString()}\n`;
      report += `   P&L: $${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)\n`;
    });

    report += `\n**ALLOCACIÓN:**\n`;
    metrics.allocation.slice(0, 5).forEach(a => {
      report += `${a.symbol}: ${a.percentage.toFixed(1)}%\n`;
    });

    return report;
  }

  /**
   * Detecta concentración excesiva
   */
  static detectConcentration(): { symbol: string; percentage: number; risk: string }[] {
    const assets = this.getAllAssets();
    if (assets.length === 0) return [];

    // Get prices (mock for now)
    const prices = new Map<string, number>();
    assets.forEach(a => prices.set(a.symbol, a.currentPrice));

    const metrics = this.getMetrics(prices);

    return metrics.allocation
      .filter(a => a.percentage > 30)
      .map(a => ({
        symbol: a.symbol,
        percentage: a.percentage,
        risk: a.percentage > 50 ? 'HIGH' : 'MEDIUM',
      }));
  }
}
