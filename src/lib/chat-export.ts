import type { Message } from "@/hooks/useChat";

/**
 * Conversation portability: an intelligence terminal produces material people
 * need to keep (audit trails, research notes, prompts worth reusing). Export is
 * local and synchronous — no upload, no extra dependency.
 */
export type ExportFormat = "markdown" | "json";

const speaker = (message: Message) => (message.role === "user" ? "Tú" : "AI Tor");

function fileStamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

export function conversationToMarkdown(messages: Message[]): string {
  const exportedAt = new Date().toLocaleString("es");
  const body = messages
    .map((message) => {
      const time = new Date(message.timestamp).toLocaleString("es");
      const tokens = message.usage ? `\n\n> ${message.usage.totalTokens} tokens` : "";
      const image = message.imageData ? "\n\n_(imagen adjunta)_" : "";
      return `## ${speaker(message)} · ${time}\n\n${message.content}${image}${tokens}`;
    })
    .join("\n\n---\n\n");

  return `# Ai Tor — transcripción\n\n_Exportado el ${exportedAt} · ΔlieπFlΦw DAO_\n\n${body}\n`;
}

export function conversationToJson(messages: Message[]): string {
  return JSON.stringify(
    {
      app: "Ai Tor",
      exportedAt: new Date().toISOString(),
      messageCount: messages.length,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
        timestamp: new Date(message.timestamp).toISOString(),
        ...(message.usage ? { usage: message.usage } : {}),
        ...(message.imageData ? { hasImage: true } : {}),
      })),
    },
    null,
    2,
  );
}

export function conversationToText(messages: Message[]): string {
  return messages.map((message) => `${speaker(message)}: ${message.content}`).join("\n\n");
}

/** Triggers a browser download without leaving the page. */
export function downloadConversation(messages: Message[], format: ExportFormat): string {
  const content = format === "json" ? conversationToJson(messages) : conversationToMarkdown(messages);
  const type = format === "json" ? "application/json" : "text/markdown";
  const extension = format === "json" ? "json" : "md";
  const filename = `aitor-chat-${fileStamp()}.${extension}`;

  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a tick to start the download before releasing the blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  return filename;
}

export async function copyConversation(messages: Message[]): Promise<void> {
  await navigator.clipboard.writeText(conversationToText(messages));
}
