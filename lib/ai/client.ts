import "server-only";

export const AVAILABLE_MODELS = (process.env.FPT_AI_MODEL ?? "")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

if (AVAILABLE_MODELS.length === 0) {
  throw new Error("FPT_AI_MODEL must configure at least one model");
}

export const DEFAULT_MODEL = AVAILABLE_MODELS[0]!;

export function resolveAIModel(model: string | null | undefined) {
  return model && AVAILABLE_MODELS.includes(model) ? model : DEFAULT_MODEL;
}
