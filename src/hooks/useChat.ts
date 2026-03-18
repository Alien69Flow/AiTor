import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  fetchWebContext,
  analyzeRepo,
  fetchCryptoPrice,
  fetchRepoFilesForEdit,
  applyGitHubChanges,
  parseGitHubChanges,
  stripGitHubChangesBlock,
  detectTools,
  parseRepoUrl,
} from "@/services/agentTools";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageData?: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: number;
}

const CHAT_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/chat`;
const STORAGE_KEY = "aitor_chat_memory";
const CONVERSATIONS_KEY = "aitor_conversations";

// Legacy prefixes kept as fallback
const SEARCH_PREFIX = "Busca en la web: ";
const GITHUB_PREFIX = "Analiza el repositorio de GitHub: ";
const GITHUB_EDIT_PREFIX = "Edita el repositorio de GitHub: ";

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveToStorage(key: string, value: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>(() => loadFromStorage(CONVERSATIONS_KEY, []));
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isAnalyzingRepo, setIsAnalyzingRepo] = useState(false);
  const [isEditingRepo, setIsEditingRepo] = useState(false);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);

  useEffect(() => { saveToStorage(CONVERSATIONS_KEY, conversations); }, [conversations]);

  useEffect(() => {
    if (currentConversationId && messages.length > 0) {
      saveToStorage(`${STORAGE_KEY}_${currentConversationId}`, messages);
      setConversations(prev => prev.map(c =>
        c.id === currentConversationId ? { ...c, updatedAt: Date.now() } : c
      ));
    }
  }, [messages, currentConversationId]);

  const startNewConversation = useCallback(() => {
    const id = crypto.randomUUID();
    setCurrentConversationId(id);
    setMessages([]);
    return id;
  }, []);

  const loadConversation = useCallback((id: string) => {
    const saved = loadFromStorage<Message[]>(`${STORAGE_KEY}_${id}`, []);
    setCurrentConversationId(id);
    setMessages(saved.map(m => ({ ...m, timestamp: new Date(m.timestamp) })));
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    try { sessionStorage.removeItem(`${STORAGE_KEY}_${id}`); } catch {}
    if (currentConversationId === id) {
      setCurrentConversationId(null);
      setMessages([]);
    }
  }, [currentConversationId]);

  const sendMessage = useCallback(async (content: string, model: string, imageData?: string) => {
    let convId = currentConversationId;
    if (!convId) {
      convId = crypto.randomUUID();
      setCurrentConversationId(convId);
      const title = content.slice(0, 50) || "Nueva conversación";
      setConversations(prev => [{ id: convId!, title, updatedAt: Date.now() }, ...prev]);
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      imageData,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    let assistantContent = "";
    const upsertAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantContent } : m
          );
        }
        return [...prev, {
          id: crypto.randomUUID(),
          role: "assistant",
          content: assistantContent,
          timestamp: new Date(),
        }];
      });
    };

    try {
      let finalContent = content;
      let isGitHubEdit = false;
      let editOwner = "";
      let editRepo = "";

      // 1. Check legacy prefixes first
      const isLegacySearch = content.toLowerCase().startsWith(SEARCH_PREFIX.toLowerCase());
      const isLegacyGitHub = content.toLowerCase().startsWith(GITHUB_PREFIX.toLowerCase());
      const isLegacyEdit = content.toLowerCase().startsWith(GITHUB_EDIT_PREFIX.toLowerCase());

      if (isLegacySearch) {
        const query = content.slice(SEARCH_PREFIX.length).trim();
        setIsSearching(true);
        const results = await fetchWebContext(query);
        setIsSearching(false);
        if (results) {
          finalContent = `El usuario quiere buscar en la web: "${query}"\n\nResultados de búsqueda web en tiempo real:\n\n${results}\n\nBasándote en estos resultados reales, proporciona una respuesta completa con fuentes citadas.`;
        }
      } else if (isLegacyEdit) {
        const editInput = content.slice(GITHUB_EDIT_PREFIX.length).trim();
        const sepMatch = editInput.match(/^(.+?)(?:\s*[—\n]\s*|\s{2,})(.+)$/s);
        let repoStr = sepMatch ? sepMatch[1].trim() : editInput.trim();
        let instruction = sepMatch ? sepMatch[2].trim() : "Analiza el código y sugiere mejoras";
        const parsed = parseRepoUrl(repoStr);
        if (!parsed) { toast.error("Formato inválido. Usa: 'owner/repo — instrucción'"); setIsLoading(false); return; }
        isGitHubEdit = true; editOwner = parsed.owner; editRepo = parsed.repo;
        setIsAnalyzingRepo(true);
        const { tree, keyFiles } = await fetchRepoFilesForEdit(parsed.owner, parsed.repo);
        setIsAnalyzingRepo(false);
        if (!tree) { toast.error("No se pudo acceder al repositorio."); setIsLoading(false); return; }
        let ctx = `# Repositorio: ${parsed.owner}/${parsed.repo}\n\n## Instrucción:\n${instruction}\n\n## Estructura:\n\`\`\`\n`;
        ctx += tree.tree.filter((f: any) => f.type === "blob").slice(0, 80).map((f: any) => f.path).join("\n");
        ctx += `\n\`\`\`\n\n## Archivos clave:\n\n`;
        keyFiles.forEach((c: string, p: string) => { ctx += `### ${p}\n\`\`\`\n${c}\n\`\`\`\n\n`; });
        finalContent = `${ctx}\nIMPORTANTE: Genera los cambios en formato XML:\n\n<github_changes>\n<file path="ruta/archivo.ext">\nCONTENIDO\n</file>\n</github_changes>\n\nExplica qué cambiaste y por qué.`;
      } else if (isLegacyGitHub) {
        const repoInput = content.slice(GITHUB_PREFIX.length).trim();
        setIsAnalyzingRepo(true);
        const ctx = await analyzeRepo(repoInput);
        setIsAnalyzingRepo(false);
        if (ctx) finalContent = `El usuario quiere analizar: "${repoInput}"\n\n${ctx}\n\nProporciona un análisis detallado.`;
      } else {
        // 2. Auto-detect tools from content
        const tools = detectTools(content);

        if (tools.githubEdit) {
          isGitHubEdit = true; editOwner = tools.githubEdit.owner; editRepo = tools.githubEdit.repo;
          setIsAnalyzingRepo(true);
          const { tree, keyFiles } = await fetchRepoFilesForEdit(editOwner, editRepo);
          setIsAnalyzingRepo(false);
          if (!tree) { toast.error("No se pudo acceder al repositorio."); setIsLoading(false); return; }
          let ctx = `# Repositorio: ${editOwner}/${editRepo}\n\n## Instrucción:\n${tools.githubEdit.instruction}\n\n## Estructura:\n\`\`\`\n`;
          ctx += tree.tree.filter((f: any) => f.type === "blob").slice(0, 80).map((f: any) => f.path).join("\n");
          ctx += `\n\`\`\`\n\n## Archivos clave:\n\n`;
          keyFiles.forEach((c: string, p: string) => { ctx += `### ${p}\n\`\`\`\n${c}\n\`\`\`\n\n`; });
          finalContent = `${ctx}\nIMPORTANTE: Genera los cambios en formato XML:\n\n<github_changes>\n<file path="ruta/archivo.ext">\nCONTENIDO\n</file>\n</github_changes>\n\nExplica qué cambiaste y por qué.`;
        } else if (tools.githubAnalysis) {
          setIsAnalyzingRepo(true);
          const ctx = await analyzeRepo(tools.githubAnalysis);
          setIsAnalyzingRepo(false);
          if (ctx) finalContent = `El usuario quiere analizar: "${tools.githubAnalysis}"\n\n${ctx}\n\nProporciona un análisis detallado.`;
        }

        // Enrich with crypto prices if detected
        if (tools.cryptoPrice) {
          setIsFetchingPrice(true);
          const priceCtx = await fetchCryptoPrice(tools.cryptoPrice);
          setIsFetchingPrice(false);
          if (priceCtx) finalContent += `\n\nDatos de mercado en tiempo real:\n${priceCtx}\n\nUsa estos datos reales en tu respuesta.`;
        }

        // Enrich with web search if detected
        if (tools.webSearch && !tools.githubAnalysis && !tools.githubEdit) {
          setIsSearching(true);
          const results = await fetchWebContext(tools.webSearch);
          setIsSearching(false);
          if (results) finalContent += `\n\nResultados de búsqueda web:\n${results}\n\nUsa estos datos en tu respuesta.`;
        }
      }

      const messagesToSend = [...messages, { ...userMessage, content: finalContent }].map(m => ({
        role: m.role,
        content: m.content,
        ...(m.imageData && { imageData: m.imageData }),
      }));

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: messagesToSend, model }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 429) toast.error("Límite de solicitudes excedido.");
        else if (response.status === 402) toast.error("Se requieren créditos adicionales.");
        else toast.error(errorData.error || "Error al procesar la solicitud");
        setIsLoading(false);
        return;
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) upsertAssistant(delta);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Apply GitHub changes if detected
      if (isGitHubEdit && assistantContent.includes("<github_changes>")) {
        setIsEditingRepo(true);
        const files = parseGitHubChanges(assistantContent);
        if (files.length > 0) {
          toast.info(`Aplicando ${files.length} cambio(s) al repositorio...`);
          const result = await applyGitHubChanges(editOwner, editRepo, files);
          const cleanContent = stripGitHubChangesBlock(assistantContent);
          let resultMessage = cleanContent + "\n\n---\n\n";
          if (result.applied.length > 0) {
            resultMessage += `✅ **Cambios aplicados:**\n${result.applied.map(f => `- \`${f}\``).join("\n")}\n\n`;
            toast.success(`${result.applied.length} archivo(s) actualizado(s)`);
          }
          if (result.failed.length > 0) {
            resultMessage += `❌ **Errores:**\n${result.failed.map(f => `- \`${f}\``).join("\n")}`;
            toast.error(`${result.failed.length} archivo(s) fallaron`);
          }
          assistantContent = resultMessage;
          setMessages(prev => prev.map((m, i) =>
            i === prev.length - 1 && m.role === "assistant" ? { ...m, content: resultMessage } : m
          ));
        }
        setIsEditingRepo(false);
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Error de conexión.");
    } finally {
      setIsLoading(false);
      setIsSearching(false);
      setIsAnalyzingRepo(false);
      setIsEditingRepo(false);
      setIsFetchingPrice(false);
    }
  }, [messages, currentConversationId]);

  const clearChat = useCallback(() => {
    setCurrentConversationId(null);
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    isSearching,
    isAnalyzingRepo,
    isEditingRepo,
    isFetchingPrice,
    sendMessage,
    clearChat,
    conversations,
    currentConversationId,
    startNewConversation,
    loadConversation,
    deleteConversation,
  };
}
