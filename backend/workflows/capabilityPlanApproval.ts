export interface PlanStepApproval {
  stepId: string;
  approved: boolean;
  reason?: string;
}

export interface PlannedCapabilityRun {
  planId: string;
  goal: string;
  status: "draft" | "approved" | "rejected" | "executing" | "completed" | "failed";
  capabilities: string[];
  steps: Array<{
    id: string;
    capability: string;
    description: string;
    tool?: string;
    risk: "low" | "medium" | "high" | "critical";
    requiresApproval: boolean;
    approved?: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  notes?: string;
}

export class CapabilityPlanStore {
  private static store = new Map<string, PlannedCapabilityRun>();

  static create(plan: Omit<PlannedCapabilityRun, "planId" | "createdAt" | "updatedAt">): PlannedCapabilityRun {
    const planId = `plan-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const record: PlannedCapabilityRun = {
      ...plan,
      planId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    CapabilityPlanStore.store.set(planId, record);
    return record;
  }

  static get(planId: string): PlannedCapabilityRun | undefined {
    return CapabilityPlanStore.store.get(planId);
  }

  static approve(planId: string, approvedBy: string, approvals: PlanStepApproval[]): PlannedCapabilityRun | undefined {
    const current = CapabilityPlanStore.store.get(planId);
    if (!current) return undefined;

    const nextSteps = current.steps.map((step) => {
      const match = approvals.find((entry) => entry.stepId === step.id);
      return {
        ...step,
        approved: match ? match.approved : step.requiresApproval ? false : true,
      };
    });

    const updated: PlannedCapabilityRun = {
      ...current,
      status: approvals.every((entry) => entry.approved) ? "approved" : "draft",
      steps: nextSteps,
      approvedBy,
      updatedAt: new Date().toISOString(),
      notes: approvals.some((entry) => !entry.approved)
        ? "Some steps were rejected by the user."
        : "All steps approved by the user.",
    };

    CapabilityPlanStore.store.set(planId, updated);
    return updated;
  }

  static list(): PlannedCapabilityRun[] {
    return [...CapabilityPlanStore.store.values()];
  }
}
