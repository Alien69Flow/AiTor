import { createHash } from "node:crypto";
import type { ExecutionContext, RiskLevel, ToolRequest, ToolResult } from "./types.js";

export interface ToolDefinition<TInput = unknown> {
  readonly name: string;
  readonly description: string;
  readonly risk: RiskLevel;
  readonly requiresApproval: boolean;
  readonly timeoutMs: number;
  readonly validate: (input: unknown) => input is TInput;
  readonly execute: (input: TInput, context: ExecutionContext) => Promise<unknown>;
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();
  private readonly completed = new Map<string, ToolResult>();

  register<TInput>(tool: ToolDefinition<TInput>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    if (tool.timeoutMs <= 0 || tool.timeoutMs > 300_000) {
      throw new Error(`Invalid timeout for tool: ${tool.name}`);
    }
    this.tools.set(tool.name, tool as ToolDefinition);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  describe(): Array<Pick<ToolDefinition, "name" | "description" | "risk" | "requiresApproval">> {
    return [...this.tools.values()].map(({ name, description, risk, requiresApproval }) => ({
      name,
      description,
      risk,
      requiresApproval,
    }));
  }

  async execute(request: ToolRequest, context: ExecutionContext): Promise<ToolResult> {
    const tool = this.tools.get(request.name);
    if (!tool) return { ok: false, error: `Unknown tool: ${request.name}` };
    if (!tool.validate(request.input)) return { ok: false, error: `Invalid input for tool: ${request.name}` };
    if (tool.requiresApproval || request.risk === "high" || request.risk === "critical") {
      return { ok: false, error: `Approval required for tool: ${request.name}`, retryable: false };
    }

    const key = request.idempotencyKey ?? this.makeKey(context.runId, request);
    const previous = this.completed.get(key);
    if (previous) return previous;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), tool.timeoutMs);
    try {
      const result = await Promise.race([
        tool.execute(request.input, { ...context, signal: controller.signal }),
        new Promise<never>((_, reject) =>
          controller.signal.addEventListener("abort", () => reject(new Error("Tool timed out")), { once: true }),
        ),
      ]);
      const completed: ToolResult = { ok: true, output: result };
      this.completed.set(key, completed);
      return completed;
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Tool failed", retryable: true };
    } finally {
      clearTimeout(timer);
    }
  }

  private makeKey(runId: string, request: ToolRequest): string {
    return createHash("sha256")
      .update(`${runId}:${request.name}:${JSON.stringify(request.input)}`)
      .digest("hex");
  }
}
