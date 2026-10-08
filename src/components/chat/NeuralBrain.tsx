import { useMemo } from "react";
import { Activity, BrainCircuit, Cpu, Network } from "lucide-react";

const NODES = [
  { x: 50, y: 13 }, { x: 29, y: 24 }, { x: 70, y: 25 },
  { x: 18, y: 44 }, { x: 42, y: 39 }, { x: 61, y: 45 }, { x: 82, y: 44 },
  { x: 28, y: 63 }, { x: 51, y: 59 }, { x: 72, y: 65 },
  { x: 40, y: 80 }, { x: 62, y: 81 },
];

const LINKS = [[0,1],[0,2],[1,3],[1,4],[2,5],[2,6],[3,7],[4,7],[4,8],[5,8],[5,9],[6,9],[7,10],[8,10],[8,11],[9,11]];

export function NeuralBrain() {
  const delays = useMemo(() => NODES.map((_, index) => `${(index % 6) * 180}ms`), []);

  return (
    <div className="relative flex h-full min-h-[320px] w-full items-center justify-center overflow-hidden bg-background">
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(hsl(var(--border)/.35)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/.35)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="relative aspect-square w-[min(76vw,540px)]">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" role="img" aria-label="Núcleo neuronal activo">
          <defs>
            <filter id="neural-glow"><feGaussianBlur stdDeviation="1.5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <path d="M50 7 C25 6 10 23 12 48 C8 65 22 88 43 91 C47 96 54 96 58 91 C79 87 91 67 87 47 C90 24 75 7 50 7Z" fill="hsl(var(--card)/.45)" stroke="hsl(var(--primary)/.42)" strokeWidth=".65" />
          {LINKS.map(([from, to], index) => (
            <line key={index} x1={NODES[from].x} y1={NODES[from].y} x2={NODES[to].x} y2={NODES[to].y} stroke="hsl(var(--secondary)/.55)" strokeWidth=".45" strokeDasharray="2 2" className="animate-pulse" />
          ))}
          {NODES.map((node, index) => (
            <g key={index} filter="url(#neural-glow)" style={{ animationDelay: delays[index] }} className="animate-pulse">
              <circle cx={node.x} cy={node.y} r={index === 8 ? 3.2 : 1.7} fill={index === 8 ? "hsl(var(--accent))" : "hsl(var(--primary))"} />
              <circle cx={node.x} cy={node.y} r={index === 8 ? 6 : 3.5} fill="none" stroke="hsl(var(--primary)/.28)" strokeWidth=".5" />
            </g>
          ))}
        </svg>
        <div className="absolute inset-x-0 bottom-2 flex justify-center">
          <div className="flex items-center gap-3 border border-primary/25 bg-card/80 px-3 py-2 font-mono text-[9px] uppercase text-muted-foreground backdrop-blur-xl">
            <span className="flex items-center gap-1 text-primary"><Activity className="h-3 w-3" /> Active</span>
            <span className="flex items-center gap-1"><Cpu className="h-3 w-3" /> Neural core</span>
            <span className="flex items-center gap-1"><Network className="h-3 w-3" /> 12 oracles</span>
          </div>
        </div>
      </div>
      <div className="absolute left-3 top-3 flex items-center gap-2 text-[10px] uppercase text-primary"><BrainCircuit className="h-4 w-4" /> Machine mind</div>
    </div>
  );
}