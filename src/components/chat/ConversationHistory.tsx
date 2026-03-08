import { MessageSquare, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Conversation } from "@/hooks/useChat";

interface ConversationHistoryProps {
  conversations: Conversation[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}sem`;
}

export function ConversationHistory({ conversations, currentId, onSelect, onDelete, onNew }: ConversationHistoryProps) {
  return (
    <div className="flex flex-col h-full">
      <Button
        variant="outline"
        size="sm"
        onClick={onNew}
        className="w-full h-9 mb-3 text-[10px] font-heading tracking-wider uppercase bg-primary/5 border-primary/20 text-primary/80 hover:bg-primary/15 hover:text-primary rounded-lg gap-2"
      >
        <Plus className="w-3.5 h-3.5" />
        Nuevo Chat
      </Button>

      <ScrollArea className="flex-1">
        {conversations.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-6 h-6 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-[10px] text-muted-foreground/40">Sin conversaciones</p>
          </div>
        ) : (
          <div className="space-y-1">
            {conversations
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((conv) => (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all text-left w-full ${
                    conv.id === currentId
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted/20 border border-transparent"
                  }`}
                  onClick={() => onSelect(conv.id)}
                >
                  <MessageSquare className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-foreground/70 truncate leading-tight">{conv.title}</p>
                    <p className="text-[9px] text-muted-foreground/30 font-mono">{timeAgo(conv.updatedAt)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground/30 hover:text-destructive transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
