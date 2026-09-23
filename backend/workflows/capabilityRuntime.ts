import { ManusAgent } from "../agents/manus.js";
import { AccioAgent } from "../agents/accio.js";
import { WorkflowEngine } from "../agents/runtime/workflowEngine.js";
import { ToolRegistry, type ToolDefinition } from "../agents/runtime/toolRegistry.js";
import { SecurityAgent } from "../agents/securityAgent.js";
import { SocialMediaManager } from "../agents/socialMediaManager.js";
import type { Planner, WorkflowPlan } from "../agents/runtime/types.js";
import {
  buildCapabilityPlan,
  resolveCapabilities,
  detectFrequency,
  detectPlatform,
  type Capability,
} from "./capabilityPlan.js";
import { WorkflowStateStore } from "./workflowStateStore.js";

export { buildCapabilityPlan, detectCapabilities, resolveCapabilities, detectFrequency, detectPlatform } from "./capabilityPlan.js";
export type { Capability } from "./capabilityPlan.js";

export interface CapabilityRuntimeResult {
  status: "completed" | "waiting_approval" | "failed" | "cancelled";
  runId: string;
  outputs: Array<{ capability: Capability; ok: boolean; output?: unknown; error?: string }>;
}

class CapabilityPlanner implements Planner {
  constructor(private readonly allowed?: Capability[]) {}

  async plan(task: string): Promise<WorkflowPlan> {
    return buildCapabilityPlan(task, resolveCapabilities(task, this.allowed));
  }
}

function validateStructuredOutput(output: string): { ok: boolean; reason?: string } {
  const normalized = output.trim();
  if (!normalized || normalized.length < 32) {
    return { ok: false, reason: "output is too short" };
  }

  const lower = normalized.toLowerCase();
  const forbidden = [
    "error del sistema",
    "failed to process",
    "unable to process",
    "no pudo procesar",
    "fallo crítico",
    "internal error",
    "system error",
  ];

  if (forbidden.some((token) => lower.includes(token))) {
    return { ok: false, reason: `contains forbidden phrase: ${token}` };
  }

  const requiredSignals = [
    "plan",
    "pasos",
    "step",
    "summary",
    "resultado",
    "acción",
    "objective",
    "objetivo",
    "deliverable",
    "entregable",
  ];

  const signalCount = requiredSignals.filter((signal) => lower.includes(signal)).length;
  const hasStructure = /(?:^|\n)(?:#{1,3}\s*|[-*]\s*|\d+\.?\s+|\*\*|\w+\s*:\s*)/.test(normalized);

  if (signalCount >= 2 || hasStructure) {
    return { ok: true };
  }

  return { ok: false, reason: "output does not have enough structure" };
}

function tool(
  name: string,
  description: string,
  execute: ToolDefinition<{ task: string }>["execute"],
  retryable = true,
): ToolDefinition<{ task: string }> {
  return {
    name,
    description,
    risk: "low",
    requiresApproval: false,
    retryable,
    timeoutMs: 120_000,
    validate: (input): input is { task: string } =>
      typeof input === "object" &&
      input !== null &&
      typeof (input as { task?: unknown }).task === "string",
    execute,
  };
}

function createRegistry(history: string): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register(
    tool("capability.development", "Run the controlled technical development agent.", async ({ task }) => {
      const result = await runDevelopmentAgent(task, history);
      if (!result.success) {
        throw new Error("Development agents did not produce a verified result.");
      }
      return result;
    }),
  );

  registry.register(
    tool("capability.security", "Run a read-only repository security audit.", async ({ task }) => {
      const full = /full|complete|completo|completa/i.test(task);
      const report = full ? await SecurityAgent.fullScan() : await SecurityAgent.quickScan();
      return SecurityAgent.formatReport(report);
    }),
  );

  registry.register(
    tool("capability.social", "Generate social content and place it in the approval queue.", async ({ task }) => {
      const frequency = detectFrequency(task);
      const platform = detectPlatform(task);
      const result = await SocialMediaManager.generateContent(frequency, {
        platform,
        tone: "technical",
        customContext: history,
      });
      if (result.proposals.length === 0 && result.summary.toLowerCase().startsWith("error")) {
        throw new Error(result.summary);
      }

      return {
        summary: result.summary,
        proposalIds: result.proposals.map((proposal) => proposal.id),
        requiresApproval: true,
      };
    }, false),
  );

  return registry;
}

export async function runCapabilityRuntime(
  task: string,
  actorId: string,
  history = "",
  allowedCapabilities?: Capability[],
): Promise<CapabilityRuntimeResult> {
  if (process.env.AGENTIC_RUNTIME_ENABLED !== "true" && process.env.AGENTIC_RUNTIME_ENABLED !== "1") {
    return {
      status: "cancelled",
      runId: "disabled",
      outputs: [],
    };
  }

  const runId = `capability-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const store = WorkflowStateStore.getInstance();
  store.save({
    runId,
    task,
    actorId,
    status: "running",
    allowedCapabilities: allowedCapabilities ?? [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    outputs: [],
  });

  const engine = new WorkflowEngine(new CapabilityPlanner(allowedCapabilities), createRegistry(history));

  const result = await engine.run(task, {
    actorId,
    maxSteps: 3,
    maxRetries: 2,
    audit: async (event) => {
      console.log(`[CapabilityRuntime] ${event.type} run=${event.runId} actor=${event.actorId}`, event.data);
    },
  });

  const capabilities = resolveCapabilities(task, allowedCapabilities);
  const outputs = result.outputs.map((output, index) => ({
    capability: capabilities[index] ?? allowedCapabilities?.[0] ?? "development",
    ok: output.ok,
    output: output.output,
    error: output.error,
  }));

  store.update(runId, {
    status: result.status,
    outputs,
    error: result.error,
    updatedAt: new Date().toISOString(),
  });

  return {
    status: result.status,
    runId: result.runId,
    outputs,
  };
}

async function runDevelopmentAgent(task: string, history: string): Promise<{
  success: boolean;
  agent: "manus" | "accio";
  output: string;
  verified: boolean;
}> {
  try {
    const manusOutput = await ManusAgent.executeTask(task, history || "No previous context");
    const validation = validateStructuredOutput(manusOutput);
    if (validation.ok) {
      return {
        success: true,
        agent: "manus",
        output: manusOutput,
        verified: true,
      };
    }
    console.warn("[CapabilityRuntime] Manus output rejected:", validation.reason);
  } catch (error) {
    console.warn("[CapabilityRuntime] Manus execution failed; falling back to Accio.", error);
  }

  try {
    const accioOutput = await AccioAgent.research(task, history);
    const validation = validateStructuredOutput(accioOutput);

    return {
      success: validation.ok,
      agent: "accio",
      output: accioOutput,
      verified: validation.ok,
    };
  } catch (error) {
    return {
      success: false,
      agent: "accio",
      output: "Development agents failed to produce a verified result.",
      verified: false,
    };
  }
}
