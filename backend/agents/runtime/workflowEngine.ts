import { randomUUID } from "node:crypto";
import type {
  AuditSink,
  ExecutionContext,
  Planner,
  ToolResult,
  WorkflowPlan,
  WorkflowRunResult,
} from "./types.js";
import { PolicyEngine } from "./policyEngine.js";
import { ToolRegistry } from "./toolRegistry.js";

export interface WorkflowOptions {
  readonly actorId: string;
  readonly maxSteps?: number;
  readonly maxRetries?: number;
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
      metadata: { approvedTools: new Set<string>() },
    };
    const outputs: ToolResult[] = [];
    const maxSteps = Math.max(1, Math.min(options.maxSteps ?? 20, 100));
    const maxRetries = Math.max(0, Math.min(options.maxRetries ?? 2, 5));

    try {
      const plan = await this.planner.plan(task, context.metadata);
      await this.audit(options, {
        runId, actorId: options.actorId, type: "plan", timestamp: new Date(), data: { plan },
      });

      if (plan.steps.length > maxSteps) {
        return this.failed(runId, outputs, "Plan exceeds the step limit", options);
      }

      for (const step of plan.steps) {
        if (step.requiresApproval) {
          const approved = await this.requestApproval(step, options, context);
          if (!approved) {
            return { runId, status: "waiting_approval", completedSteps: outputs.length, outputs };
          }
        }

        if (!step.tool) continue;

        const definition = this.tools.get(step.tool.name);
        if (!definition) {
          return this.failed(runId, outputs, `Unknown tool: ${step.tool.name}`, options);
        }

        const effectiveRisk =
          riskRank[definition.risk] > riskRank[step.tool.risk]
            ? definition.risk
            : step.tool.risk;

        const request = { ...step.tool, risk: effectiveRisk };
        let result: ToolResult = { ok: false, error: "Tool did not execute", retryable: false };

        for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
          const decision = this.policy.evaluate(request, context);
          if (!decision.allowed) {
            if (decision.requiresApproval) {
              const approved = await this.requestApproval(step, options, context);
              if (!approved) {
                return {
                  runId,
                  status: "waiting_approval",
                  completedSteps: outputs.length,
                  outputs,
                  error: decision.reason,
                };
              }
              continue;
            }
            return this.failed(runId, outputs, decision.reason ?? "Policy denied tool", options);
          }

          await this.audit(options, {
            runId,
            actorId: options.actorId,
            type: "tool_requested",
            timestamp: new Date(),
            data: { stepId: step.id, tool: request.name, attempt: attempt + 1 },
          });

          result = await this.tools.execute(request, context);
          await this.audit(options, {
            runId,
            actorId: options.actorId,
            type: "tool_completed",
            timestamp: new Date(),
            data: { stepId: step.id, ok: result.ok, attempt: attempt + 1 },
          });

          if (result.ok) break;
          if (!result.retryable || attempt === maxRetries) break;

          await this.audit(options, {
            runId,
            actorId: options.actorId,
            type: "tool_retry",
            timestamp: new Date(),
            data: { stepId: step.id, tool: request.name, nextAttempt: attempt + 2, error: result.error },
          });
        }

        outputs.push(result);
        if (!result.ok) {
          return this.failed(runId, outputs, result.error ?? "Tool failed", options);
        }
      }

      return { runId, status: "completed", completedSteps: outputs.length, outputs };
    } catch (error) {
      return this.failed(runId, outputs, error instanceof Error ? error.message : "Workflow failed", options);
    }
  }

  private async requestApproval(
    step: WorkflowPlan["steps"][number],
    options: WorkflowOptions,
    context: ExecutionContext,
  ): Promise<boolean> {
    const approved = options.approve ? await options.approve(step) : false;
    await this.audit(options, {
      runId: context.runId,
      actorId: context.actorId,
      type: "approval_required",
      timestamp: new Date(),
      data: { stepId: step.id, approved },
    });
    if (approved && step.tool) {
      const approvedTools = context.metadata.approvedTools;
      if (approvedTools instanceof Set) approvedTools.add(step.tool.name);
    }
    return approved;
  }

  private async failed(
    runId: string,
    outputs: ToolResult[],
    error: string,
    options: WorkflowOptions,
  ): Promise<WorkflowRunResult> {
    await this.audit(options, {
      runId, actorId: options.actorId, type: "workflow_failed", timestamp: new Date(), data: { error },
    });
    return { runId, status: "failed", completedSteps: outputs.length, outputs, error };
  }

  private async audit(options: WorkflowOptions, event: Parameters<AuditSink>[0]): Promise<void> {
    await options.audit?.(event);
  }
}

const riskRank: Record<"low" | "medium" | "high" | "critical", number> = {
  low: 0, medium: 1, high: 2, critical: 3,
};
