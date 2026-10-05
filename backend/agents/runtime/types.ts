export type AgentRole =
  | "supervisor"
  | "planner"
  | "executor"
  | "verifier"
  | "research"
  | "security"
  | "social";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface ExecutionContext {
  readonly runId: string;
  readonly actorId: string;
  readonly role: AgentRole;
  readonly task: string;
  readonly startedAt: Date;
  readonly metadata: Record<string, unknown>;
  readonly signal?: AbortSignal;
}

export interface ToolRequest {
  readonly name: string;
  readonly input: unknown;
  readonly reason: string;
  readonly risk: RiskLevel;
  readonly idempotencyKey?: string;
}

export interface ToolResult {
  readonly ok: boolean;
  readonly output?: unknown;
  readonly error?: string;
  readonly retryable?: boolean;
}

export interface WorkflowStep {
  readonly id: string;
  readonly description: string;
  readonly tool?: ToolRequest;
  readonly requiresApproval?: boolean;
}

export interface WorkflowPlan {
  readonly goal: string;
  readonly steps: WorkflowStep[];
  readonly risks: string[];
  readonly requiresApproval: boolean;
}

export interface Planner {
  plan(task: string, metadata?: Record<string, unknown>): Promise<WorkflowPlan>;
}

export interface WorkflowRunResult {
  readonly runId: string;
  readonly status: "completed" | "waiting_approval" | "failed" | "cancelled";
  readonly completedSteps: number;
  readonly outputs: ToolResult[];
  readonly error?: string;
}

export interface AuditEvent {
  readonly runId: string;
  readonly actorId: string;
  readonly type:
    | "plan"
    | "tool_requested"
    | "tool_retry"
    | "tool_completed"
    | "approval_required"
    | "workflow_failed";
  readonly timestamp: Date;
  readonly data: Record<string, unknown>;
}

export type AuditSink = (event: AuditEvent) => void | Promise<void>;
