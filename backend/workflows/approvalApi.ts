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
    if (!task) {
      return {
        ok: false,
        message: "A task description is required.",
      };
    }

    const allowed = request.capabilities && request.capabilities.length > 0
      ? (request.capabilities.filter((value) => ["development", "security", "social"].includes(value)) as string[])
      : ["development", "security", "social"];

    const plan = generatePlanForApproval(task, allowed as any);

    return {
      ok: true,
      planId: plan.planId,
      message: "Plan generated successfully. Awaiting approval before execution.",
      plan,
      status: "draft",
    };
  } catch (error) {
    return {
      ok: false,
      message: `Failed to generate approval plan: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

export async function approveGeneratedPlan(
  planId: string,
  actorId: string,
  approvals: Array<{ stepId: string; approved: boolean; reason?: string }>,
): Promise<PlanApprovalApiResponse> {
  try {
    if (!planId?.trim()) {
      return {
        ok: false,
        message: "A planId is required.",
      };
    }

    const approved = approvePlan(planId, actorId, approvals);
    const plan = getPlan(planId);

    if (!plan) {
      return {
        ok: false,
        message: "Plan not found.",
      };
    }

    return {
      ok: approved,
      planId,
      message: approved
        ? "Plan approved. The execution pipeline can proceed with the approved steps."
        : "Plan not fully approved. Some steps remain pending or rejected.",
      plan,
      status: plan.status,
    };
  } catch (error) {
    return {
      ok: false,
      message: `Failed to approve plan: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

export async function getPlanStatus(planId: string): Promise<PlanApprovalApiResponse> {
  try {
    const plan = getPlan(planId);
    if (!plan) {
      return {
        ok: false,
        message: "Plan not found.",
      };
    }

    return {
      ok: true,
      planId,
      message: "Plan status retrieved.",
      plan,
      status: plan.status,
    };
  } catch (error) {
    return {
      ok: false,
      message: `Failed to retrieve plan: ${error instanceof Error ? error.message : "unknown error"}`,
    };
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
