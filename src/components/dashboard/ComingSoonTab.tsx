import { Construction } from "lucide-react";

interface ComingSoonTabProps {
  title: string;
}

export function ComingSoonTab({ title }: ComingSoonTabProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
      <div className="p-4 rounded-full bg-muted/20 border border-border/20">
        <Construction className="w-8 h-8 text-primary/50" />
      </div>
      <div>
        <h2 className="text-lg font-heading text-primary/70 tracking-wider uppercase">{title}</h2>
        <p className="text-xs text-muted-foreground/50 mt-1 font-mono">Coming Soon — ΔlieπFlΦw DAO</p>
      </div>
    </div>
  );
}
