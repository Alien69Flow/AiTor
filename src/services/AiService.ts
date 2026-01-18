import { GoogleGenAI } from "@google/genai";
import { AI_MODELS } from '../lib/ai-models';

const ai = new GoogleGenAI({ 
  apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" 
});

export async function* streamResponse(
  history: any[],
  modelId: string,
  attachments: { mimeType: string; data: string }[] = []
) {
  const config = AI_MODELS.find(m => m.id === modelId);

  if (!config) {
    yield "⚠️ **ERROR**\n\nOracle configuration not found.";
    return;
  }

  if (config.isComingSoon || !config.available && config.oracleType === 'external') {
    yield "⚠️ **ACCESS DENIED**\n\nThis neural node is currently locked or in preview mode.\n\nPlease switch to **Ai Tor** or **Ai Tor Pro** to continue.";
    return;
  }

  const userMessage = history[history.length - 1];
  const previousHistory = history.slice(0, history.length - 1);

  const historyFormatted = previousHistory.map(msg => {
    const parts: any[] = [];
    
    if (msg.attachments && msg.attachments.length > 0) {
      msg.attachments.forEach((att: any) => {
        parts.push({
          inlineData: { mimeType: att.mimeType, data: att.data }
        });
      });
    }

    if (msg.text || msg.content) {
      parts.push({ text: msg.text || msg.content });
    }

    return {
      role: msg.role === 'user' ? 'user' : 'model',
      parts: parts
    };
  });

  // Preparación del mensaje actual con adjuntos
  let messageContent: string | any[] = userMessage.text || userMessage.content || '';

  if (attachments.length > 0) {
    const parts: any[] = attachments.map(att => ({
      inlineData: { mimeType: att.mimeType, data: att.data }
    }));
    if (userMessage.text || userMessage.content) {
      parts.push({ text: userMessage.text || userMessage.content });
    }
    messageContent = parts;
  }

  const generationConfig: any = {
    maxOutputTokens: 4096,
  };

  if (config.useThinking) {
    generationConfig.thinkingConfig = { thinkingBudget: 8192 }; 
  }

  if (config.tools) {
    const toolsList: any[] = [];
    if (config.tools.googleSearch) toolsList.push({ googleSearch: {} });
    if (config.tools.googleMaps) toolsList.push({ googleMaps: {} });
    if (toolsList.length > 0) generationConfig.tools = toolsList;
  }

  try {
    const model = ai.getGenerativeModel({ 
      model: config.baseModel,
      systemInstruction: config.systemInstruction
    });

    const chat = model.startChat({
      history: historyFormatted,
      generationConfig
    });

    const result = await chat.sendMessageStream(messageContent);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  } catch (error) {
    console.error("Error in streamResponse:", error);
    yield "\n\n*[System Error: Check Nexus connectivity or API Key]*";
  }
}
