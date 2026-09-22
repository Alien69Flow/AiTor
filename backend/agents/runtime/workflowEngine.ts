import { randomUUID } from "node:crypto";
import type { AuditSink, ExecutionContext, Planner, ToolResult, WorkflowPlan, WorkflowRunResult } from "./types.js";
import { PolicyEngine } from "./policyEngine.js";
import { ToolRegistry } from "./toolRegistry.js";

export interface WorkflowOptions {
  readonly actorId: string;
  readonly maxSteps?: number;
  readonly approve?: (step: WorkflowPlan["steps"][number]) => Promise<boolean>;
  readonly audit?: AuditSink;
}

export class WorkflowEngine {
  constructor(
    private readonly planner: Planner,
    private readonly tools: ToolRegistry,
    private readonly policy = new PolicyEngine(),
  ) {}

  async run(task: string, options: WorkflowOptions): Promise<WorkflowRunResult> {
    const runId = randomUUID();
    const context: ExecutionContext = {
      runId,
      actorId: options.actorId,
      role: "executor",
      task,
      startedAt: new Date(),
      metadata: {},
    };
    const outputs: ToolResult[] = [];
    const maxSteps = Math.max(1, Math.min(options.maxSteps ?? 20, 100));

    try {
      const plan = await this.planner.plan(task, context.metadata);
      await this.audit(options, { runId, actorId: options.actorId, type: "plan", timestamp: new Date(), data: { plan } });
      if (plan.steps.length > maxSteps) return this.failed(runId, outputs, "Plan exceeds the step limit", options);

      for (const step of plan.steps) {
        if (step.requiresApproval) {
          const approved = options.approve ? await options.approve(step) : false;
          await this.audit(options, { runId, actorId: options.actorId, type: "approval_required", timestamp: new Date(), data: { stepId: step.id, approved } });
          if (!approved) return { runId, status: "waiting_approval", completedSteps: outputs.length, outputs };
        }
        if (!step.tool) continue;
        const decision = this.policy.evaluate(step.tool, context);
        if (!decision.allowed) {
          if (decision.requiresApproval) return { runId, status: "waiting_approval", completedSteps: outputs.length, outputs, error: decision.reason };
          return this.failed(runId, outputs, decision.reason ?? "Policy denied tool", options);
        }
        await this.audit(options, { runId, actorId: options.actorId, type: "tool_requested", timestamp: new Date(), data: { stepId: step.id, tool: step.tool.name } });
        const result = await this.tools.execute(step.tool, context);
        outputs.push(result);
        await this.audit(options, { runId, actorId: options.actorId, type: "tool_completed", timestamp: new Date(), data: { stepId: step.id, ok: result.ok } });
        if (!result.ok && !result.retryable) return this.failed(runId, outputs, result.error ?? "Tool failed", options);
      }
      return { runId, status: "completed", completedSteps: outputs.length, outputs };
    } catch (error) {
      return this.failed(runId, outputs, error instanceof Error ? error.message : "Workflow failed", options);
    }
  }

  private async failed(runId: string, outputs: ToolResult[], error: string, options: WorkflowOptions): Promise<WorkflowRunResult> {
    await this.audit(options, { runId, actorId: options.actorId, type: "workflow_failed", timestamp: new Date(), data: { error } });
    return { runId, status: "failed", completedSteps: outputs.length, outputs, error };
  }

  private async audit(options: WorkflowOptions, event: Parameters<AuditSink>[0]): Promise<void> {
    await options.audit?.(event);
  }
}
