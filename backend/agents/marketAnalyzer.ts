/**
 * 📊 Market Analyzer Agent
 * Análisis técnico y fundamental de mercados crypto
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";

const llm = new ChatGoogleGenerativeAI({
  modelName: "gemini-2.5-pro",
  temperature: 0.3,
});

export interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  change7d?: number;
  volume24h?: number;
  marketCap?: number;
  high24h?: number;
  low24h?: number;
}

export interface TechnicalIndicators {
  rsi?: number;
  macd?: { value: number; signal: number; histogram: number };
  support: number;
  resistance: number;
  trend: 'bullish' | 'bearish' | 'neutral';
}

export interface MarketAnalysis {
  symbol: string;
  timestamp: Date;
  price: PriceData;
  technical: TechnicalIndicators;
  summary: string;
  signals: string[];
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: 'buy' | 'sell' | 'hold';
}

const analysisPrompt = PromptTemplate.fromTemplate(`
Eres el ANALISTA DE MERCADO de AlienFlowSpace DAO.
Analiza los datos de precios y genera un informe técnico.

DATOS DE PRECIO:
{priceData}

ANÁLISIS ANTERIOR (si existe):
{previousAnalysis}

Instrucciones:
1. Calcula indicadores técnicos básicos (RSI, soporte/resistencia)
2. Identifica tendencia actual
3. Genera señales de trading
4. Evalúa nivel de riesgo
5. Da recomendación (buy/sell/hold)

Responde en formato JSON:
{
  "symbol": "BTC",
  "timestamp": "ISO date",
  "price": { "symbol": "BTC", "price": 64000, "change24h": 2.5, ... },
  "technical": {
    "rsi": 65,
    "support": 62000,
    "resistance": 65000,
    "trend": "bullish",
    "macd": { "value": 150, "signal": 120, "histogram": 30 }
  },
  "summary": "Breve resumen del análisis",
  "signals": ["señal 1", "señal 2"],
  "riskLevel": "medium",
  "recommendation": "hold"
}
`);

export class MarketAnalyzer {
  /**
   * Analiza un token específico
   */
  static async analyze(priceData: PriceData, previousAnalysis?: string): Promise<MarketAnalysis> {
    try {
      const chain = analysisPrompt.pipe(llm);
      const response = await chain.invoke({
        priceData: JSON.stringify(priceData),
        previousAnalysis: previousAnalysis || "Sin análisis anterior",
      });

      const content = response.content.toString();
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          ...parsed,
          timestamp: new Date(),
        };
      }

      return this.fallbackAnalysis(priceData);
    } catch (error) {
      console.error("[MarketAnalyzer] Error:", error);
      return this.fallbackAnalysis(priceData);
    }
  }

  /**
   * Analiza múltiples tokens
   */
  static async analyzePortfolio(prices: PriceData[]): Promise<MarketAnalysis[]> {
    const analyses = await Promise.all(
      prices.map(price => this.analyze(price))
    );
    return analyses;
  }

  /**
   * Genera resumen del mercado general
   */
  static async marketSummary(prices: PriceData[]): Promise<string> {
    const btc = prices.find(p => p.symbol.toLowerCase().includes('btc'));
    const eth = prices.find(p => p.symbol.toLowerCase().includes('eth'));
    const totalCap = prices.reduce((sum, p) => sum + (p.marketCap || 0), 0);
    
    const gainers = prices.filter(p => p.change24h > 5).sort((a, b) => b.change24h - a.change24h).slice(0, 3);
    const losers = prices.filter(p => p.change24h < -5).sort((a, b) => a.change24h - b.change24h).slice(0, 3);

    let summary = `📊 **RESUMEN DE MERCADO**

**Bitcoin:** $${btc?.price?.toLocaleString() || 'N/A'} (${btc?.change24h >= 0 ? '+' : ''}${btc?.change24h?.toFixed(2) || 'N/A'}%)
**Ethereum:** $${eth?.price?.toLocaleString() || 'N/A'} (${eth?.change24h >= 0 ? '+' : ''}${eth?.change24h?.toFixed(2) || 'N/A'}%)

**Market Cap Total:** $${(totalCap / 1e9).toFixed(2)}B

`;

    if (gainers.length > 0) {
      summary += `\n🟢 **Top Gainers:**\n`;
      gainers.forEach(g => {
        summary += `• ${g.symbol}: +${g.change24h.toFixed(2)}%\n`;
      });
    }

    if (losers.length > 0) {
      summary += `\n🔴 **Top Losers:**\n`;
      losers.forEach(l => {
        summary += `• ${l.symbol}: ${l.change24h.toFixed(2)}%\n`;
      });
    }

    return summary;
  }

  /**
   * Análisis de correlación con eventos
   */
  static async correlateWithEvents(prices: PriceData[], events: any[]): Promise<string> {
    const volatileCoins = prices.filter(p => Math.abs(p.change24h) > 5);
    
    if (volatileCoins.length === 0 || events.length === 0) {
      return "No hay correlaciones claras entre movimientos de precio y eventos.";
    }

    let correlation = `🔗 **CORRELACIONES DETECTADAS**

`;
    
    volatileCoins.forEach(coin => {
      correlation += `\n**${coin.symbol}** (${coin.change24h >= 0 ? '+' : ''}${coin.change24h.toFixed(2)}%)\n`;
      
      const relatedEvents = events
        .filter(e => 
          e.title?.toLowerCase().includes(coin.symbol.toLowerCase()) ||
          e.description?.toLowerCase().includes(coin.symbol.toLowerCase())
        )
        .slice(0, 2);

      if (relatedEvents.length > 0) {
        relatedEvents.forEach(e => {
          correlation += `• ${e.title}\n`;
        });
      } else {
        correlation += `• No hay eventos directamente relacionados\n`;
      }
    });

    return correlation;
  }

  private static fallbackAnalysis(priceData: PriceData): MarketAnalysis {
    const change = priceData.change24h || 0;
    const trend = change > 2 ? 'bullish' : change < -2 ? 'bearish' : 'neutral';
    const riskLevel = Math.abs(change) > 10 ? 'high' : Math.abs(change) > 5 ? 'medium' : 'low';
    const recommendation = change > 5 ? 'buy' : change < -5 ? 'sell' : 'hold';

    return {
      symbol: priceData.symbol,
      timestamp: new Date(),
      price: priceData,
      technical: {
        support: priceData.price * 0.95,
        resistance: priceData.price * 1.05,
        trend: trend as any,
      },
      summary: `Análisis de ${priceData.symbol}: tendencia ${trend}`,
      signals: [
        change > 0 ? 'Momentum positivo' : 'Momentum negativo',
        `Cambio 24h: ${change.toFixed(2)}%`,
      ],
      riskLevel: riskLevel as any,
      recommendation: recommendation as any,
    };
  }
}
