export interface StoredChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  imageData?: string;
}

export function normalizeChatHistory(raw: string | null): StoredChatMessage[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry: unknown) => {
      if (!entry || typeof entry !== "object") return [];
      const m = entry as Record<string, unknown>;
      if (typeof m.id !== "string" || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") return [];
      const date = typeof m.timestamp === "string" || typeof m.timestamp === "number" ? new Date(m.timestamp) : new Date(0);
      return [{ id: m.id, role: m.role, content: m.content, timestamp: Number.isNaN(date.getTime()) ? new Date(0) : date, ...(typeof m.imageData === "string" ? { imageData: m.imageData } : {}) }];
    });
  } catch { return []; }
}

export function readChatHistory(storage: Pick<Storage, "getItem">, key: string): StoredChatMessage[] {
  try { return normalizeChatHistory(storage.getItem(key)); } catch { return []; }
}

export function chatRequestError(status: number): string {
  if (status === 400) return "No se pudo procesar el mensaje. Intenta enviarlo de nuevo.";
  if (status === 401 || status === 403) return "No se pudo validar el acceso. Vuelve a intentarlo.";
  if (status === 429) return "Límite de peticiones alcanzado. Intenta de nuevo en unos segundos.";
  if (status === 402) return "Créditos agotados. Revisa tu plan antes de continuar.";
  return "No se pudo conectar con el oráculo. Puedes volver a intentarlo.";
}