import { generatePlanForApproval, approvePlan, getPlan } from "./planApprovalFlow.js";

export interface ApprovalRequest {
  task: string;
  capabilities?: string[];
  actorId?: string;
}

export interface PlanApprovalApiResponse {
  ok: boolean;
  planId?: string;
  message: string;
  plan?: unknown;
  status?: string;
}

export async function createPlanForApproval(request: ApprovalRequest): Promise<PlanApprovalApiResponse> {
  try {
    const task = request.task?.trim();
    const actorId = request.actorId?.trim();
    if (!task) return { ok: false, message: "A task description is required." };
    if (!actorId) return { ok: false, message: "An authenticated actorId is required." };

    const allowed = request.capabilities && request.capabilities.length > 0
      ? request.capabilities.filter((value): value is "development" | "security" | "social" =>
        value === "development" || value === "security" || value === "social")
      : ["development", "security", "social"] as const;

    if (allowed.length === 0) return { ok: false, message: "At least one valid capability is required." };

    const plan = generatePlanForApproval(task, actorId, [...new Set(allowed)]);
    return {
      ok: true,
      planId: plan.planId,
      message: "Plan generated successfully. Awaiting approval before execution.",
      plan,
      status: "draft",
    };
  } catch (error) {
    return { ok: false, message: `Failed to generate approval plan: ${error instanceof Error ? error.message : "unknown error"}` };
  }
}

export async function approveGeneratedPlan(
  planId: string,
  actorId: string,
  approvals: Array<{ stepId: string; approved: boolean; reason?: string }>,
): Promise<PlanApprovalApiResponse> {
  try {
    if (!planId?.trim() || !actorId?.trim()) return { ok: false, message: "planId and actorId are required." };
    if (!Array.isArray(approvals) || approvals.length === 0) return { ok: false, message: "At least one step approval is required." };

    const current = getPlan(planId);
    if (!current) return { ok: false, message: "Plan not found." };
    if (current.ownerId !== actorId) return { ok: false, message: "Plan belongs to another user." };

    const validStepIds = new Set(current.steps.map((step) => step.id));
    if (approvals.some((approval) => !validStepIds.has(approval.stepId))) {
      return { ok: false, message: "Approval contains an unknown stepId." };
    }

    const approved = approvePlan(planId, actorId, approvals);
    const plan = getPlan(planId);
    if (!plan) return { ok: false, message: "Plan not found." };

    return {
      ok: approved,
      planId,
      message: approved ? "Plan approved. Execution remains an explicit next step." : "Plan not fully approved. Some steps remain pending or rejected.",
      plan,
      status: plan.status,
    };
  } catch (error) {
    return { ok: false, message: `Failed to approve plan: ${error instanceof Error ? error.message : "unknown error"}` };
  }
}

export async function getPlanStatus(planId: string, actorId?: string): Promise<PlanApprovalApiResponse> {
  try {
    if (!planId?.trim()) return { ok: false, message: "A planId is required." };
    const plan = getPlan(planId);
    if (!plan) return { ok: false, message: "Plan not found." };
    if (actorId && plan.ownerId !== actorId) return { ok: false, message: "Plan belongs to another user." };
    return { ok: true, planId, message: "Plan status retrieved.", plan, status: plan.status };
  } catch (error) {
    return { ok: false, message: `Failed to retrieve plan: ${error instanceof Error ? error.message : "unknown error"}` };
  }
}
