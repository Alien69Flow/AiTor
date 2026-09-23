import type { RiskLevel, WorkflowPlan, WorkflowStep } from "../agents/runtime/types.js";

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

export function detectCapabilities(input: string): Capability[] {
  const text = input.toLowerCase();
  const capabilities: Capability[] = [];
  if (DEVELOPMENT_WORDS.some((word) => text.includes(word))) capabilities.push("development");
  if (SECURITY_WORDS.some((word) => text.includes(word))) capabilities.push("security");
  if (SOCIAL_WORDS.some((word) => text.includes(word))) capabilities.push("social");
  return capabilities.length ? capabilities : ["development"];
}

export function resolveCapabilities(
  task: string,
  allowed?: readonly Capability[],
): Capability[] {
  const detected = detectCapabilities(task);
  if (!allowed?.length) return detected;
  const filtered = detected.filter((capability) => allowed.includes(capability));
  return filtered.length ? filtered : [allowed[0]];
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
    risks: [] as string[],
    requiresApproval: false,
  };
}
