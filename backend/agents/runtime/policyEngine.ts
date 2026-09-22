import type { ExecutionContext, RiskLevel, ToolRequest } from "./types.js";

export interface PolicyDecision {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
}

const rank: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };

export class PolicyEngine {
  constructor(private readonly maximumRisk: RiskLevel = "medium") {}

  evaluate(request: ToolRequest, context: ExecutionContext): PolicyDecision {
    if (!request.reason.trim()) return { allowed: false, requiresApproval: false, reason: "A tool reason is required" };
    if (context.actorId.trim().length === 0) return { allowed: false, requiresApproval: false, reason: "An actor identity is required" };
    if (rank[request.risk] > rank[this.maximumRisk]) {
      return { allowed: false, requiresApproval: true, reason: `Risk ${request.risk} exceeds policy limit` };
    }
    return { allowed: true, requiresApproval: request.risk === "medium" };
  }
}
