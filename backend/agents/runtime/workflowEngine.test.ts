import assert from "node:assert/strict";
import test from "node:test";
import { PolicyEngine } from "./policyEngine.js";
import { ToolRegistry, type ToolDefinition } from "./toolRegistry.js";
import { WorkflowEngine } from "./workflowEngine.js";
import type { Planner, WorkflowPlan } from "./types.js";

const lowTool = (execute: ToolDefinition<{ value: string }>["execute"]): ToolDefinition<{ value: string }> => ({
  name: "test.low",
  description: "test",
  risk: "low",
  requiresApproval: false,
  retryable: true,
  timeoutMs: 1000,
  validate: (input): input is { value: string } =>
    typeof input === "object" && input !== null && typeof (input as { value?: unknown }).value === "string",
  execute,
});

const plan = (toolName: string, risk: "low" | "high"): Planner => ({
  async plan(): Promise<WorkflowPlan> {
    return {
      goal: "test",
      steps: [{
        id: "step-1",
        description: "test",
        tool: { name: toolName, input: { value: "x" }, reason: "test", risk },
      }],
      risks: [],
      requiresApproval: false,
    };
  },
});

test("retries retryable tool failures and completes", async () => {
  let calls = 0;
  const registry = new ToolRegistry();
  registry.register(lowTool(async () => {
    calls += 1;
    if (calls < 3) throw new Error("transient");
    return "ok";
  }));

  const result = await new WorkflowEngine(plan("test.low", "low"), registry).run("test", {
    actorId: "test-user",
    maxRetries: 2,
  });

  assert.equal(result.status, "completed");
  assert.equal(calls, 3);
});

test("does not allow a plan to downgrade a high-risk registered tool", async () => {
  const registry = new ToolRegistry();
  const high: ToolDefinition<{ value: string }> = {
    ...lowTool(async () => "should-not-run"),
    name: "test.high",
    risk: "high",
  };
  registry.register(high);

  const result = await new WorkflowEngine(plan("test.high", "low"), registry).run("test", {
    actorId: "test-user",
  });

  assert.equal(result.status, "waiting_approval");
});

test("approved high-risk tool can execute", async () => {
  const registry = new ToolRegistry();
  const high: ToolDefinition<{ value: string }> = {
    ...lowTool(async () => "approved"),
    name: "test.high-approved",
    risk: "high",
  };
  registry.register(high);

  const approvedPlan: Planner = {
    async plan(): Promise<WorkflowPlan> {
      return {
        goal: "test",
        steps: [{
          id: "step-approval",
          description: "approval",
          requiresApproval: true,
          tool: {
            name: "test.high-approved",
            input: { value: "x" },
            reason: "explicit test",
            risk: "high",
          },
        }],
        risks: ["high"],
        requiresApproval: true,
      };
    },
  };

  const result = await new WorkflowEngine(approvedPlan, registry).run("test", {
    actorId: "test-user",
    approve: async () => true,
  });

  assert.equal(result.status, "completed");
});
