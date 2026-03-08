import { useState, useEffect } from "react";
import { GitCommit, Radio, Cpu, Activity, Twitter, Send, Github, BarChart3, Wifi, WifiOff } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ControlRoomProps {
  isOpen: boolean;
}

// Simulated data for demo
const MOCK_COMMITS = [
  { hash: "a3f9c2d", msg: "feat: CesiumJS globe integration", time: "2h ago" },
  { hash: "8b1e4f7", msg: "fix: chat streaming SSE parser", time: "5h ago" },
  { hash: "c7d2a91", msg: "refactor: edge function routing", time: "1d ago" },
];

export function ControlRoom({ isOpen }: ControlRoomProps) {
  const [neuralLoad, setNeuralLoad] = useState(42);
  const [tokensProcessed, setTokensProcessed] = useState(12847);

  useEffect(() => {
    const interval = setInterval(() => {
      setNeuralLoad(30 + Math.random() * 50);
      setTokensProcessed(prev => prev + Math.floor(Math.random() * 100));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="w-64 border-l border-border bg-card/40 backdrop-blur-sm flex flex-col overflow-y-auto shrink-0">
      <div className="p-3 border-b border-border">
        <h3 className="text-[10px] font-mono font-bold text-foreground/70 tracking-widest uppercase flex items-center gap-2">
          <Activity className="w-3 h-3 text-secondary" />
          Control Room
        </h3>
      </div>

      {/* GitHub Status */}
      <div className="p-3 border-b border-border/50">
        <div className="flex items-center gap-2 mb-2">
          <Github className="w-3 h-3 text-muted-foreground/70" />
          <span className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-wider">Latest Commits</span>
        </div>
        <div className="space-y-1.5">
          {MOCK_COMMITS.map((commit) => (
            <div key={commit.hash} className="flex items-start gap-2">
              <GitCommit className="w-3 h-3 text-secondary/60 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-mono text-foreground/70 truncate">{commit.msg}</p>
                <p className="text-[8px] font-mono text-muted-foreground/40">{commit.hash} · {commit.time}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
          <span className="text-[9px] font-mono text-secondary/70">Repo Sync: Active</span>
        </div>
      </div>

      {/* RRSS Automation */}
      <div className="p-3 border-b border-border/50">
        <div className="flex items-center gap-2 mb-2">
          <Radio className="w-3 h-3 text-muted-foreground/70" />
          <span className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-wider">RRSS Status</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Twitter className="w-3 h-3 text-muted-foreground/50" />
              <span className="text-[10px] font-mono text-muted-foreground/60">X/Twitter Bot</span>
            </div>
            <div className="flex items-center gap-1">
              <Wifi className="w-2.5 h-2.5 text-secondary" />
              <span className="text-[9px] font-mono text-secondary">Online</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="w-3 h-3 text-muted-foreground/50" />
              <span className="text-[10px] font-mono text-muted-foreground/60">Telegram</span>
            </div>
            <div className="flex items-center gap-1">
              <WifiOff className="w-2.5 h-2.5 text-muted-foreground/40" />
              <span className="text-[9px] font-mono text-muted-foreground/40">Standby</span>
            </div>
          </div>
        </div>
      </div>

      {/* System Load */}
      <div className="p-3 border-b border-border/50">
        <div className="flex items-center gap-2 mb-2">
          <Cpu className="w-3 h-3 text-muted-foreground/70" />
          <span className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-wider">Neural Processing</span>
        </div>
        <div className="space-y-2">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-mono text-muted-foreground/50">Load</span>
              <span className="text-[9px] font-mono text-secondary">{neuralLoad.toFixed(0)}%</span>
            </div>
            <Progress value={neuralLoad} className="h-1.5 bg-muted/30" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-mono text-muted-foreground/50">Memory</span>
              <span className="text-[9px] font-mono text-primary/70">67%</span>
            </div>
            <Progress value={67} className="h-1.5 bg-muted/30" />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-3 h-3 text-muted-foreground/70" />
          <span className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-wider">Session</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-muted/20 rounded-lg p-2 text-center border border-border/50">
            <p className="text-sm font-mono font-bold text-primary">{tokensProcessed.toLocaleString()}</p>
            <p className="text-[8px] font-mono text-muted-foreground/40 uppercase mt-0.5">Tokens</p>
          </div>
          <div className="bg-muted/20 rounded-lg p-2 text-center border border-border/50">
            <p className="text-sm font-mono font-bold text-secondary">9</p>
            <p className="text-[8px] font-mono text-muted-foreground/40 uppercase mt-0.5">Oráculos</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto p-3 border-t border-border/50">
        <p className="text-[8px] font-mono text-muted-foreground/25 text-center tracking-wider">
          ΔlieπFlΦw DAO · Synapse v69
        </p>
      </div>
    </div>
  );
}
