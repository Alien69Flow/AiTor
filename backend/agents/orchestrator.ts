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

      case "SOCIAL_MEDIA": {
        // Routing al Social Media Manager Agent (lazy import para evitar ciclos)
        const { SocialMediaManager } = await import('./socialMediaManager');
        finalResponse = await this.handleSocialMediaRequest(userInput, history);
        break;
      }

      case "SECURITY_SCAN": {
        // Routing al Security Agent
        finalResponse = await this.handleSecurityRequest(userInput);
        break;
      }

      case "MARKET_ANALYSIS": {
        // Routing al Market Analyzer
        finalResponse = await this.handleMarketRequest(userInput);
        break;
      }

      case "TRADING_SIGNALS": {
        // Routing al Trading Signals Agent
        finalResponse = await this.handleTradingRequest(userInput);
        break;
      }

      case "PORTFOLIO": {
        // Routing al Portfolio Manager
        finalResponse = await this.handlePortfolioRequest(userInput);
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

  /**
   * Maneja requests de redes sociales
   */
  private static async handleSocialMediaRequest(userInput: string, history: string): Promise<string> {
    const { SocialMediaManager, FrequencyType } = await import('./socialMediaManager');
    const { ProposalQueue } = await import('../workflows/socialProposalQueue');

    const input = userInput.toLowerCase();

    // Detectar tipo de frecuencia
    let frequency: FrequencyType = 'daily';
    if (input.includes('semanal')) frequency = 'weekly';
    else if (input.includes('mensual')) frequency = 'monthly';
    else if (input.includes('trimestral')) frequency = 'quarterly';
    else if (input.includes('anual')) frequency = 'yearly';

    // Detectar plataforma
    let platform: any = undefined;
    if (input.includes('twitter')) platform = 'twitter';
    else if (input.includes('linkedin')) platform = 'linkedin';
    else if (input.includes('instagram')) platform = 'instagram';
    else if (input.includes('discord')) platform = 'discord';
    else if (input.includes('telegram')) platform = 'telegram';

    // Acciones específicas
    if (input.includes('ver propuestas') || input.includes('ver pendientes')) {
      const pending = await ProposalQueue.getPendingProposals();
      if (pending.length === 0) return "📭 No hay propuestas pendientes de aprobación.";
      
      let response = `📋 **PROPUESTAS PENDIENTES** (${pending.length}):\n\n`;
      pending.slice(0, 5).forEach(p => {
        response += `🔹 [${p.platform.toUpperCase()}] ${p.frequency}\n`;
        response += `   "${p.content.substring(0, 80)}..."\n\n`;
      });
      response += `\n**Comandos:**\n`;
      response += `• "aprobar [id]" - Aprobar propuesta\n`;
      response += `• "rechazar [id]" - Rechazar propuesta\n`;
      response += `• "generar ${frequency}" - Generar nuevas propuestas`;
      
      return response;
    }

    if (input.includes('aprobar')) {
      const idMatch = userInput.match(/aprobar\s+([\w_]+)/i);
      if (idMatch) {
        const approved = await ProposalQueue.approveProposal(idMatch[1], 'user');
        return approved ? `✅ Propuesta ${idMatch[1]} aprobada. Se programará para publicación.` 
                       : `❌ No se pudo aprobar la propuesta. Verifica el ID.`;
      }
      return "⚠️ Indica el ID de la propuesta a aprobar. Ej: 'aprobar daily_twitter_123'";
    }

    if (input.includes('rechazar') || input.includes('rechazar')) {
      const idMatch = userInput.match(/rechazar\s+([\w_]+)/i);
      if (idMatch) {
        const rejected = await ProposalQueue.rejectProposal(idMatch[1]);
        return rejected ? `❌ Propuesta ${idMatch[1]} rechazada.` 
                       : `❌ No se pudo rechazar. Verifica el ID.`;
      }
      return "⚠️ Indica el ID de la propuesta a rechazar.";
    }

    if (input.includes('estadísticas') || input.includes('stats')) {
      return ProposalQueue.generateReport();
    }

    // Generar nuevas propuestas
    const { proposals, summary } = await SocialMediaManager.generateContent(frequency, {
      platform,
      tone: 'technical',
    });

    let response = `🐦 **CONTENIDO ${frequency.toUpperCase()} GENERADO**\n\n`;
    response += `✅ ${summary}\n\n`;
    response += `**PLATAFORMAS:** ${platform || 'todas'}\n\n`;
    
    response += `📋 **PRÓXIMOS PASOS:**\n`;
    response += `1. Revisa las propuestas generadas\n`;
    response += `2. Usa "ver propuestas" para ver los detalles\n`;
    response += `3. Aprueba con "aprobar [id]" para programar publicación\n`;
    response += `4. El contenido se publicará automáticamente en el horario óptimo\n\n`;
    response += `⚡ **NOTA:** El contenido NO se publica automáticamente. Requiere tu aprobación explícita.`;

    return response;
  }

  /**
   * Maneja requests de seguridad
   */
  private static async handleSecurityRequest(userInput: string): Promise<string> {
    const { SecurityAgent } = await import('./securityAgent');
    const input = userInput.toLowerCase();

    if (input.includes('escaneo completo') || input.includes('full scan')) {
      const report = await SecurityAgent.fullScan();
      return SecurityAgent.formatReport(report);
    }

    // Por defecto, escaneo rápido
    const report = await SecurityAgent.quickScan();
    return SecurityAgent.formatReport(report);
  }

  /**
   * Maneja requests de análisis de mercado
   */
  private static async handleMarketRequest(userInput: string): Promise<string> {
    const { MarketAnalyzer } = await import('./marketAnalyzer');
    const { MarketKnowledge } = await import('../rag/marketKnowledge');
    const input = userInput.toLowerCase();

    // Extraer símbolos mencionados
    const symbols: string[] = [];
    if (input.includes('btc') || input.includes('bitcoin')) symbols.push('BTC');
    if (input.includes('eth') || input.includes('ethereum')) symbols.push('ETH');
    if (input.includes('sol') || input.includes('solana')) symbols.push('SOL');
    if (input.includes('bnb')) symbols.push('BNB');

    if (symbols.length > 0) {
      // Generar mock price data para demo
      const prices = symbols.map(s => ({
        symbol: s,
        price: s === 'BTC' ? 64000 : s === 'ETH' ? 3400 : s === 'SOL' ? 140 : 580,
        change24h: (Math.random() - 0.5) * 10,
        marketCap: Math.random() * 100000000000,
      }));

      const analyses = await MarketAnalyzer.analyzePortfolio(prices);
      let response = `📊 **ANÁLISIS DE MERCADO**\n\n`;

      for (const analysis of analyses) {
        const emoji = analysis.technical.trend === 'bullish' ? '🟢' : analysis.technical.trend === 'bearish' ? '🔴' : '⚪';
        response += `${emoji} **${analysis.symbol}** - ${analysis.technical.trend}\n`;
        response += `   Precio: $${analysis.price.price.toLocaleString()}\n`;
        response += `   Cambio 24h: ${analysis.price.change24h >= 0 ? '+' : ''}${analysis.price.change24h.toFixed(2)}%\n`;
        response += `   Soporte: $${analysis.technical.support.toLocaleString()}\n`;
        response += `   Resistencia: $${analysis.technical.resistance.toLocaleString()}\n`;
        response += `   Recomendación: ${analysis.recommendation.toUpperCase()}\n\n`;
      }

      return response;
    }

    // Análisis general de mercado
    return await MarketKnowledge.retrieveContext('marketSentiment' as any);
  }

  /**
   * Maneja requests de señales de trading
   */
  private static async handleTradingRequest(userInput: string): Promise<string> {
    const { TradingSignals } = await import('./tradingSignals');
    const { MarketKnowledge } = await import('../rag/marketKnowledge');
    const input = userInput.toLowerCase();

    // Configurar alerta de precio
    if (input.includes('alerta') && input.includes('precio')) {
      const symbols: string[] = [];
      if (input.includes('btc')) symbols.push('BTC');
      if (input.includes('eth')) symbols.push('ETH');
      
      const condition = input.includes('sobre') ? 'above' : input.includes('bajo') ? 'below' : 'crosses';
      
      // Extraer número del mensaje
      const priceMatch = userInput.match(/\$?([\d,]+)/);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : 0;

      if (symbols.length > 0 && price > 0) {
        const alert = TradingSignals.createPriceAlert(
          symbols[0],
          condition as any,
          price,
          `Alerta ${condition} $${price}`
        );
        return `✅ **ALERTA CONFIGURADA**\n\nSímbolo: ${alert.symbol}\nCondición: ${alert.condition} $${alert.price}\nID: ${alert.id}`;
      }
    }

    // Mostrar señales activas
    if (input.includes('ver señales') || input.includes('señales activas')) {
      return TradingSignals.formatSignalsReport();
    }

    // Checklist de trading
    if (input.includes('checklist') || input.includes('antes de operar')) {
      return MarketKnowledge.getAnalysisChecklist();
    }

    return `📈 **SEÑALES DE TRADING**

Opciones disponibles:
• "alerta de precio BTC sobre $65000"
• "ver señales activas"
• "checklist antes de operar"

${MarketKnowledge.getAnalysisChecklist()}`;
  }

  /**
   * Maneja requests de portfolio
   */
  private static async handlePortfolioRequest(userInput: string): Promise<string> {
    const { PortfolioManager } = await import('./portfolioManager');
    const input = userInput.toLowerCase();

    // Mock prices
    const prices = new Map<string, number>();
    prices.set('BTC', 64000);
    prices.set('ETH', 3400);
    prices.set('SOL', 140);
    prices.set('LINK', 18);

    if (input.includes('mi portfolio') || input.includes('mis activos')) {
      const assets = PortfolioManager.getAssets();
      
      if (assets.length === 0) {
        return `💼 **TU PORFOLIO**

No tienes activos configurados.

Comandos disponibles:
• "añadir BTC 0.5 a $60000" - Añadir activo
• "mi portfolio" - Ver portfolio
• "añadir a portfolio" - Help
• "rebalancear" - Recomendaciones`;
      }

      return PortfolioManager.formatPortfolioReport(prices);
    }

    // Añadir activo
    if (input.includes('añadir') || input.includes('agregar')) {
      const symbolMatch = userInput.match(/(BTC|ETH|SOL|LINK|BNB|DOT|ADA)/i);
      const amountMatch = userInput.match(/([\d.]+)/);
      
      if (symbolMatch && amountMatch) {
        const symbol = symbolMatch[1].toUpperCase();
        const amount = parseFloat(amountMatch[1]);
        const price = prices.get(symbol) || 0;

        PortfolioManager.addAsset(symbol, symbol, amount, price);
        
        return `✅ **ACTIVO AÑADIDO**\n\nSímbolo: ${symbol}\nCantidad: ${amount}\nPrecio promedio: $${price.toLocaleString()}\n\nTotal en ${symbol}: $${(amount * price).toLocaleString()}`;
      }
    }

    // Rebalancear
    if (input.includes('rebalancear')) {
      const targetAllocation = {
        BTC: 40,
        ETH: 30,
        SOL: 15,
        LINK: 15,
      };

      const recommendations = PortfolioManager.suggestRebalance(targetAllocation, prices);
      
      let response = `🔄 **RECOMENDACIONES DE REBALANCEO**\n\n`;
      
      if (recommendations.length === 0) {
        response += `Tu portfolio ya está balanceado correctamente.`;
      } else {
        recommendations.forEach(r => {
          response += `${r.from} → ${r.to}: $${r.amount.toFixed(2)}\n`;
          response += `   ${r.reason}\n\n`;
        });
      }

      return response;
    }

    return `💼 **GESTIÓN DE PORFOLIO**

Comandos disponibles:
• "mi portfolio" - Ver activos
• "añadir BTC 0.5" - Añadir activo
• "rebalancear" - Recomendaciones de distribución`;
  }
}
