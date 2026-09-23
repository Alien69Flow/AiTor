import { SupervisorAgent } from "./supervisor.js";
import { ThreadManager } from "../memory/threadManager.js";
import { KnowledgeBase } from "../rag/knowledge.js";
import { runCapabilityRuntime } from "../workflows/capabilityRuntime.js";
import { MonetizationManager } from "../workflows/monetizationLoop.js";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ManusAgent } from "./manus.js";

const AGENTIC_RUNTIME_ENABLED = process.env.AGENTIC_RUNTIME_ENABLED === "true" || process.env.AGENTIC_RUNTIME_ENABLED === "1";

const llmGeneral = new ChatGoogleGenerativeAI({
  modelName: "gemini-2.5-flash",
  temperature: 0.7,
});

export class SwarmOrchestrator {
  static async processMessage(chatId: string, userInput: string): Promise<string> {
    console.log(`\n[Orquestador] Nueva petición en Chat: ${chatId} -> "${userInput}"`);

    const history = ThreadManager.getHistory(chatId);
    ThreadManager.addMessage(chatId, "user", userInput);

    const route = await SupervisorAgent.routeRequest(userInput);

    const access = await MonetizationManager.checkAccess(chatId, route);
    if (!access.allowed) {
      const rejectionMsg = access.reason || "Límite de créditos alcanzado por hoy.";
      ThreadManager.addMessage(chatId, "assistant", rejectionMsg);
      return rejectionMsg;
    }

    let finalResponse = "";

    switch (route) {
      case "RAG_PHYSICS":
      case "MARKET_DAO": {
        const context = await KnowledgeBase.retrieveContext(route);
        const response = await llmGeneral.invoke([
          { role: "system", content: `Eres AI-TOR, la inteligencia central de AlienFlowSpace DAO. Responde al usuario utilizando estrictamente este contexto fundacional:\n${context}` },
          { role: "system", content: `Historial reciente:\n${history}` },
          { role: "user", content: userInput },
        ]);

        finalResponse = response.content.toString();
        break;
      }

      case "TASK_MANUS": {
        if (!AGENTIC_RUNTIME_ENABLED) {
          finalResponse = await this.handleTaskRequest(userInput, history);
          break;
        }

        const runtime = await runCapabilityRuntime(userInput, chatId, history, ["development"]);
        finalResponse = formatCapabilityRuntimeResult(runtime);
        break;
      }

      case "SOCIAL_MEDIA": {
        const input = userInput.toLowerCase();
        if (
          input.includes("ver propuestas") ||
          input.includes("ver pendientes") ||
          input.includes("aprobar") ||
          input.includes("rechazar") ||
          input.includes("estadísticas") ||
          input.includes("stats")
        ) {
          finalResponse = await this.handleSocialMediaRequest(userInput, history);
          break;
        }

        if (!AGENTIC_RUNTIME_ENABLED) {
          finalResponse = await this.handleSocialMediaRequest(userInput, history);
          break;
        }

        const runtime = await runCapabilityRuntime(userInput, chatId, history, ["social"]);
        finalResponse = formatCapabilityRuntimeResult(runtime);
        break;
      }

      case "SECURITY_SCAN": {
        if (!AGENTIC_RUNTIME_ENABLED) {
          finalResponse = await this.handleSecurityRequest(userInput);
          break;
        }

        const runtime = await runCapabilityRuntime(userInput, chatId, history, ["security"]);
        finalResponse = formatCapabilityRuntimeResult(runtime);
        break;
      }

      case "MARKET_ANALYSIS": {
        finalResponse = await this.handleMarketRequest(userInput);
        break;
      }

      case "TRADING_SIGNALS": {
        finalResponse = await this.handleTradingRequest(userInput);
        break;
      }

      case "PORTFOLIO": {
        finalResponse = await this.handlePortfolioRequest(userInput);
        break;
      }

      case "CHAT_GENERAL":
      default: {
        const response = await llmGeneral.invoke([
          { role: "system", content: "Eres AI-TOR, un aliado inteligente, directo y avanzado. Estás ayudando al usuario a gestionar su ecosistema." },
          { role: "system", content: `Historial reciente:\n${history}` },
          { role: "user", content: userInput },
        ]);

        finalResponse = response.content.toString();
        break;
      }
    }

    await MonetizationManager.deductCredits(chatId, route);
    ThreadManager.addMessage(chatId, "assistant", finalResponse);

    return finalResponse;
  }

  private static async handleTaskRequest(userInput: string, history: string): Promise<string> {
    return ManusAgent.executeTask(userInput, history);
  }

  private static async handleSocialMediaRequest(userInput: string, history: string): Promise<string> {
    const { SocialMediaManager, FrequencyType } = await import("./socialMediaManager.js");
    const { ProposalQueue } = await import("../workflows/socialProposalQueue.js");

    const input = userInput.toLowerCase();

    let frequency: FrequencyType = "daily";
    if (input.includes("semanal")) frequency = "weekly";
    else if (input.includes("mensual")) frequency = "monthly";
    else if (input.includes("trimestral")) frequency = "quarterly";
    else if (input.includes("anual")) frequency = "yearly";

    let platform: any = undefined;
    if (input.includes("twitter")) platform = "twitter";
    else if (input.includes("linkedin")) platform = "linkedin";
    else if (input.includes("instagram")) platform = "instagram";
    else if (input.includes("discord")) platform = "discord";
    else if (input.includes("telegram")) platform = "telegram";

    if (input.includes("ver propuestas") || input.includes("ver pendientes")) {
      const pending = await ProposalQueue.getPendingProposals();
      if (pending.length === 0) return "📭 No hay propuestas pendientes de aprobación.";

      let response = `📋 **PROPUESTAS PENDIENTES** (${pending.length}):\n\n`;
      pending.slice(0, 5).forEach((p) => {
        response += `🔹 [${p.platform.toUpperCase()}] ${p.frequency}\n`;
        response += `   "${p.content.substring(0, 80)}..."\n\n`;
      });
      response += `\n**Comandos:**\n`;
      response += `• "aprobar [id]" - Aprobar propuesta\n`;
      response += `• "rechazar [id]" - Rechazar propuesta\n`;
      response += `• "generar ${frequency}" - Generar nuevas propuestas`;

      return response;
    }

    if (input.includes("aprobar")) {
      const idMatch = userInput.match(/aprobar\s+([\w_]+)/i);
      if (idMatch) {
        const approved = await ProposalQueue.approveProposal(idMatch[1], "user");
        return approved ? `✅ Propuesta ${idMatch[1]} aprobada. Se programará para publicación.` : `❌ No se pudo aprobar la propuesta. Verifica el ID.`;
      }
      return "⚠️ Indica el ID de la propuesta a aprobar. Ej: 'aprobar daily_twitter_123'";
    }

    if (input.includes("rechazar")) {
      const idMatch = userInput.match(/rechazar\s+([\w_]+)/i);
      if (idMatch) {
        const rejected = await ProposalQueue.rejectProposal(idMatch[1]);
        return rejected ? `❌ Propuesta ${idMatch[1]} rechazada.` : `❌ No se pudo rechazar. Verifica el ID.`;
      }
      return "⚠️ Indica el ID de la propuesta a rechazar.";
    }

    if (input.includes("estadísticas") || input.includes("stats")) {
      return ProposalQueue.generateReport();
    }

    const { proposals, summary } = await SocialMediaManager.generateContent(frequency, {
      platform,
      tone: "technical",
    });

    let response = `🐦 **CONTENIDO ${frequency.toUpperCase()} GENERADO**\n\n`;
    response += `✅ ${summary}\n\n`;
    response += `**PLATAFORMAS:** ${platform || "todas"}\n\n`;
    response += `📋 **PRÓXIMOS PASOS:**\n`;
    response += `1. Revisa las propuestas generadas\n`;
    response += `2. Usa "ver propuestas" para ver los detalles\n`;
    response += `3. Aprueba con "aprobar [id]" para programar publicación\n`;
    response += `4. El contenido se publicará automáticamente en el horario óptimo\n\n`;
    response += `⚡ **NOTA:** El contenido NO se publica automáticamente. Requiere tu aprobación explícita.`;

    return response;
  }

  private static async handleSecurityRequest(userInput: string): Promise<string> {
    const { SecurityAgent } = await import("./securityAgent.js");
    const input = userInput.toLowerCase();

    if (input.includes("escaneo completo") || input.includes("full scan")) {
      const report = await SecurityAgent.fullScan();
      return SecurityAgent.formatReport(report);
    }

    const report = await SecurityAgent.quickScan();
    return SecurityAgent.formatReport(report);
  }

  private static async handleMarketRequest(userInput: string): Promise<string> {
    const { MarketAnalyzer } = await import("./marketAnalyzer.js");
    const { MarketKnowledge } = await import("../rag/marketKnowledge.js");
    const input = userInput.toLowerCase();

    const symbols: string[] = [];
    if (input.includes("btc") || input.includes("bitcoin")) symbols.push("BTC");
    if (input.includes("eth") || input.includes("ethereum")) symbols.push("ETH");
    if (input.includes("sol") || input.includes("solana")) symbols.push("SOL");
    if (input.includes("bnb")) symbols.push("BNB");

    if (symbols.length > 0) {
      const prices = symbols.map((s) => ({
        symbol: s,
        price: s === "BTC" ? 64000 : s === "ETH" ? 3400 : s === "SOL" ? 140 : 580,
        change24h: (Math.random() - 0.5) * 10,
        marketCap: Math.random() * 100000000000,
      }));

      const analyses = await MarketAnalyzer.analyzePortfolio(prices);
      let response = `📊 **ANÁLISIS DE MERCADO**\n\n`;

      for (const analysis of analyses) {
        const emoji = analysis.technical.trend === "bullish" ? "🟢" : analysis.technical.trend === "bearish" ? "🔴" : "⚪";
        response += `${emoji} **${analysis.symbol}** - ${analysis.technical.trend}\n`;
        response += `   Precio: $${analysis.price.price.toLocaleString()}\n`;
        response += `   Cambio 24h: ${analysis.price.change24h >= 0 ? "+" : ""}${analysis.price.change24h.toFixed(2)}%\n`;
        response += `   Soporte: $${analysis.technical.support.toLocaleString()}\n`;
        response += `   Resistencia: $${analysis.technical.resistance.toLocaleString()}\n`;
        response += `   Recomendación: ${analysis.recommendation.toUpperCase()}\n\n`;
      }

      return response;
    }

    return await MarketKnowledge.retrieveContext("marketSentiment" as any);
  }

  private static async handleTradingRequest(userInput: string): Promise<string> {
    const { TradingSignals } = await import("./tradingSignals.js");
    const { MarketKnowledge } = await import("../rag/marketKnowledge.js");
    const input = userInput.toLowerCase();

    if (input.includes("alerta") && input.includes("precio")) {
      const symbols: string[] = [];
      if (input.includes("btc")) symbols.push("BTC");
      if (input.includes("eth")) symbols.push("ETH");

      const condition = input.includes("sobre") ? "above" : input.includes("bajo") ? "below" : "crosses";
      const priceMatch = userInput.match(/\$?([\d,]+)/);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(",", "")) : 0;

      if (symbols.length > 0 && price > 0) {
        const alert = TradingSignals.createPriceAlert(
          symbols[0],
          condition as any,
          price,
          `Alerta ${condition} $${price}`,
        );
        return `✅ **ALERTA CONFIGURADA**\n\nSímbolo: ${alert.symbol}\nCondición: ${alert.condition} $${alert.price}\nID: ${alert.id}`;
      }
    }

    if (input.includes("ver señales") || input.includes("señales activas")) {
      return TradingSignals.formatSignalsReport();
    }

    if (input.includes("checklist") || input.includes("antes de operar")) {
      return MarketKnowledge.getAnalysisChecklist();
    }

    return `📈 **SEÑALES DE TRADING**\n\nOpciones disponibles:\n• "alerta de precio BTC sobre $65000"\n• "ver señales activas"\n• "checklist antes de operar"\n\n${MarketKnowledge.getAnalysisChecklist()}`;
  }

  private static async handlePortfolioRequest(userInput: string): Promise<string> {
    const { PortfolioManager } = await import("./portfolioManager.js");
    const input = userInput.toLowerCase();

    const prices = new Map<string, number>();
    prices.set("BTC", 64000);
    prices.set("ETH", 3400);
    prices.set("SOL", 140);
    prices.set("LINK", 18);

    if (input.includes("mi portfolio") || input.includes("mis activos")) {
      const assets = PortfolioManager.getAssets();

      if (assets.length === 0) {
        return `💼 **TU PORFOLIO**\n\nNo tienes activos configurados.\n\nComandos disponibles:\n• "añadir BTC 0.5 a $60000" - Añadir activo\n• "mi portfolio" - Ver portfolio\n• "añadir a portfolio" - Help\n• "rebalancear" - Recomendaciones`;
      }

      return PortfolioManager.formatPortfolioReport(prices);
    }

    if (input.includes("añadir") || input.includes("agregar")) {
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

    if (input.includes("rebalancear")) {
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
        recommendations.forEach((r) => {
          response += `${r.from} → ${r.to}: $${r.amount.toFixed(2)}\n`;
          response += `   ${r.reason}\n\n`;
        });
      }

      return response;
    }

    return `💼 **GESTIÓN DE PORFOLIO**\n\nComandos disponibles:\n• "mi portfolio" - Ver activos\n• "añadir BTC 0.5" - Añadir activo\n• "rebalancear" - Recomendaciones de distribución`;
  }
}

function formatCapabilityRuntimeResult(runtime: Awaited<ReturnType<typeof runCapabilityRuntime>>): string {
  if (runtime.status === "cancelled") {
    return "⚠️ Agenteic runtime is disabled. Using the previous safe execution path.";
  }

  const status = runtime.status === "completed"
    ? "✅ Capability workflow completed."
    : runtime.status === "waiting_approval"
      ? "⏳ Capability workflow is waiting for approval."
      : "⚠️ Capability workflow failed.";

  const details = runtime.outputs.map((output) => {
    const label = output.capability.toUpperCase();
    if (!output.ok) return `## ${label}\n❌ ${output.error || "Capability failed."}`;
    return `## ${label}\n${typeof output.output === "string" ? output.output : JSON.stringify(output.output, null, 2)}`;
  }).join("\n\n---\n\n");

  return `${status}\nRun ID: ${runtime.runId}\n\n${details || "No capability output was produced."}`;
}
