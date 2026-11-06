import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity, ArrowRight, Building2, Cpu, Database, Layers3, MessageSquare,
  Pause, Play, Radio, Route as RouteIcon, Timer, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiTorMark } from "@/components/AiTorMark";
import type { Message } from "@/hooks/useChat";
import {
  ACTIVE_ORACLES,
  CORE_META,
  DOCUMENTED_DOMAINS,
  ROUTE_PROMPTS,
  SKILL_NODES,
  SKILL_PROMPTS,
  TOKEN_ESTIMATE_NOTE,
  WORKFLOW_ROUTES,
  formatLatency,
  formatTokens,
  routeById,
  type RouteId,
} from "@/lib/neural-core-model";
import { useNeuralFeed, type FeedEvent } from "./useNeuralFeed";

interface NeuralCoreProps {
  messages: Message[];
  isLoading: boolean;
  modelId: string;
  onChat: () => void;
  onCity: () => void;
  /** Runs a real task in the chat with the active oracle. */
  onPrompt: (prompt: string) => void;
}

type Palette = {
  background: string;
  card: string;
  primary: string;
  secondary: string;
  accent: string;
  border: string;
  cyan: string;
};

interface LiveState {
  isLoading: boolean;
  paused: boolean;
  pulse: number;
  activeRoute: RouteId | null;
  knowledgeLabels: string[];
  knowledgeDone: number[];
  oracleLabels: string[];
  oracleIcons: string[];
}

const col = (triple: string, alpha = 1) => `hsl(${triple} / ${alpha})`;

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    background: token("--background", "220 25% 6%"),
    card: token("--card", "220 25% 8%"),
    primary: token("--primary", "120 100% 50%"),
    secondary: token("--secondary", "75 100% 34%"),
    accent: token("--accent", "75 100% 34%"),
    border: token("--border", "220 20% 18%"),
    cyan: token("--glow-cyan", "187 100% 50%"),
  };
}

const FONT = "ui-monospace, SFMono-Regular, Menlo, monospace";

/**
 * Machine-mind view: a live swarm of data flowing through the skills ring,
 * the knowledge ring and the oracle ring into the core. Every packet is
 * generated from the real session state (a query in flight surges the flow,
 * the deterministic supervisor router lights the matching lane).
 */
export function NeuralCore({ messages, isLoading, modelId, onChat, onCity, onPrompt }: NeuralCoreProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const feed = useNeuralFeed(messages, isLoading);
  const [paused, setPaused] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const live = useRef<LiveState>({
    isLoading,
    paused,
    pulse: 0,
    activeRoute: null,
    knowledgeLabels: [],
    knowledgeDone: [],
    oracleLabels: ACTIVE_ORACLES.map((oracle) => oracle.name),
    oracleIcons: ACTIVE_ORACLES.map((oracle) => oracle.oracleIcon ?? "•"),
  });

  const knowledgeLabels = useMemo(
    () => feed.knowledgeBases.map((base) => base.label),
    [feed.knowledgeBases]
  );
  const knowledgeDone = useMemo(
    () => feed.knowledgeBases.map((base) => (base.origin === "documented" ? 0 : base.count)),
    [feed.knowledgeBases]
  );

  useEffect(() => {
    live.current.isLoading = isLoading;
    live.current.paused = paused;
    live.current.pulse = feed.pulse;
    live.current.activeRoute = feed.activeRoute;
    live.current.knowledgeLabels = knowledgeLabels;
    live.current.knowledgeDone = knowledgeDone;
  }, [isLoading, paused, feed.pulse, feed.activeRoute, knowledgeLabels, knowledgeDone]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const palette = readPalette();
    let width = 0;
    let height = 0;
    let dpr = 1;

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const ringRot = [0.2, -0.4, 0.1];
    const packets: { chain: [number, number][]; u: number; speed: number }[] = [];
    const pulses: { r: number; life: number }[] = [];
    const stars = Array.from({ length: 90 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.35 + Math.random() * 0.95,
      phase: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 1.5,
    }));

    let time = 0;
    let activity = 0.4;
    let lastPulse = live.current.pulse;
    let spawnAcc = 0;
    let raf = 0;
    let last = performance.now();

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      width = Math.max(rect.width, 1);
      height = Math.max(rect.height, 1);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    resize();

    const onPointerMove = (event: PointerEvent) => {
      const rect = wrap.getBoundingClientRect();
      pointer.tx = ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2;
      pointer.ty = ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2;
    };
    wrap.addEventListener("pointermove", onPointerMove);

    // The HUD rails overlay the canvas, so the swarm is centred on the space
    // that is actually visible instead of on the raw canvas box. The insets
    // mirror the Tailwind breakpoints that hide each rail (lg / xl).
    const geometry = () => {
      const railLeft = width >= 1280 ? 256 : 0;
      const railRight = width >= 1024 ? 304 : 0;
      const topInset = width >= 640 ? 118 : 104;
      const bottomInset = 98;
      const availW = Math.max(width - railLeft - railRight, 220);
      const availH = Math.max(height - topInset - bottomInset, 220);
      const radius = Math.min(availW, availH) * 0.46;
      return {
        cx: railLeft + availW / 2,
        cy: topInset + availH / 2,
        radius,
        core: radius * 0.13,
        rings: [radius * 0.4, radius * 0.68, radius * 0.95],
      };
    };

    const nodePos = (cx: number, cy: number, radius: number, rot: number, index: number, count: number) => {
      const angle = rot + (index * Math.PI * 2) / Math.max(count, 1);
      return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), angle };
    };

    const nodeCounts = () => [
      SKILL_NODES.length,
      Math.max(live.current.knowledgeLabels.length, 1),
      live.current.oracleLabels.length,
    ];

    const spawn = () => {
      const [skills, knowledge, oracles] = nodeCounts();
      const chain: [number, number][] = [
        [2, Math.floor(Math.random() * oracles)],
        [1, Math.floor(Math.random() * knowledge)],
        [0, Math.floor(Math.random() * skills)],
        [-1, -1],
      ];
      packets.push({ chain, u: 0, speed: 0.78 + Math.random() * 0.5 });
    };

    const resolveChain = (chain: [number, number][], geo: ReturnType<typeof geometry>) => {
      const counts = nodeCounts();
      return chain.map(([ring, index]) => {
        if (ring < 0) return { x: geo.cx, y: geo.cy };
        return nodePos(geo.cx, geo.cy, geo.rings[ring], ringRot[ring], index, counts[ring]);
      });
    };

    const sampleChain = (points: { x: number; y: number }[], u: number) => {
      const lengths: number[] = [];
      let total = 0;
      for (let i = 1; i < points.length; i += 1) {
        const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
        lengths.push(d);
        total += d;
      }
      let target = Math.max(0, Math.min(1, u)) * total;
      for (let i = 0; i < lengths.length; i += 1) {
        if (target <= lengths[i] || i === lengths.length - 1) {
          const t = lengths[i] === 0 ? 0 : Math.min(1, target / lengths[i]);
          return {
            x: points[i].x + (points[i + 1].x - points[i].x) * t,
            y: points[i].y + (points[i + 1].y - points[i].y) * t,
          };
        }
        target -= lengths[i];
      }
      return points[points.length - 1];
    };

    const drawBackground = () => {
      const geo = geometry();
      const base = ctx.createRadialGradient(geo.cx, geo.cy, 0, geo.cx, geo.cy, Math.max(width, height) * 0.75);
      base.addColorStop(0, col(palette.card, 0.75));
      base.addColorStop(0.5, col(palette.background, 0.92));
      base.addColorStop(1, col(palette.background, 1));
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.strokeStyle = col(palette.border, 0.16);
      ctx.lineWidth = 1;
      const step = 38;
      const offset = (time * 5) % step;
      ctx.beginPath();
      for (let x = -offset; x < width + step; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = -offset; y < height + step; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
      ctx.restore();

      ctx.save();
      for (const star of stars) {
        const alpha = 0.16 + 0.22 * (0.5 + 0.5 * Math.sin(time * star.speed + star.phase));
        ctx.fillStyle = col(star.phase > Math.PI ? palette.primary : palette.cyan, alpha);
        ctx.beginPath();
        ctx.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const drawRings = (geo: ReturnType<typeof geometry>) => {
      ctx.save();
      for (let i = 0; i < geo.rings.length; i += 1) {
        ctx.strokeStyle = col(palette.border, i === 0 ? 0.32 : 0.2);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(geo.cx, geo.cy, geo.rings[i], 0, Math.PI * 2);
        ctx.stroke();
      }

      // Tactical ticks on the outer ring.
      const ticks = 72;
      for (let i = 0; i < ticks; i += 1) {
        const angle = (i * Math.PI * 2) / ticks + ringRot[2];
        const long = i % 6 === 0;
        const inner = geo.rings[2] + (long ? 5 : 9);
        const outer = geo.rings[2] + (long ? 16 : 13);
        ctx.strokeStyle = col(palette.cyan, long ? 0.32 : 0.14);
        ctx.beginPath();
        ctx.moveTo(geo.cx + inner * Math.cos(angle), geo.cy + inner * Math.sin(angle));
        ctx.lineTo(geo.cx + outer * Math.cos(angle), geo.cy + outer * Math.sin(angle));
        ctx.stroke();
      }
      ctx.restore();

      // Corner brackets.
      const size = 26;
      const inset = 12;
      ctx.save();
      ctx.strokeStyle = col(palette.primary, 0.22);
      ctx.lineWidth = 1;
      const corners: [number, number, number, number][] = [
        [inset, inset, 1, 1],
        [width - inset, inset, -1, 1],
        [inset, height - inset, 1, -1],
        [width - inset, height - inset, -1, -1],
      ];
      for (const [x, y, sx, sy] of corners) {
        ctx.beginPath();
        ctx.moveTo(x, y + size * sy);
        ctx.lineTo(x, y);
        ctx.lineTo(x + size * sx, y);
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawSynapses = (geo: ReturnType<typeof geometry>) => {
      const counts = nodeCounts();
      ctx.save();
      ctx.lineWidth = 1;
      // Core → skills
      for (let i = 0; i < counts[0]; i += 1) {
        const node = nodePos(geo.cx, geo.cy, geo.rings[0], ringRot[0], i, counts[0]);
        ctx.strokeStyle = col(palette.primary, 0.14);
        ctx.beginPath();
        ctx.moveTo(geo.cx, geo.cy);
        ctx.lineTo(node.x, node.y);
        ctx.stroke();
      }
      // Skills ↔ knowledge
      for (let i = 0; i < counts[1]; i += 1) {
        const mid = nodePos(geo.cx, geo.cy, geo.rings[1], ringRot[1], i, counts[1]);
        for (const offset of [0, 1]) {
          const inner = nodePos(geo.cx, geo.cy, geo.rings[0], ringRot[0], (i + offset) % counts[0], counts[0]);
          ctx.strokeStyle = col(palette.secondary, 0.12);
          ctx.beginPath();
          ctx.moveTo(mid.x, mid.y);
          ctx.lineTo(inner.x, inner.y);
          ctx.stroke();
        }
      }
      // Knowledge ↔ oracles
      for (let i = 0; i < counts[2]; i += 1) {
        const outer = nodePos(geo.cx, geo.cy, geo.rings[2], ringRot[2], i, counts[2]);
        const mid = nodePos(geo.cx, geo.cy, geo.rings[1], ringRot[1], i % counts[1], counts[1]);
        ctx.strokeStyle = col(palette.cyan, 0.1);
        ctx.beginPath();
        ctx.moveTo(outer.x, outer.y);
        ctx.lineTo(mid.x, mid.y);
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawNodes = (geo: ReturnType<typeof geometry>) => {
      const counts = nodeCounts();
      const knowledge = live.current.knowledgeLabels;
      const kbDone = live.current.knowledgeDone;
      const oracles = live.current.oracleLabels;
      const oracleIcons = live.current.oracleIcons;

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Skills ring
      for (let i = 0; i < counts[0]; i += 1) {
        const node = nodePos(geo.cx, geo.cy, geo.rings[0], ringRot[0], i, counts[0]);
        const breathe = 0.7 + 0.3 * Math.sin(time * 1.6 + i);
        ctx.fillStyle = col(palette.primary, 0.9);
        ctx.beginPath();
        ctx.arc(node.x, node.y, 2.6 + breathe * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = col(palette.primary, 0.28);
        ctx.beginPath();
        ctx.arc(node.x, node.y, 7 + breathe * 1.6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = `500 9px ${FONT}`;
        ctx.fillStyle = col(palette.primary, 0.62);
        ctx.fillText(SKILL_NODES[i]?.label ?? "", node.x, node.y + 17);
      }

      // Knowledge ring
      for (let i = 0; i < counts[1]; i += 1) {
        const node = nodePos(geo.cx, geo.cy, geo.rings[1], ringRot[1], i, counts[1]);
        const full = (kbDone[i] ?? 0) > 0;
        const tone = full ? palette.secondary : palette.border;
        ctx.strokeStyle = col(tone, full ? 0.85 : 0.7);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 4.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = col(tone, full ? 0.9 : 0.4);
        ctx.beginPath();
        ctx.arc(node.x, node.y, 1.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `500 9px ${FONT}`;
        ctx.fillStyle = col(palette.secondary, full ? 0.7 : 0.35);
        ctx.fillText(knowledge[i] ?? "", node.x, node.y - 15);
        ctx.font = `400 8px ${FONT}`;
        ctx.fillStyle = full ? col(palette.secondary, 0.45) : col(palette.border, 0.6);
        ctx.fillText(full ? String(kbDone[i]) : "sin indexar", node.x, node.y + 15);
      }

      // Oracle ring
      for (let i = 0; i < counts[2]; i += 1) {
        const node = nodePos(geo.cx, geo.cy, geo.rings[2], ringRot[2], i, counts[2]);
        const active = live.current.isLoading && live.current.activeRoute !== null;
        const glow = active ? 0.5 : 0.24;
        ctx.fillStyle = col(palette.cyan, glow + 0.2 * Math.sin(time * 2 + i * 0.8) * 0.5);
        ctx.beginPath();
        ctx.arc(node.x, node.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = col(palette.cyan, 0.3);
        ctx.beginPath();
        ctx.arc(node.x, node.y, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = `400 11px ${FONT}`;
        ctx.fillStyle = col(palette.primary, 0.85);
        ctx.fillText(oracleIcons[i] ?? "•", node.x, node.y - 16);
        // Names are dropped on narrow canvases, where they would overlap.
        if (width < 640) continue;
        const label = oracles[i] ?? "";
        ctx.font = `500 9px ${FONT}`;
        ctx.fillStyle = col(palette.cyan, 0.55);
        ctx.fillText(label.length > 16 ? `${label.slice(0, 15)}…` : label, node.x, node.y + 17);
      }
      ctx.restore();
    };

    const drawCore = (geo: ReturnType<typeof geometry>) => {
      const glow = ctx.createRadialGradient(geo.cx, geo.cy, 0, geo.cx, geo.cy, geo.core * 6);
      glow.addColorStop(0, col(palette.primary, 0.34 * (0.7 + activity)));
      glow.addColorStop(0.45, col(palette.secondary, 0.12 * activity));
      glow.addColorStop(1, col(palette.background, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.strokeStyle = col(palette.primary, 0.5);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(geo.cx, geo.cy, geo.core, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = col(palette.secondary, 0.34);
      ctx.beginPath();
      ctx.arc(geo.cx, geo.cy, geo.core * 1.45, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = col(palette.cyan, 0.22);
      ctx.beginPath();
      ctx.arc(geo.cx, geo.cy, geo.core * 1.95, 0, Math.PI * 2);
      ctx.stroke();

      // Counter-rotating dashed arcs.
      ctx.setLineDash([9, 11]);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = col(palette.primary, 0.6);
      ctx.beginPath();
      ctx.arc(geo.cx, geo.cy, geo.core * 1.7, time * 0.9, time * 0.9 + Math.PI * 1.2);
      ctx.stroke();

      ctx.setLineDash([3, 9]);
      ctx.strokeStyle = col(palette.secondary, 0.55);
      ctx.beginPath();
      ctx.arc(geo.cx, geo.cy, geo.core * 1.28, -time * 1.4, -time * 1.4 + Math.PI * 1.5);
      ctx.stroke();
      ctx.setLineDash([]);

      // Hexagon core.
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = (i * Math.PI) / 3 + time * 0.25;
        const x = geo.cx + geo.core * 0.72 * Math.cos(angle);
        const y = geo.cy + geo.core * 0.72 * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = col(palette.primary, 0.5 + 0.3 * activity);
      ctx.fill();
      ctx.strokeStyle = col(palette.primary, 0.85);
      ctx.stroke();

      if (live.current.isLoading) {
        ctx.strokeStyle = col(palette.secondary, 0.9);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(geo.cx, geo.cy, geo.core * 2.35, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ((time * 0.55) % 1));
        ctx.stroke();
      }
      ctx.restore();

      for (let i = pulses.length - 1; i >= 0; i -= 1) {
        const pulse = pulses[i];
        ctx.strokeStyle = col(palette.primary, Math.max(0, 0.5 * (1 - pulse.life)));
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(geo.cx, geo.cy, pulse.r, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    const drawPackets = (geo: ReturnType<typeof geometry>) => {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = packets.length - 1; i >= 0; i -= 1) {
        const packet = packets[i];
        const points = resolveChain(packet.chain, geo);
        const head = sampleChain(points, packet.u);
        const mid = sampleChain(points, packet.u - 0.035);
        const tail = sampleChain(points, packet.u - 0.085);
        const fade = packet.u > 0.94 ? (1 - packet.u) / 0.06 : 1;
        const gradient = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
        gradient.addColorStop(0, col(palette.background, 0));
        gradient.addColorStop(1, col(palette.primary, 0.55 * fade));
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(tail.x, tail.y);
        ctx.lineTo(mid.x, mid.y);
        ctx.lineTo(head.x, head.y);
        ctx.stroke();

        const bloom = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 6);
        bloom.addColorStop(0, col(palette.secondary, 0.85 * fade));
        bloom.addColorStop(1, col(palette.secondary, 0));
        ctx.fillStyle = bloom;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const drawScanline = () => {
      const y = ((time * 46) % (height + 160)) - 160;
      const band = ctx.createLinearGradient(0, y, 0, y + 160);
      band.addColorStop(0, col(palette.primary, 0));
      band.addColorStop(0.5, col(palette.primary, live.current.isLoading ? 0.075 : 0.035));
      band.addColorStop(1, col(palette.primary, 0));
      ctx.fillStyle = band;
      ctx.fillRect(0, y, width, 160);
    };

    const drawVignette = () => {
      const vignette = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.72);
      vignette.addColorStop(0, col(palette.background, 0));
      vignette.addColorStop(0.65, col(palette.background, 0.35));
      vignette.addColorStop(1, col(palette.background, 0.92));
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
    };

    const frame = (now: number) => {
      const raw = Math.min((now - last) / 1000, 0.05);
      last = now;
      const dt = live.current.paused ? 0 : raw;
      time += dt;

      if (live.current.pulse !== lastPulse) {
        lastPulse = live.current.pulse;
        pulses.push({ r: geometry().core * 1.1, life: 0 });
        if (pulses.length > 6) pulses.shift();
        activity = 1;
      }

      const target = live.current.isLoading ? 1 : 0.42;
      if (dt > 0) activity += (target - activity) * Math.min(dt * 3, 1);

      for (let i = 0; i < ringRot.length; i += 1) {
        ringRot[i] += dt * [0.03, -0.022, 0.014][i];
      }

      const geo = geometry();

      spawnAcc += dt * (live.current.isLoading ? 15 : 5.2);
      while (spawnAcc >= 1) {
        spawn();
        spawnAcc -= 1;
      }
      if (packets.length > 220) packets.splice(0, packets.length - 220);
      for (let i = packets.length - 1; i >= 0; i -= 1) {
        packets[i].u += dt * packets[i].speed;
        if (packets[i].u >= 1) packets.splice(i, 1);
      }
      for (let i = pulses.length - 1; i >= 0; i -= 1) {
        pulses[i].r += dt * geo.core * 2.4;
        pulses[i].life += dt / 1.5;
        if (pulses[i].life >= 1) pulses.splice(i, 1);
      }

      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;

      drawBackground();
      ctx.save();
      ctx.translate(pointer.x * 9, pointer.y * 9);
      drawRings(geo);
      drawSynapses(geo);
      drawNodes(geo);
      drawPackets(geo);
      drawCore(geo);
      ctx.restore();
      drawScanline();
      drawVignette();

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      wrap.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  const stateLabel = isLoading ? "INFERENCIA EN CURSO" : "SINCRONIZADO";
  const routeShare = (count: number) =>
    feed.stats.userMessages ? Math.round((count / feed.stats.userMessages) * 100) : 0;
  const uptime = `${String(Math.floor(feed.uptimeSeconds / 3600)).padStart(2, "0")}:${String(
    Math.floor(feed.uptimeSeconds / 60) % 60
  ).padStart(2, "0")}:${String(feed.uptimeSeconds % 60).padStart(2, "0")}`;
  const activeOracle = ACTIVE_ORACLES.find((oracle) => oracle.id === modelId);

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div ref={wrapRef} className="absolute inset-0">
        <canvas ref={canvasRef} data-neural-canvas aria-hidden="true" className="h-full w-full" />
      </div>

      <div className="pointer-events-none relative z-10 flex items-start justify-between gap-3 p-3 sm:p-5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-primary/80">
            <AiTorMark className="h-4 w-4" tile={false} label="" />
            {CORE_META.collective} · {CORE_META.protocol}
          </p>
          <h1 className="mt-1 text-base font-heading text-foreground sm:text-xl">
            AI Tor <span className="text-secondary">Núcleo Neural</span>
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] text-muted-foreground">
            <span className={`flex items-center gap-1.5 ${isLoading ? "text-amber-300" : "text-primary"}`}>
              <Zap className="h-3 w-3" aria-hidden="true" />
              {stateLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <Layers3 className="h-3 w-3" aria-hidden="true" />
              {SKILL_NODES.length} skills · {feed.knowledgeBases.length} bases · {ACTIVE_ORACLES.length} oráculos
            </span>
            <span className="hidden items-center gap-1.5 sm:flex">
              <Timer className="h-3 w-3" aria-hidden="true" />
              {uptime} activo
            </span>
          </div>
        </div>
        <div className="pointer-events-auto flex shrink-0 gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-background/80"
            aria-pressed={paused}
            aria-label={paused ? "Reanudar animación" : "Pausar animación"}
            title={paused ? "Reanudar animación" : "Pausar animación"}
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 bg-background/80 font-mono text-[10px]"
            onClick={onCity}
            title="Abrir AlienFlow.Space DAO City"
          >
            <Building2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ciudad DAO</span>
          </Button>
          <Button variant="outline" size="sm" className="h-8 bg-background/80 font-mono text-[10px]" onClick={onChat}>
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Chat</span>
          </Button>
        </div>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 items-start justify-between gap-3 px-3 pb-2 sm:px-5">
        <aside className="hidden w-60 shrink-0 flex-col gap-2 overflow-y-auto no-scrollbar xl:flex" aria-label="Métricas de sesión">
          <Panel title="Sesión" icon={<Activity className="h-3.5 w-3.5" aria-hidden="true" />}>
            <Stat label="Consultas" value={String(feed.stats.userMessages)} />
            <Stat label="Respuestas" value={String(feed.stats.replies)} />
            <div title={feed.stats.tokensExact ? "Tokens reales reportados por el proveedor." : TOKEN_ESTIMATE_NOTE}>
              <Stat label={feed.stats.tokensExact ? "Tokens" : "Tokens ≈"} value={formatTokens(feed.stats.tokens)} />
            </div>
            <Stat label="Latencia media" value={formatLatency(feed.stats.avgLatencyMs)} />
            <Stat label="Última latencia" value={formatLatency(feed.stats.lastLatencyMs)} tone="secondary" />
          </Panel>
          <Panel title="Protocolo" icon={<Cpu className="h-3.5 w-3.5" aria-hidden="true" />}>
            <Stat label="Núcleo" value={`${CORE_META.name} ${CORE_META.version}`} />
            <Stat label="Frecuencia" value={CORE_META.frequency} tone="secondary" />
            <Stat label="Contexto" value={activeOracle?.contextWindow ?? "—"} />
            <Stat label="Oráculo activo" value={activeOracle?.name ?? "—"} />
          </Panel>
          <Panel title="Skills" icon={<Zap className="h-3.5 w-3.5" aria-hidden="true" />}>
            {SKILL_NODES.map((skill) => (
              <button
                key={skill.id}
                type="button"
                onClick={() => onPrompt(SKILL_PROMPTS[skill.id] ?? `${skill.label}: `)}
                title={`Lanzar la skill "${skill.label}" en el chat`}
                className="group flex w-full items-center justify-between gap-2 py-0.5 text-left font-mono text-[9px] text-muted-foreground transition-colors hover:text-secondary"
              >
                <span className="min-w-0 truncate">{skill.label}</span>
                <span className="flex shrink-0 items-center gap-1 text-[8px] uppercase opacity-70">
                  {skill.status === "active" ? "activa" : "latente"}
                  <ArrowRight className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                </span>
              </button>
            ))}
          </Panel>
        </aside>

        <div className="hidden flex-1 md:block" aria-hidden="true" />

        <aside className="hidden w-72 shrink-0 flex-col gap-2 overflow-y-auto no-scrollbar lg:flex" aria-label="Flujo en tiempo real">
          <Panel
            title="Bases de conocimiento"
            icon={<Database className="h-3.5 w-3.5" aria-hidden="true" />}
            aside={
              <span className={`font-mono text-[8px] ${feed.remoteState === "ok" ? "text-primary" : feed.remoteState === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                {feed.remoteState === "ok" ? "REMOTO OK" : feed.remoteState === "error" ? "SIN ENLACE" : "ENLAZANDO"}
              </span>
            }
          >
            {feed.knowledgeBases.map((base) => (
              <div key={base.id} className="flex items-center justify-between gap-2 py-0.5 font-mono text-[9px]">
                <span className="min-w-0 truncate text-muted-foreground" title={base.source}>
                  {base.label}
                </span>
                <span className={base.count > 0 ? "text-secondary" : "text-muted-foreground/50"}>
                  {base.count > 0 ? base.count.toLocaleString("es-ES") : "vacío"}
                </span>
              </div>
            ))}
            <p className="mt-1 border-t border-border/50 pt-1.5 font-mono text-[8px] uppercase text-muted-foreground/60">
              Documentado · sin indexar
            </p>
            {DOCUMENTED_DOMAINS.map((domain) => (
              <div key={domain.id} className="flex items-center justify-between gap-2 font-mono text-[9px]">
                <span className="min-w-0 truncate text-muted-foreground/70" title={domain.detail}>
                  {domain.label}
                </span>
                <span className="text-muted-foreground/40">0</span>
              </div>
            ))}
          </Panel>

          <Panel
            title="Flujo en tiempo real"
            icon={<Radio className="h-3.5 w-3.5" aria-hidden="true" />}
            className="min-h-0"
          >
            <div className="flex max-h-56 flex-col gap-1 overflow-y-auto no-scrollbar" role="log" aria-live="off" aria-label="Eventos del núcleo">
              {feed.events.length === 0 && (
                <p className="font-mono text-[9px] text-muted-foreground/60">
                  Sin actividad todavía. Lanza una consulta para ver el enjambre.
                </p>
              )}
              {[...feed.events].reverse().map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </div>
          </Panel>
        </aside>
      </div>

      <nav
        className="relative z-10 shrink-0 border-t border-border/60 bg-background/85 px-3 py-2 backdrop-blur-xl"
        aria-label="Rutas del supervisor"
      >
        <div className="mb-1.5 flex items-center justify-between gap-2 font-mono text-[9px] uppercase text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <RouteIcon className="h-3 w-3" aria-hidden="true" />
            Supervisor · clasificador determinista por palabras clave
          </span>
          <span className={feed.activeRoute ? "text-secondary" : ""}>
            {feed.activeRoute ? routeById(feed.activeRoute).agent : "en espera"}
          </span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {WORKFLOW_ROUTES.map((route) => {
            const count = feed.routeCounts[route.id] ?? 0;
            const active = feed.activeRoute === route.id;
            return (
              <button
                key={route.id}
                type="button"
                onClick={() => onPrompt(ROUTE_PROMPTS[route.id])}
                title={`Ejecutar una tarea de ${route.agent} en el chat`}
                className={`min-w-[132px] shrink-0 border px-2 py-1.5 text-left font-mono transition-colors ${
                  active && isLoading
                    ? "border-secondary/70 bg-secondary/10 text-secondary"
                    : active
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : "border-border/60 bg-card/30 text-muted-foreground hover:border-secondary/40 hover:text-secondary"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[9px] uppercase">{route.agent}</span>
                  <span className="text-[9px]">{count}</span>
                </div>
                <p className="mt-0.5 truncate text-[8px] opacity-70">{route.detail}</p>
                <div className="mt-1 h-0.5 w-full bg-muted/40">
                  <div
                    className={`h-full ${active ? "bg-current" : "bg-muted-foreground/40"}`}
                    style={{ width: `${routeShare(count)}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </nav>
    </section>
  );
}

function Panel({
  title,
  icon,
  aside,
  children,
  className = "",
}: {
  title: string;
  icon: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border border-border/60 bg-card/45 p-2.5 backdrop-blur-xl ${className}`}>
      <header className="mb-2 flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1.5">
          {icon}
          {title}
        </span>
        {aside}
      </header>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Stat({ label, value, tone = "primary" }: { label: string; value: string; tone?: "primary" | "secondary" }) {
  return (
    <div className="flex items-baseline justify-between gap-2 font-mono text-[9px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={tone === "secondary" ? "text-secondary" : "text-foreground/90"}>{value}</span>
    </div>
  );
}

function EventRow({ event }: { event: FeedEvent }) {
  const tone =
    event.kind === "query"
      ? "text-primary"
      : event.kind === "reply"
        ? "text-secondary"
        : event.kind === "route"
          ? "text-accent"
          : "text-muted-foreground";
  const glyph = event.kind === "query" ? "▸" : event.kind === "reply" ? "◂" : event.kind === "route" ? "⇉" : "⟳";
  return (
    <div className="flex items-start gap-1.5 font-mono text-[9px] leading-tight">
      <span className={`${tone} shrink-0`} aria-hidden="true">
        {glyph}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-foreground/80" title={event.text}>
          {event.text}
        </p>
        <p className="truncate text-[8px] text-muted-foreground/60">
          {event.at.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · {event.meta}
        </p>
      </div>
    </div>
  );
}
