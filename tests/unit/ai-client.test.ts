import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("AI model configuration", () => {
  it("uses the first configured model as the default", async () => {
    vi.stubEnv(
      "FPT_AI_MODEL",
      "DeepSeek-V4-Flash,Qwen3.6-27B,SaoLa3.1-medium",
    );

    const { AVAILABLE_MODELS, DEFAULT_MODEL } = await import("@/lib/ai/client");

    expect(DEFAULT_MODEL).toBe("DeepSeek-V4-Flash");
    expect(AVAILABLE_MODELS).toEqual([
      "DeepSeek-V4-Flash",
      "Qwen3.6-27B",
      "SaoLa3.1-medium",
    ]);
  });

  it("requires model configuration instead of hard-coding a fallback", async () => {
    vi.stubEnv("FPT_AI_MODEL", "");

    await expect(import("@/lib/ai/client")).rejects.toThrow(
      "FPT_AI_MODEL must configure at least one model",
    );
  });

  it("falls back to the first configured model for an unknown selection", async () => {
    vi.stubEnv("FPT_AI_MODEL", "DeepSeek-V4-Flash,SaoLa3.1-medium");

    const { AVAILABLE_MODELS, DEFAULT_MODEL, resolveAIModel } = await import(
      "@/lib/ai/client"
    );

    expect(DEFAULT_MODEL).toBe("DeepSeek-V4-Flash");
    expect(AVAILABLE_MODELS).toEqual([
      "DeepSeek-V4-Flash",
      "SaoLa3.1-medium",
    ]);
    expect(resolveAIModel("unknown-model")).toBe("DeepSeek-V4-Flash");
  });
});
