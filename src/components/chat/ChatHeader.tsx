import { Button } from "@/components/ui/button";
import { ModelSelector } from "./ModelSelector";
import { Trash2, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ChatHeaderProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  onClear: () => void;
  hasMessages: boolean;
}

export function ChatHeader({ selectedModel, onModelChange, onClear, hasMessages }: ChatHeaderProps) {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error("Error al cerrar sesión");
    }
  };

  return (
    <header className="flex items-center justify-between border-b border-border bg-background px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold tracking-tight">
            <span className="text-primary">AI</span> Tor
          </h1>
          <span className="text-[10px] tracking-widest text-muted-foreground">
            ΓΩΣΖ
          </span>
        </div>
        <div className="hidden sm:block text-[10px] text-muted-foreground max-w-[200px] leading-tight">
          ΔlieπFlΦw DAO Synapse
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <ModelSelector value={selectedModel} onChange={onModelChange} />
        
        {hasMessages && (
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onClear}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}

        <Button 
          variant="ghost" 
          size="icon"
          onClick={handleSignOut}
          className="text-muted-foreground hover:text-foreground"
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
