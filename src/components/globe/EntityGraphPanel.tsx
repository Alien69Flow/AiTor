import { useState, useMemo, useRef, useEffect, Suspense, lazy } from "react";
import { Plane, Ship, Building2, User, Globe, OctagonAlert as AlertOctagon, Ban, Network, Maximize2, Minimize2, X, Loader as Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ForceGraph2D = lazy(() => import("react-force-graph-2d"));

export interface EntityNode {
  id: string;
  label: string;
  type:
    | "aircraft"
    | "vessel"
    | "company"
    | "person"
    | "country"
    | "event"
    | "sanction"
    | "ip";
  properties?: Record<string, any>;
}

export interface EntityLink {
  source: string;
  target: string;
  label: string;
}

interface EntityGraphPanelProps {
  nodes: EntityNode[];
  links: EntityLink[];
  onNodeClick?: (node: EntityNode) => void;
  onClose: () => void;
}

const NODE_CONFIG: Record<
  EntityNode["type"],
  { color: string; icon: typeof Plane; size: number }
> = {
  aircraft: { color: "#22d3ee", icon: Plane, size: 10 },
  vessel: { color: "#38bdf8", icon: Ship, size: 10 },
  company: { color: "#fbbf24", icon: Building2, size: 12 },
  person: { color: "#a78bfa", icon: User, size: 10 },
  country: { color: "#34d399", icon: Globe, size: 14 },
  event: { color: "#f87171", icon: AlertOctagon, size: 10 },
  sanction: { color: "#dc2626", icon: Ban, size: 10 },
  ip: { color: "#94a3b8", icon: Network, size: 8 },
};

export function EntityGraphPanel({
  nodes,
  links,
  onNodeClick,
  onClose,
}: EntityGraphPanelProps) {
  const [maximized, setMaximized] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 360, height: 300 });

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setDimensions({
        width: Math.max(200, rect.width),
        height: Math.max(200, rect.height),
      });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [maximized]);

  const graphData = useMemo(
    () => ({
      nodes: nodes.map((n) => ({ ...n })),
      links: links.map((l) => ({ ...l })),
    }),
    [nodes, links]
  );

  const highlightedLinks = useMemo(() => {
    if (!hoveredNode) return null;
    const connected = new Set<string>([hoveredNode]);
    links.forEach((l) => {
      if (l.source === hoveredNode) connected.add(l.target);
      if (l.target === hoveredNode) connected.add(l.source);
    });
    return connected;
  }, [hoveredNode, links]);

  const isLoading = nodes.length === 0;

  return (
    <div
      className={cn(
        "fixed z-50 pointer-events-auto transition-all duration-300",
        maximized
          ? "inset-4"
          : "bottom-4 right-4 w-[360px] h-[340px]"
      )}
    >
      <div className="w-full h-full flex flex-col rounded-2xl backdrop-blur-2xl border border-slate-700/40 bg-slate-900/80 shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/30 shrink-0">
          <div className="flex items-center gap-2">
            <Network className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/85">
              Entity Graph
            </span>
            <span className="text-[8px] text-slate-500 font-mono">
              {nodes.length}n · {links.length}e
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMaximized((v) => !v)}
              className="p-1 rounded-lg hover:bg-slate-700/40 transition-colors"
            >
              {maximized ? (
                <Minimize2 className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-700/40 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Graph canvas */}
        <div ref={containerRef} className="flex-1 relative bg-slate-950/50">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
                <span className="text-[9px] uppercase tracking-wider text-slate-500">
                  Loading graph...
                </span>
              </div>
            </div>
          ) : nodes.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[9px] uppercase tracking-wider text-slate-600">
                No entities to display
              </span>
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
                </div>
              }
            >
              <ForceGraph2D
                ref={fgRef}
                graphData={graphData}
                width={dimensions.width}
                height={dimensions.height}
                backgroundColor="rgba(2,6,23,0.5)"
                nodeRelSize={6}
                nodeId="id"
                nodeColor={(node: any) => {
                  const cfg = NODE_CONFIG[node.type as EntityNode["type"]];
                  if (hoveredNode && node.id !== hoveredNode && highlightedLinks && !highlightedLinks.has(node.id)) {
                    return "#334155";
                  }
                  return cfg?.color ?? "#64748b";
                }}
                linkColor={(link: any) => {
                  if (!hoveredNode) return "#47556955";
                  const src = typeof link.source === "object" ? link.source.id : link.source;
                  const tgt = typeof link.target === "object" ? link.target.id : link.target;
                  if (src === hoveredNode || tgt === hoveredNode) return "#22d3ee";
                  return "#1e293b55";
                }}
                linkWidth={(link: any) => {
                  if (!hoveredNode) return 1;
                  const src = typeof link.source === "object" ? link.source.id : link.source;
                  const tgt = typeof link.target === "object" ? link.target.id : link.target;
                  return src === hoveredNode || tgt === hoveredNode ? 2 : 0.5;
                }}
                onNodeHover={(node: any) => {
                  setHoveredNode(node?.id ?? null);
                  if (containerRef.current) {
                    containerRef.current.style.cursor = node ? "pointer" : "default";
                  }
                }}
                onNodeClick={(node: any) => {
                  if (node && onNodeClick) {
                    onNodeClick({
                      id: node.id,
                      label: node.label,
                      type: node.type,
                      properties: node.properties,
                    });
                  }
                }}
                nodeCanvasObject={(node: any, ctx: any, globalScale: number) => {
                  const cfg = NODE_CONFIG[node.type as EntityNode["type"]];
                  if (!cfg) return;
                  const r = cfg.size / 2;
                  const isFaded =
                    hoveredNode &&
                    node.id !== hoveredNode &&
                    highlightedLinks &&
                    !highlightedLinks.has(node.id);

                  ctx.globalAlpha = isFaded ? 0.2 : 1;
                  ctx.fillStyle = cfg.color;
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
                  ctx.fill();

                  ctx.strokeStyle = `${cfg.color}80`;
                  ctx.lineWidth = 1;
                  ctx.stroke();

                  if (globalScale > 1.5) {
                    ctx.font = `${8 / globalScale}px sans-serif`;
                    ctx.fillStyle = "#cbd5e1";
                    ctx.textAlign = "center";
                    ctx.fillText(
                      node.label?.substring(0, 12) ?? node.id,
                      node.x,
                      node.y + r + 6 / globalScale
                    );
                  }
                  ctx.globalAlpha = 1;
                }}
                cooldownTicks={100}
              />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}
