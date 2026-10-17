import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Message } from "@/hooks/useChat";
import {
  LOCAL_KNOWLEDGE_BASES,
  REMOTE_KNOWLEDGE_BASES,
  WORKFLOW_ROUTES,
  classifyIntent,
  estimateTokens,
  routeById,
  type KnowledgeBase,
  type RouteId,
} from "@/lib/neural-core-model";

/**
 * Derives everything the neural core view displays from real state:
 * the session's own messages, the live database counts, and the deterministic
 * supervisor router. No random values are presented as telemetry.
 */

export type RemoteState = "loading" | "ok" | "error";

export interface FeedEvent {
  id: string;
  at: Date;
  kind: "query" | "route" | "reply" | "sync";
  route: RouteId | null;
  text: string;
  meta: string;
}

export interface NeuralStats {
  exchanges: number;
  userMessages: number;
  replies: number;
  tokens: number;
  avgLatencyMs: number | null;
  lastLatencyMs: number | null;
  lastActivity: Date | null;
}

const MAX_EVENTS = 24;

function truncate(text: string, max = 46): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function buildFeed(messages: Message[]): { events: FeedEvent[]; routeCounts: Record<RouteId, number>; stats: NeuralStats } {
  const routeCounts = WORKFLOW_ROUTES.reduce((acc, route) => {
    acc[route.id] = 0;
    return acc;
  }, {} as Record<RouteId, number>);

  const events: FeedEvent[] = [];
  let pending: Message | null = null;
  let tokens = 0;
  let replies = 0;
  let userMessages = 0;
  let latencyTotal = 0;
  let latencySamples = 0;
  let lastLatencyMs: number | null = null;

  for (const message of messages) {
    const content = message.content.replace("[DEEP THINK] ", "");
    tokens += estimateTokens(content);

    if (message.role === "user") {
      userMessages += 1;
      pending = message;
      const route = classifyIntent(content);
      routeCounts[route] += 1;
      events.push({
        id: `${message.id}-q`,
        at: message.timestamp,
        kind: "query",
        route,
        text: truncate(content),
        meta: `${estimateTokens(content)} tok est.`,
      });
      events.push({
        id: `${message.id}-r`,
        at: message.timestamp,
        kind: "route",
        route,
        text: routeById(route).agent,
        meta: route,
      });
      continue;
    }

    if (!message.content) continue;
    replies += 1;
    const latency = pending ? message.timestamp.getTime() - pending.timestamp.getTime() : null;
    if (latency !== null && latency >= 0) {
      latencyTotal += latency;
      latencySamples += 1;
      lastLatencyMs = latency;
    }
    events.push({
      id: `${message.id}-a`,
      at: message.timestamp,
      kind: "reply",
      route: pending ? classifyIntent(pending.content) : "CHAT_GENERAL",
      text: truncate(content),
      meta: latency !== null ? `${estimateTokens(content)} tok est. · ${(latency / 1000).toFixed(1)}s` : `${estimateTokens(content)} tok est.`,
    });
    pending = null;
  }

  return {
    events: events.slice(-MAX_EVENTS),
    routeCounts,
    stats: {
      exchanges: replies,
      userMessages,
      replies,
      tokens,
      avgLatencyMs: latencySamples ? Math.round(latencyTotal / latencySamples) : null,
      lastLatencyMs,
      lastActivity: messages.length ? messages[messages.length - 1].timestamp : null,
    },
  };
}

export function useNeuralFeed(messages: Message[], isLoading: boolean) {
  const [remoteCounts, setRemoteCounts] = useState<Record<string, number | null>>({});
  const [remoteState, setRemoteState] = useState<RemoteState>("loading");
  const [remoteAt, setRemoteAt] = useState<Date | null>(null);
  const [syncEvents, setSyncEvents] = useState<FeedEvent[]>([]);
  const [tick, setTick] = useState(0);

  // Uptime ticker — keeps the "tiempo activo" readout honest.
  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const results = await Promise.all(
          REMOTE_KNOWLEDGE_BASES.map(async (base) => {
            const { count, error } = await supabase
              .from(base.table as "uap_sightings")
              .select("id", { count: "exact", head: true });
            if (error) throw error;
            return [base.id, count ?? 0] as const;
          })
        );
        if (cancelled) return;
        setRemoteCounts(Object.fromEntries(results));
        setRemoteState("ok");
        setRemoteAt(new Date());
        setSyncEvents((prev) =>
          [
            ...prev,
            {
              id: `sync-${Date.now()}`,
              at: new Date(),
              kind: "sync" as const,
              route: null,
              text: `${REMOTE_KNOWLEDGE_BASES.length} bases enlazadas`,
              meta: "supabase · recuento exacto",
            },
          ].slice(-MAX_EVENTS)
        );
      } catch {
        if (cancelled) return;
        setRemoteState("error");
        setRemoteAt(new Date());
      }
    };

    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const { events, routeCounts, stats } = useMemo(() => buildFeed(messages), [messages]);

  const knowledgeBases = useMemo<KnowledgeBase[]>(
    () => [
      ...LOCAL_KNOWLEDGE_BASES,
      ...REMOTE_KNOWLEDGE_BASES.map((base) => ({
        id: base.id,
        label: base.label,
        source: base.source,
        count: remoteCounts[base.id] ?? 0,
        origin: "remote" as const,
      })),
    ],
    [remoteCounts]
  );

  const lastUserMessage = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "user") return messages[index];
    }
    return null;
  }, [messages]);

  const activeRoute = lastUserMessage ? classifyIntent(lastUserMessage.content) : null;

  // New assistant content triggers a visual pulse; streaming nudges it continuously.
  const pulseRef = useRef(0);
  const lastReplyIdRef = useRef<string | null>(null);
  const lastReplyLengthRef = useRef(0);
  const lastMessage = messages[messages.length - 1];

  useEffect(() => {
    if (!lastMessage || lastMessage.role !== "assistant") return;
    if (lastReplyIdRef.current !== lastMessage.id) {
      lastReplyIdRef.current = lastMessage.id;
      lastReplyLengthRef.current = lastMessage.content.length;
      pulseRef.current += 1;
      return;
    }
    if (lastMessage.content.length !== lastReplyLengthRef.current) {
      lastReplyLengthRef.current = lastMessage.content.length;
      pulseRef.current += 0.4;
    }
  }, [lastMessage]);

  return {
    events: [...syncEvents, ...events].sort((a, b) => a.at.getTime() - b.at.getTime()).slice(-MAX_EVENTS),
    routeCounts,
    stats,
    knowledgeBases,
    activeRoute,
    remoteState,
    remoteAt,
    streaming: isLoading,
    pulse: pulseRef.current,
    uptimeSeconds: tick,
    isLoading,
  };
}
