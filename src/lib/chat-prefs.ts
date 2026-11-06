import { AI_MODELS, DEFAULT_MODEL } from "./ai-models";

/**
 * The chat surface is reachable from every tab (Agents and the floating dock),
 * so the chosen oracle is stored in one place instead of per component.
 */
const MODEL_KEY = "aitor_model";

/** The three views the Agents workspace can show. */
export type ChatWorkspace = "chat" | "neural" | "city";

export function readPreferredModel(): string {
  try {
    const stored = localStorage.getItem(MODEL_KEY);
    if (stored && AI_MODELS.some((model) => model.id === stored && model.available)) {
      return stored;
    }
  } catch {
    // localStorage unavailable (private mode) — fall through to the default.
  }
  return DEFAULT_MODEL;
}

export function writePreferredModel(modelId: string) {
  try {
    localStorage.setItem(MODEL_KEY, modelId);
  } catch {
    // Ignore: preference is a nicety, not a requirement.
  }
}
