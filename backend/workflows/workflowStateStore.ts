export interface WorkflowOutputRecord {
  capability: string;
  ok: boolean;
  output?: unknown;
  error?: string;
  stepId?: string;
  toolName?: string;
}

export interface StoredWorkflowState {
  runId: string;
  task: string;
  actorId: string;
  status: "pending" | "running" | "waiting_approval" | "completed" | "failed" | "cancelled";
  allowedCapabilities: string[];
  createdAt: string;
  updatedAt: string;
  outputs: WorkflowOutputRecord[];
  error?: string;
}

export class WorkflowStateStore {
  private static store = new Map<string, StoredWorkflowState>();

  static getInstance(): WorkflowStateStore {
    return new WorkflowStateStore();
  }

  save(state: StoredWorkflowState): StoredWorkflowState {
    WorkflowStateStore.store.set(state.runId, state);
    return state;
  }

  get(runId: string): StoredWorkflowState | undefined {
    return WorkflowStateStore.store.get(runId);
  }

  update(runId: string, patch: Partial<StoredWorkflowState>): StoredWorkflowState | undefined {
    const current = WorkflowStateStore.store.get(runId);
    if (!current) return undefined;

    const updated = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    WorkflowStateStore.store.set(runId, updated);
    return updated;
  }

  setStatus(runId: string, status: StoredWorkflowState["status"], error?: string): StoredWorkflowState | undefined {
    return this.update(runId, { status, error });
  }

  appendOutput(runId: string, output: WorkflowOutputRecord): StoredWorkflowState | undefined {
    const current = WorkflowStateStore.store.get(runId);
    if (!current) return undefined;

    const next = {
      ...current,
      outputs: [...current.outputs, output],
      updatedAt: new Date().toISOString(),
    };
    WorkflowStateStore.store.set(runId, next);
    return next;
  }

  listPending(): StoredWorkflowState[] {
    return [...WorkflowStateStore.store.values()].filter((state) =>
      state.status === "pending" || state.status === "waiting_approval" || state.status === "running",
    );
  }
}
