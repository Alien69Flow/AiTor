import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AI_MODELS } from "@/lib/ai-models";

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const availableModels = AI_MODELS.filter(m => m.available);
  const unavailableModels = AI_MODELS.filter(m => !m.available);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[220px] border-border bg-background/80 backdrop-blur-sm">
        <SelectValue placeholder="Seleccionar modelo" />
      </SelectTrigger>
      <SelectContent className="max-h-[400px]">
        <div className="px-2 py-1.5 text-xs font-semibold text-primary">
          Modelos Activos
        </div>
        {availableModels.map((model) => (
          <SelectItem key={model.id} value={model.id}>
            <div className="flex items-center gap-2">
              <span className="font-medium">{model.name}</span>
              <span className="text-xs text-muted-foreground">({model.provider})</span>
            </div>
          </SelectItem>
        ))}
        {unavailableModels.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2 border-t border-border pt-2">
              Próximamente
            </div>
            {unavailableModels.map((model) => (
              <SelectItem key={model.id} value={model.id} disabled>
                <div className="flex items-center gap-2 opacity-60">
                  <span>{model.name}</span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                    Coming Soon
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </>
        )}
      </SelectContent>
    </Select>
  );
}
