export interface PlanStepApproval {
  stepId: string;
  approved: boolean;
  reason?: string;
}

export interface PlannedCapabilityRun {
  planId: string;
  ownerId: string;
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
    const now = new Date().toISOString();
    const planId = `plan-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const record: PlannedCapabilityRun = {
      ...plan,
      planId,
      createdAt: now,
      updatedAt: now,
    };
    CapabilityPlanStore.store.set(planId, record);
    return record;
  }

  static get(planId: string): PlannedCapabilityRun | undefined {
    return CapabilityPlanStore.store.get(planId);
  }

  static approve(planId: string, approvedBy: string, approvals: PlanStepApproval[]): PlannedCapabilityRun | undefined {
    const current = CapabilityPlanStore.store.get(planId);
    if (!current || current.ownerId !== approvedBy) return undefined;

    const approvalByStep = new Map(approvals.map((approval) => [approval.stepId, approval]));
    const nextSteps = current.steps.map((step) => {
      const match = approvalByStep.get(step.id);
      return {
        ...step,
        approved: match?.approved ?? false,
      };
    });
    const allStepsExplicitlyApproved = nextSteps.length > 0 && nextSteps.every((step) => step.approved === true);

    const updated: PlannedCapabilityRun = {
      ...current,
      status: allStepsExplicitlyApproved ? "approved" : "draft",
      steps: nextSteps,
      approvedBy: allStepsExplicitlyApproved ? approvedBy : undefined,
      updatedAt: new Date().toISOString(),
      notes: allStepsExplicitlyApproved
        ? "All steps approved by the owner. Execution still requires an explicit execution request."
        : "Plan is not fully approved; every step must be explicitly approved.",
    };

    CapabilityPlanStore.store.set(planId, updated);
    return updated;
  }

  static list(ownerId?: string): PlannedCapabilityRun[] {
    return [...CapabilityPlanStore.store.values()].filter((plan) => !ownerId || plan.ownerId === ownerId);
  }
}
