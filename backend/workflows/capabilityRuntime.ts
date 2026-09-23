import { AgenticWorkflow } from "./agenticWorkflow";
import { WorkflowEngine } from "../agents/runtime/workflowEngine";
import { ToolRegistry, type ToolDefinition } from "../agents/runtime/toolRegistry";
import { SecurityAgent } from "../agents/securityAgent";
import { SocialMediaManager, type FrequencyType, type SocialPlatform } from "../agents/socialMediaManager";
import type { Planner, WorkflowPlan, WorkflowStep } from "../agents/runtime/types";

export type Capability = "development" | "security" | "social";

const DEVELOPMENT_WORDS = [
  "code", "código", "coding", "develop", "development", "desarrollo",
  "design", "diseño", "refactor", "bug", "api", "implement", "feature",
];
const SECURITY_WORDS = [
  "security", "seguridad", "vulnerability", "vulnerabilidades",
  "audit", "auditoría", "npm audit", "defense", "defensa",
];
const SOCIAL_WORDS = [
  "social media", "redes sociales", "twitter", "linkedin", "instagram",
  "telegram", "discord", "post", "posts", "contenido social",
];

export interface CapabilityRuntimeResult {
  status: "completed" | "waiting_approval" | "failed";
  runId: string;
  outputs: Array<{ capability: Capability; ok: boolean; output?: unknown; error?: string }>;
}

export function detectCapabilities(input: string): Capability[] {
  const text = input.toLowerCase();
  const capabilities: Capability[] = [];

  if (DEVELOPMENT_WORDS.some((word) => text.includes(word))) capabilities.push("development");
  if (SECURITY_WORDS.some((word) => text.includes(word))) capabilities.push("security");
  if (SOCIAL_WORDS.some((word) => text.includes(word))) capabilities.push("social");

  return capabilities.length > 0 ? capabilities : ["development"];
}

export function buildCapabilityPlan(
  task: string,
  capabilities: Capability[] = detectCapabilities(task),
): WorkflowPlan {
  const steps: WorkflowStep[] = capabilities.map((capability) => ({
    id: `capability-${capability}`,
    description: `Execute ${capability} capability`,
    tool: {
      name: `capability.${capability}`,
      input: { task },
      reason: `User requested ${capability} automation`,
      risk: "low",
    },
  }));

  return {
    goal: task,
    steps,
    risks: [],
    requiresApproval: false,
  };
}

class CapabilityPlanner implements Planner {
  async plan(task: string): Promise<WorkflowPlan> {
    return buildCapabilityPlan(task);
  }
}

function tool(
  name: string,
  description: string,
  execute: ToolDefinition<{ task: string }>["execute"],
): ToolDefinition<{ task: string }> {
  return {
    name,
    description,
    risk: "low",
    requiresApproval: false,
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
    tool("capability.development", "Plan and execute a controlled development workflow.", async ({ task }) => {
      return AgenticWorkflow.run(task, { history, maxRetries: 2 });
    }),
  );

  registry.register(
    tool("capability.security", "Run a read-only repository security audit.", async ({ task }) => {
      const full = /full|complete|completo|completa/i.test(task);
      const report = full
        ? await SecurityAgent.fullScan()
        : await SecurityAgent.quickScan();

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

      return {
        summary: result.summary,
        proposalIds: result.proposals.map((proposal) => proposal.id),
        requiresApproval: true,
      };
    }),
  );

  return registry;
}

export async function runCapabilityRuntime(
  task: string,
  actorId: string,
  history = "",
): Promise<CapabilityRuntimeResult> {
  const engine = new WorkflowEngine(new CapabilityPlanner(), createRegistry(history));

  const result = await engine.run(task, {
    actorId,
    maxSteps: 3,
  });

  const capabilities = detectCapabilities(task);

  return {
    status: result.status,
    runId: result.runId,
    outputs: result.outputs.map((output, index) => ({
      capability: capabilities[index] ?? "development",
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
