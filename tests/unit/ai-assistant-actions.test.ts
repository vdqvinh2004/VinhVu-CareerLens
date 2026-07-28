import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSessionAction,
  deleteSessionAction,
  getAvailableModelsAction,
  getSessionsAction,
  loadMessagesAction,
} from "@/app/(app)/dashboard/ai-assistant/actions";
import { PERMISSIONS } from "@/lib/auth/permissions";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  getTranslations: vi.fn(),
  loadMessages: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock("@/lib/auth/dal", () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({ insert: mocks.insert }),
}));

vi.mock("@/lib/ai", () => ({
  AVAILABLE_MODELS: ["allowed-model"],
}));

vi.mock("@/lib/ai/agent/lifecycle", () => ({
  createAgentLifecycleRepository: () => ({ loadMessages: mocks.loadMessages }),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: mocks.getTranslations,
}));

describe("AI assistant session actions", () => {
  beforeEach(() => {
    mocks.insert.mockReset();
    mocks.getTranslations.mockReset();
    mocks.loadMessages.mockReset();
    mocks.requirePermission.mockReset();
    mocks.requirePermission.mockResolvedValue({
      actor: { kind: "user", userId: "user-1" },
    });
  });

  it("requires dashboard access at every server-action boundary", async () => {
    const denied = new Error("Permission denied");
    mocks.requirePermission.mockRejectedValue(denied);

    await expect(getAvailableModelsAction()).rejects.toBe(denied);
    await expect(getSessionsAction()).rejects.toBe(denied);
    await expect(createSessionAction("allowed-model")).rejects.toBe(denied);
    await expect(loadMessagesAction("session-1")).rejects.toBe(denied);
    await expect(deleteSessionAction("session-1")).rejects.toBe(denied);

    expect(mocks.requirePermission).toHaveBeenCalledTimes(5);
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      PERMISSIONS.DASHBOARD_ACCESS,
    );
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.loadMessages).not.toHaveBeenCalled();
  });

  it("rejects non-user actors after permission authorization", async () => {
    mocks.requirePermission.mockResolvedValue({
      actor: { kind: "builtin-superadmin", subject: "builtin:superadmin" },
    });

    await expect(getAvailableModelsAction()).rejects.toThrow("Forbidden");
    await expect(getSessionsAction()).rejects.toThrow("Forbidden");
    await expect(createSessionAction("allowed-model")).rejects.toThrow("Forbidden");
    await expect(loadMessagesAction("session-1")).rejects.toThrow("Forbidden");
    await expect(deleteSessionAction("session-1")).rejects.toThrow("Forbidden");

    expect(mocks.requirePermission).toHaveBeenCalledTimes(5);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.loadMessages).not.toHaveBeenCalled();
  });

  it("rejects a model outside the server allowlist before writing", async () => {
    await expect(createSessionAction("untrusted-model")).rejects.toThrow(
      "Unsupported AI model",
    );

    expect(mocks.getTranslations).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("loads messages through the ownership-scoped lifecycle repository", async () => {
    mocks.loadMessages.mockResolvedValue([]);

    await expect(loadMessagesAction("session-1")).resolves.toEqual([]);

    expect(mocks.loadMessages).toHaveBeenCalledWith("user-1", "session-1");
  });

  it("returns public assistant run metadata needed for persisted reconciliation", async () => {
    const now = new Date("2026-07-19T10:00:00.000Z");
    mocks.loadMessages.mockResolvedValue([{
      id: "assistant-1",
      sessionId: "session-1",
      role: "assistant",
      content: "",
      model: "allowed-model",
      status: "failed",
      dataClasses: ["public"],
      clientRequestId: null,
      createdAt: now,
      run: {
        id: "run-1",
        userId: "user-1",
        sessionId: "session-1",
        clientRequestId: "request-1",
        model: "allowed-model",
        forceWeb: true,
        status: "failed",
        userMessageId: "user-1",
        assistantMessageId: "assistant-1",
        errorCode: "force_web_unavailable",
        errorMessage: "Sanitized message",
        usage: null,
        dataClasses: ["public"],
        toolCallCount: 0,
        createdAt: now,
        startedAt: now,
        finishedAt: now,
        updatedAt: now,
      },
      sources: [],
      citations: [],
    }]);

    await expect(loadMessagesAction("session-1")).resolves.toEqual([
      expect.objectContaining({
        clientRequestId: "request-1",
        failureKind: "typed_terminal",
        run: expect.objectContaining({
          clientRequestId: "request-1",
          forceWeb: true,
          error: {
            code: "force_web_unavailable",
            message: "Sanitized message",
            retryable: false,
          },
          createdAt: now.toISOString(),
          startedAt: now.toISOString(),
          finishedAt: now.toISOString(),
          updatedAt: now.toISOString(),
        }),
      }),
    ]);
  });
});
