import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
const SEARCH_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/firecrawl-search`;
const GITHUB_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/github-proxy`;
const STORAGE_KEY = "aitor_chat_memory";
const CONVERSATIONS_KEY = "aitor_conversations";
const SEARCH_PREFIX = "Busca en la web: ";
const GITHUB_PREFIX = "Analiza el repositorio de GitHub: ";

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveToStorage(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function parseRepoInput(input: string): { owner: string; repo: string } | null {
  // Handle full GitHub URLs: https://github.com/owner/repo or https://github.com/owner/repo/...
  const urlMatch = input.match(/github\.com\/([^/\s]+)\/([^/\s]+)/);
  if (urlMatch) return { owner: urlMatch[1], repo: urlMatch[2].replace(/\.git$/, "") };

  // Handle shorthand: owner/repo
  const shortMatch = input.trim().match(/^([^/\s]+)\/([^/\s]+)$/);
  if (shortMatch) return { owner: shortMatch[1], repo: shortMatch[2].replace(/\.git$/, "") };

  return null;
}

async function githubFetch(action: string, params: Record<string, string>) {
  const response = await fetch(GITHUB_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ action, ...params }),
  });
  if (!response.ok) return null;
  return response.json();
}

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>(() => loadFromStorage(CONVERSATIONS_KEY, []));
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isAnalyzingRepo, setIsAnalyzingRepo] = useState(false);

  // Persist conversations list
  useEffect(() => { saveToStorage(CONVERSATIONS_KEY, conversations); }, [conversations]);

  // Persist messages for current conversation
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
    try { localStorage.removeItem(`${STORAGE_KEY}_${id}`); } catch {}
    if (currentConversationId === id) {
      setCurrentConversationId(null);
      setMessages([]);
    }
  }, [currentConversationId]);

  const performWebSearch = async (query: string): Promise<string | null> => {
    try {
      const response = await fetch(SEARCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ query, options: { limit: 5, lang: "es" } }),
      });

      if (!response.ok) return null;
      const data = await response.json();
      const results = data?.data || [];

      if (results.length === 0) return null;

      return results.map((r: any, i: number) =>
        `[${i + 1}] ${r.title || "Sin título"}\nURL: ${r.url || ""}\n${r.description || ""}\n${r.markdown ? r.markdown.slice(0, 500) : ""}`
      ).join("\n\n---\n\n");
    } catch (e) {
      console.error("Web search error:", e);
      return null;
    }
  };

  const performGitHubAnalysis = async (repoInput: string): Promise<string | null> => {
    const parsed = parseRepoInput(repoInput);
    if (!parsed) {
      toast.error("Formato de repositorio inválido. Usa 'owner/repo' o una URL de GitHub.");
      return null;
    }

    const { owner, repo } = parsed;

    try {
      // Parallel fetch: repo info, file tree, commits
      const [repoInfo, tree, commits] = await Promise.all([
        githubFetch("repo_info", { owner, repo }),
        githubFetch("tree", { owner, repo, branch: "main" }),
        githubFetch("commits", { owner, repo }),
      ]);

      if (!repoInfo) {
        // Try with master branch if main fails
        const treeAlt = await githubFetch("tree", { owner, repo, branch: "master" });
        if (!treeAlt) {
          toast.error("No se pudo acceder al repositorio. Verifica que existe y es público o que el PAT tiene acceso.");
          return null;
        }
      }

      // Fetch README
      const readme = await githubFetch("contents", { owner, repo, path: "README.md" });

      // Format repo info
      let context = `# Análisis del Repositorio: ${owner}/${repo}\n\n`;

      if (repoInfo) {
        context += `## Información General\n`;
        context += `- **Nombre**: ${repoInfo.name}\n`;
        context += `- **Descripción**: ${repoInfo.description || "Sin descripción"}\n`;
        context += `- **Lenguaje principal**: ${repoInfo.language || "No especificado"}\n`;
        context += `- **Estrellas**: ${repoInfo.stargazers_count} ⭐\n`;
        context += `- **Forks**: ${repoInfo.forks_count}\n`;
        context += `- **Issues abiertos**: ${repoInfo.open_issues_count}\n`;
        context += `- **Visibilidad**: ${repoInfo.private ? "Privado" : "Público"}\n`;
        context += `- **URL**: ${repoInfo.html_url}\n`;
        context += `- **Creado**: ${repoInfo.created_at ? new Date(repoInfo.created_at).toLocaleDateString("es-ES") : "N/A"}\n`;
        context += `- **Última actualización**: ${repoInfo.updated_at ? new Date(repoInfo.updated_at).toLocaleDateString("es-ES") : "N/A"}\n\n`;

        if (repoInfo.topics?.length) {
          context += `- **Tópicos**: ${repoInfo.topics.join(", ")}\n\n`;
        }
      }

      // File tree (limit to 100 files)
      if (tree?.tree) {
        const files = tree.tree
          .filter((f: any) => f.type === "blob")
          .slice(0, 100)
          .map((f: any) => f.path);

        context += `## Estructura de Archivos (primeros ${files.length})\n\`\`\`\n`;
        context += files.join("\n");
        context += `\n\`\`\`\n\n`;
      }

      // Commits
      if (commits && Array.isArray(commits) && commits.length > 0) {
        context += `## Últimos Commits\n`;
        commits.slice(0, 10).forEach((c: any) => {
          const msg = c.commit?.message?.split("\n")[0] || "Sin mensaje";
          const author = c.commit?.author?.name || "Desconocido";
          const date = c.commit?.author?.date ? new Date(c.commit.author.date).toLocaleDateString("es-ES") : "N/A";
          context += `- **${date}** [${author}]: ${msg}\n`;
        });
        context += "\n";
      }

      // README
      if (readme?.content) {
        try {
          const decoded = atob(readme.content.replace(/\n/g, ""));
          context += `## README\n${decoded.slice(0, 3000)}${decoded.length > 3000 ? "\n\n...(truncado)" : ""}\n\n`;
        } catch {}
      }

      return context;
    } catch (e) {
      console.error("GitHub analysis error:", e);
      return null;
    }
  };

  const sendMessage = useCallback(async (content: string, model: string, imageData?: string) => {
    // Ensure conversation exists
    let convId = currentConversationId;
    if (!convId) {
      convId = crypto.randomUUID();
      setCurrentConversationId(convId);
      const title = content
        .replace(/^\[DEEP THINK\]\s*/, "")
        .replace(/^Busca en la web:\s*/i, "")
        .replace(/^Analiza el repositorio de GitHub:\s*/i, "")
        .slice(0, 50) || "Nueva conversación";
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

      // Check for web search prefix
      const isSearch = content.toLowerCase().startsWith(SEARCH_PREFIX.toLowerCase());
      const isGitHub = content.toLowerCase().startsWith(GITHUB_PREFIX.toLowerCase());

      if (isSearch) {
        const searchQuery = content.slice(SEARCH_PREFIX.length).trim();
        setIsSearching(true);
        const searchResults = await performWebSearch(searchQuery);
        setIsSearching(false);

        if (searchResults) {
          finalContent = `El usuario quiere buscar en la web: "${searchQuery}"\n\nResultados de búsqueda web en tiempo real:\n\n${searchResults}\n\nBasándote en estos resultados de búsqueda reales y actualizados, proporciona una respuesta completa, bien estructurada y con las fuentes citadas.`;
        }
      } else if (isGitHub) {
        const repoInput = content.slice(GITHUB_PREFIX.length).trim();
        setIsAnalyzingRepo(true);
        const repoContext = await performGitHubAnalysis(repoInput);
        setIsAnalyzingRepo(false);

        if (repoContext) {
          finalContent = `El usuario quiere analizar el repositorio de GitHub: "${repoInput}"\n\n${repoContext}\n\nBasándote en este análisis completo del repositorio, proporciona un análisis detallado del código, su arquitectura, tecnologías utilizadas, calidad del código, y cualquier observación relevante. Responde en español.`;
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
        if (response.status === 429) {
          toast.error("Límite de solicitudes excedido. Intenta de nuevo más tarde.");
        } else if (response.status === 402) {
          toast.error("Se requieren créditos adicionales.");
        } else {
          toast.error(errorData.error || "Error al procesar la solicitud");
        }
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
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Error de conexión. Verifica tu conexión a internet.");
    } finally {
      setIsLoading(false);
      setIsSearching(false);
      setIsAnalyzingRepo(false);
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
    sendMessage,
    clearChat,
    conversations,
    currentConversationId,
    startNewConversation,
    loadConversation,
    deleteConversation,
  };
}
