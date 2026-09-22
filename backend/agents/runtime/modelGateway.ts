import type { WorkflowPlan } from "./types.js";

export interface ModelGateway {
  complete(input: { system: string; prompt: string; signal?: AbortSignal }): Promise<string>;
}

export interface Planner {
  plan(task: string, context: Record<string, unknown>): Promise<WorkflowPlan>;
}

/** A model-independent planner. LLMs can implement Planner without being coupled to the runtime. */
export class DeclarativePlanner implements Planner {
  constructor(private readonly buildPlan: (task: string, context: Record<string, unknown>) => Promise<WorkflowPlan>) {}

  plan(task: string, context: Record<string, unknown>): Promise<WorkflowPlan> {
    return this.buildPlan(task, context);
  }
}
