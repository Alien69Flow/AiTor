import { randomUUID } from "node:crypto";
import { generatePlanForApproval, approvePlan, getPlan } from "../workflows/planApprovalFlow.js";

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
    if (!task) return { ok: false, message: "A task description is required." };

    const allowed = request.capabilities && request.capabilities.length > 0
      ? request.capabilities.filter((value): value is "development" | "security" | "social" =>
        value === "development" || value === "security" || value === "social")
      : ["development", "security", "social"] as const;

    if (allowed.length === 0) {
      return { ok: false, message: "At least one valid capability is required." };
    }

    const plan = generatePlanForApproval(task, [...new Set(allowed)]);
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

    const current = getPlan(planId);
    if (!current) return { ok: false, message: "Plan not found." };
    if (current.approvedBy && current.approvedBy !== actorId) return { ok: false, message: "Plan belongs to another user." };

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

export async function getPlanStatus(planId: string): Promise<PlanApprovalApiResponse> {
  try {
    if (!planId?.trim()) return { ok: false, message: "A planId is required." };
    const plan = getPlan(planId);
    if (!plan) return { ok: false, message: "Plan not found." };
    return { ok: true, planId, message: "Plan status retrieved.", plan, status: plan.status };
  } catch (error) {
    return { ok: false, message: `Failed to retrieve plan: ${error instanceof Error ? error.message : "unknown error"}` };
  }
}

export function generateBotApprovalWorkflow(task: string) {
  return {
    planId: randomUUID(),
    task,
    generatedAt: new Date().toISOString(),
    requiresApproval: true,
    workflow: "plan-approval",
  };
}
