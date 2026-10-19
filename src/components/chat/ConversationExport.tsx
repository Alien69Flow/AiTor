import { Check, Copy, Download, FileJson, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Message } from "@/hooks/useChat";
import { copyConversation, downloadConversation } from "@/lib/chat-export";

interface ConversationExportProps {
  messages: Message[];
  className?: string;
}

/**
 * Export menu for the live thread. Files are built in the browser, so this works
 * offline and for signed-out operators too.
 */
export function ConversationExport({ messages, className }: ConversationExportProps) {
  const [copied, setCopied] = useState(false);
  const disabled = messages.length === 0;

  const handleDownload = (format: "markdown" | "json") => {
    try {
      const filename = downloadConversation(messages, format);
      toast.success("Transcripción exportada", { description: filename });
    } catch (error) {
      toast.error("No se pudo exportar", {
        description: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  };

  const handleCopy = async () => {
    try {
      await copyConversation(messages);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast.success("Transcripción copiada al portapapeles");
    } catch {
      toast.error("El navegador bloqueó el portapapeles");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label="Exportar la conversación"
          title={disabled ? "Aún no hay nada que exportar" : "Exportar la conversación"}
          className={`h-8 w-8 text-muted-foreground/40 hover:text-primary disabled:opacity-30 ${className ?? ""}`}
        >
          <Download className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 font-mono text-[11px]">
        <DropdownMenuLabel className="text-[9px] uppercase tracking-widest text-muted-foreground/60">
          Exportar {messages.length} mensajes
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => handleDownload("markdown")} className="gap-2">
          <FileText className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
          Markdown (.md)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleDownload("json")} className="gap-2">
          <FileJson className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
          JSON estructurado
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void handleCopy()} className="gap-2">
          {copied ? (
            <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          )}
          {copied ? "Copiado" : "Copiar como texto"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
