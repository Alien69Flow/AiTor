import { ManusAgent } from "../agents/manus.js";
import { AccioAgent } from "../agents/accio.js";
import { WorkflowEngine } from "../agents/runtime/workflowEngine.js";
import { ToolRegistry, type ToolDefinition } from "../agents/runtime/toolRegistry.js";
import { SecurityAgent } from "../agents/securityAgent.js";
import { SocialMediaManager, type FrequencyType, type SocialPlatform } from "../agents/socialMediaManager.js";
import type { Planner, WorkflowPlan } from "../agents/runtime/types.js";
import {
  buildCapabilityPlan,
  detectCapabilities,
  resolveCapabilities,
  type Capability,
} from "./capabilityPlan.js";

export { buildCapabilityPlan, detectCapabilities, resolveCapabilities };
export type { Capability };

export interface CapabilityRuntimeResult {
  status: "completed" | "waiting_approval" | "failed" | "cancelled";
  runId: string;
  outputs: Array<{ capability: Capability; ok: boolean; output?: unknown; error?: string }>;
}

class CapabilityPlanner implements Planner {
  constructor(private readonly allowed?: readonly Capability[]) {}

  async plan(task: string): Promise<WorkflowPlan> {
    return buildCapabilityPlan(task, resolveCapabilities(task, this.allowed));
  }
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

function isAgentFailure(output: string): boolean {
  const text = output.trim().toLowerCase();
  return text.length < 20 ||
    text.includes("error del sistema") ||
    text.includes("fallo crítico") ||
    text.includes("could not process") ||
    text.includes("no pudo procesar") ||
    text.includes("no pudo recuperar");
}

async function runDevelopmentAgent(task: string, history: string): Promise<{
  success: boolean;
  agent: "manus" | "accio";
  output: string;
}> {
  const manus = await ManusAgent.executeTask(task, history);
  if (!isAgentFailure(manus)) return { success: true, agent: "manus", output: manus };

  const accio = await AccioAgent.research(task, history);
  if (!isAgentFailure(accio)) return { success: true, agent: "accio", output: accio };

  return {
    success: false,
    agent: "manus",
    output: "Development agents did not produce a usable result.",
  };
}

function createRegistry(history: string): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register(
    tool("capability.development", "Run the existing Manus/Accio development agents through the controlled runtime.",
      async ({ task }) => {
        const result = await runDevelopmentAgent(task, history);
        if (!result.success) throw new Error(result.output);
        return result;
      }),
  );

  registry.register(
    tool("capability.security", "Run a repository security audit through SecurityAgent.",
      async ({ task }) => {
        const full = /full|complete|completo|completa/i.test(task);
        const report = full ? await SecurityAgent.fullScan() : await SecurityAgent.quickScan();
        return SecurityAgent.formatReport(report);
      }),
  );

  registry.register(
    tool("capability.social", "Generate social content and queue it for human approval.",
      async ({ task }) => {
        const result = await SocialMediaManager.generateContent(detectFrequency(task), {
          platform: detectPlatform(task),
          tone: "technical",
          customContext: history,
        });
        if (!result.proposals.length && result.summary.toLowerCase().startsWith("error")) {
          throw new Error(result.summary);
        }
        return {
          summary: result.summary,
          proposalIds: result.proposals.map((proposal) => proposal.id),
          requiresApproval: true,
        };
      },
      false,
    ),
  );

  return registry;
}

export async function runCapabilityRuntime(
  task: string,
  actorId: string,
  history = "",
  allowedCapabilities?: readonly Capability[],
): Promise<CapabilityRuntimeResult> {
  const engine = new WorkflowEngine(
    new CapabilityPlanner(allowedCapabilities),
    createRegistry(history),
  );

  const result = await engine.run(task, {
    actorId,
    maxSteps: 3,
    maxRetries: 2,
    audit: async (event) => {
      console.log(
        `[CapabilityRuntime] ${event.type} run=${event.runId} actor=${event.actorId}`,
        event.data,
      );
    },
  });

  const capabilities = resolveCapabilities(task, allowedCapabilities);

  return {
    status: result.status,
    runId: result.runId,
    outputs: result.outputs.map((output, index) => ({
      capability: capabilities[index] ?? capabilities[0] ?? "development",
      ok: output.ok,
      output: output.output,
      error: output.error,
    })),
  };
}

function detectFrequency(task: string): FrequencyType {
  const input = task.toLowerCase();
  if (input.includes("weekly") || input.includes("semanal")) return "weekly";
  if (input.includes("monthly") || input.includes("mensual")) return "monthly";
  if (input.includes("quarterly") || input.includes("trimestral")) return "quarterly";
  if (input.includes("yearly") || input.includes("annual") || input.includes("anual")) return "yearly";
  return "daily";
}

function detectPlatform(task: string): SocialPlatform | undefined {
  const input = task.toLowerCase();
  const platforms: SocialPlatform[] = [
    "twitter", "linkedin", "instagram", "telegram", "discord",
    "farcaster", "facebook", "github", "hackmd", "dorahacks",
  ];
  return platforms.find((platform) => input.includes(platform));
}
