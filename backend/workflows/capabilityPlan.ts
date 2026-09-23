import type { WorkflowPlan, WorkflowStep } from "../agents/runtime/types.js";

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

  return capabilities.length > 0 ? capabilities : ["development"];
}

export function resolveCapabilities(task: string, allowed?: Capability[]): Capability[] {
  if (!allowed || allowed.length === 0) return detectCapabilities(task);

  const detected = detectCapabilities(task);
  const filtered = detected.filter((capability) => allowed.includes(capability));
  return filtered.length > 0 ? filtered : allowed;
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

export function detectFrequency(task: string): "daily" | "weekly" | "monthly" | "quarterly" | "yearly" {
  const input = task.toLowerCase();
  if (input.includes("weekly") || input.includes("semanal")) return "weekly";
  if (input.includes("monthly") || input.includes("mensual")) return "monthly";
  if (input.includes("quarterly") || input.includes("trimestral")) return "quarterly";
  if (input.includes("yearly") || input.includes("annual") || input.includes("anual")) return "yearly";
  return "daily";
}

export function detectPlatform(task: string): "twitter" | "linkedin" | "instagram" | "telegram" | "discord" | "farcaster" | "facebook" | "github" | "hackmd" | "dorahacks" | undefined {
  const input = task.toLowerCase();
  const platforms = [
    "twitter", "linkedin", "instagram", "telegram", "discord",
    "farcaster", "facebook", "github", "hackmd", "dorahacks",
  ] as const;
  return platforms.find((platform) => input.includes(platform));
}
