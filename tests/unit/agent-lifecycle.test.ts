import { describe, expect, it, vi } from "vitest";

import {
  AgentLifecycleRepository,
  canTransitionAgentRun,
  selectNewestEligibleHistory,
  selectNewestHistory,
  type AgentLifecycleStore,
  type AgentLifecycleTransaction,
} from "@/lib/ai/agent/lifecycle";
import type { AgentRun, ChatMessage, ChatSession } from "@/lib/db/schema";

const now = new Date("2026-07-19T12:00:00.000Z");
const sourceUuid = "00000000-0000-4000-8000-000000000001";

function message(
  id: string,
  role: ChatMessage["role"],
  status: ChatMessage["status"],
  content = "",
  dataClasses: ChatMessage["dataClasses"] = ["public"],
): ChatMessage {
  return {
    id,
    sessionId: "session-1",
    role,
    content,
    model: role === "assistant" ? "model-1" : null,
    status,
    dataClasses,
    clientRequestId: role === "user" ? "request-1" : null,
    createdAt: now,
  };
}

function run(
  status: AgentRun["status"] = "pending",
  dataClasses: AgentRun["dataClasses"] = ["public"],
): AgentRun {
  return {
    id: "run-1",
    userId: "user-1",
    sessionId: "session-1",
    clientRequestId: "request-1",
    model: "model-1",
    forceWeb: false,
    status,
    userMessageId: "message-user",
    assistantMessageId: "message-assistant",
    errorCode: null,
    errorMessage: null,
    usage: null,
    dataClasses,
    toolCallCount: 0,
    createdAt: now,
    startedAt: status === "pending" ? null : now,
    finishedAt:
      status === "completed" || status === "cancelled" || status === "failed"
        ? now
        : null,
    updatedAt: now,
  };
}

function session(model = "model-1"): ChatSession {
  return {
    id: "session-1",
    userId: "user-1",
    title: "Chat",
    model,
    createdAt: now,
    updatedAt: now,
  };
}

function mockStore(transactionError?: unknown) {
  const transaction = {
    findRunByRequest: vi.fn().mockResolvedValue(null),
    findOwnedRun: vi.fn().mockResolvedValue(run("running")),
    findOwnedSession: vi.fn().mockResolvedValue(session()),
    findActiveRun: vi.fn().mockResolvedValue(null),
    recoverStaleActiveRuns: vi.fn().mockResolvedValue([]),
    lockRunningRun: vi.fn().mockResolvedValue(run("running")),
    insertMessages: vi.fn().mockResolvedValue({
      userMessage: message("message-user", "user", "completed", "hello"),
      assistantMessage: message("message-assistant", "assistant", "pending"),
    }),
    insertRun: vi.fn().mockResolvedValue(run()),
    touchSession: vi.fn().mockResolvedValue(true),
    transitionRun: vi.fn().mockResolvedValue(run("running")),
    updateAssistant: vi.fn().mockResolvedValue(true),
    insertToolCalls: vi.fn().mockResolvedValue(undefined),
    insertSources: vi.fn().mockResolvedValue(new Map([["W1", sourceUuid]])),
    findSourceIdsByKeys: vi.fn().mockResolvedValue(new Map()),
    insertCitations: vi.fn().mockResolvedValue(undefined),
  } satisfies AgentLifecycleTransaction;
  const transactionMock = vi.fn();
  const loadMessages = vi.fn().mockResolvedValue([]);
  const loadContextMessages = vi.fn().mockResolvedValue([]);
  const store: AgentLifecycleStore = {
    ...transaction,
    transaction<T>(operation: (value: AgentLifecycleTransaction) => Promise<T>) {
      transactionMock(operation);
      if (transactionError) return Promise.reject(transactionError);
      return operation(transaction);
    },
    loadMessages,
    loadContextMessages,
  };
  return {
    store,
    transaction,
    transactionMock,
    loadMessages,
    loadContextMessages,
  };
}

const input = {
  userId: "user-1",
  sessionId: "session-1",
  clientRequestId: "request-1",
  message: "hello",
  model: "model-1",
  dataClasses: ["public"],
} as const;

describe("agent lifecycle repository", () => {
  it("allows only the defined forward lifecycle transitions", () => {
    expect(canTransitionAgentRun("pending", "running")).toBe(true);
    expect(canTransitionAgentRun("running", "completed")).toBe(true);
    expect(canTransitionAgentRun("running", "cancelled")).toBe(true);
    expect(canTransitionAgentRun("running", "failed")).toBe(true);
    expect(canTransitionAgentRun("pending", "completed")).toBe(false);
    expect(canTransitionAgentRun("pending", "failed")).toBe(true);
    expect(canTransitionAgentRun("pending", "cancelled")).toBe(true);
    expect(canTransitionAgentRun("running", "running")).toBe(false);
    expect(canTransitionAgentRun("completed", "running")).toBe(false);
  });

  it("selects the newest 20 deterministically and returns chronological order", () => {
    const messages = Array.from({ length: 25 }, (_, index) => ({
      id: `message-${String(index).padStart(2, "0")}`,
      createdAt: new Date("2026-07-19T00:00:00.000Z"),
    }));

    expect(selectNewestHistory(messages).map(({ id }) => id)).toEqual(
      messages.slice(5).map(({ id }) => id),
    );
  });

  it("returns exactly the newest 20 eligible context messages", () => {
    const createdAt = new Date("2026-07-19T00:00:00.000Z");
    const eligible = Array.from({ length: 25 }, (_, index) => ({
      id: `eligible-${String(index).padStart(2, "0")}`,
      role: "user" as const,
      status: "completed" as const,
      content: `message ${index}`,
      createdAt,
    }));
    const ineligible = [
      {
        id: "newer-pending",
        role: "assistant" as const,
        status: "pending" as const,
        content: "pending",
        createdAt,
      },
      {
        id: "newer-empty",
        role: "assistant" as const,
        status: "completed" as const,
        content: "   ",
        createdAt,
      },
      {
        id: "newer-failed",
        role: "assistant" as const,
        status: "failed" as const,
        content: "partial",
        createdAt,
      },
    ];

    expect(
      selectNewestEligibleHistory([...eligible, ...ineligible]).map(
        ({ id }) => id,
      ),
    ).toEqual(eligible.slice(5).map(({ id }) => id));
  });

  it("allocates both messages and the pending run in one transaction", async () => {
    const { store, transaction, transactionMock } = mockStore();
    const repository = new AgentLifecycleRepository(store, () => now);

    await expect(repository.createOrReconcile(input)).resolves.toMatchObject({
      kind: "created",
      run: { id: "run-1", status: "pending" },
    });
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(transaction.findOwnedSession).toHaveBeenCalledWith("user-1", "session-1");
    expect(transaction.insertMessages).toHaveBeenCalledWith(input);
    expect(transaction.insertRun).toHaveBeenCalledOnce();
    expect(transaction.touchSession).toHaveBeenCalledWith("user-1", "session-1", now);
  });

  it.each(["pending", "running"] as const)(
    "recovers a stale %s run before allocating a replacement",
    async (status) => {
      const { store, transaction } = mockStore();
      transaction.recoverStaleActiveRuns.mockResolvedValue([
        {
          ...run(status),
          status: "failed",
          startedAt: now,
          finishedAt: now,
          errorCode: "stale_run_recovered",
          errorMessage: "The active agent run lease expired",
        },
      ]);
      const repository = new AgentLifecycleRepository(store, () => now, 60_000);

      await expect(repository.createOrReconcile(input)).resolves.toMatchObject({
        kind: "created",
      });
      expect(transaction.recoverStaleActiveRuns).toHaveBeenCalledWith({
        userId: "user-1",
        sessionId: "session-1",
        staleBefore: new Date("2026-07-19T11:59:00.000Z"),
        now,
      });
      expect(transaction.recoverStaleActiveRuns.mock.invocationCallOrder[0]).toBeLessThan(
        transaction.findActiveRun.mock.invocationCallOrder[0]!,
      );
      expect(transaction.insertRun).toHaveBeenCalledOnce();
    },
  );

  it("keeps a non-stale active run busy", async () => {
    const { store, transaction } = mockStore();
    transaction.findActiveRun.mockResolvedValue(run("running"));
    const repository = new AgentLifecycleRepository(store, () => now, 60_000);

    await expect(repository.createOrReconcile(input)).rejects.toMatchObject({
      code: "session_busy",
    });
    expect(transaction.recoverStaleActiveRuns).toHaveBeenCalledOnce();
    expect(transaction.insertMessages).not.toHaveBeenCalled();
  });

  it("reconciles an identical request without allocating new rows", async () => {
    const existing = {
      run: run(),
      userMessage: message("message-user", "user", "completed", "hello"),
      assistantMessage: message("message-assistant", "assistant", "pending"),
    };
    const { store, transaction } = mockStore();
    transaction.findRunByRequest.mockResolvedValue(existing);
    const repository = new AgentLifecycleRepository(store);

    await expect(repository.createOrReconcile(input)).resolves.toMatchObject({
      kind: "reconciled",
      run: { id: "run-1" },
    });
    expect(transaction.insertMessages).not.toHaveBeenCalled();
    expect(transaction.insertRun).not.toHaveBeenCalled();
  });

  it("reconciles immutable request input when persisted provenance later expands", async () => {
    const existing = {
      run: run("completed", ["public", "private_document"]),
      userMessage: message("message-user", "user", "completed", "hello"),
      assistantMessage: message(
        "message-assistant",
        "assistant",
        "completed",
        "answer",
        ["public", "private_document"],
      ),
    };
    const { store, transaction } = mockStore();
    transaction.findRunByRequest.mockResolvedValue(existing);

    await expect(
      new AgentLifecycleRepository(store).createOrReconcile(input),
    ).resolves.toMatchObject({ kind: "reconciled", run: { status: "completed" } });
  });

  it("recovers a stale same-ID request before reconciling it", async () => {
    const staleRun = {
      ...run("running"),
      updatedAt: new Date("2026-07-19T11:58:00.000Z"),
    };
    const failedRun = {
      ...staleRun,
      status: "failed" as const,
      errorCode: "stale_run_recovered",
      errorMessage: "The active agent run lease expired",
      finishedAt: now,
      updatedAt: now,
    };
    const { store, transaction } = mockStore();
    transaction.findRunByRequest
      .mockResolvedValueOnce({
        run: staleRun,
        userMessage: message("message-user", "user", "completed", "hello"),
        assistantMessage: message("message-assistant", "assistant", "streaming"),
      })
      .mockResolvedValueOnce({
        run: failedRun,
        userMessage: message("message-user", "user", "completed", "hello"),
        assistantMessage: message("message-assistant", "assistant", "failed"),
      });
    transaction.recoverStaleActiveRuns.mockResolvedValue([failedRun]);

    await expect(
      new AgentLifecycleRepository(store, () => now, 60_000).createOrReconcile(input),
    ).resolves.toMatchObject({
      kind: "reconciled",
      run: { status: "failed", errorCode: "stale_run_recovered" },
    });
    expect(transaction.recoverStaleActiveRuns).toHaveBeenCalledOnce();
    expect(transaction.insertMessages).not.toHaveBeenCalled();
  });

  it("reconciles a request-unique race and reports an active-session race", async () => {
    const requestConflict = {
      code: "23505",
      constraint: "agent_runs_user_client_request_unique",
    };
    const reconciled = mockStore(requestConflict);
    reconciled.transaction.findRunByRequest.mockResolvedValue({
      run: run(),
      userMessage: message("message-user", "user", "completed", "hello"),
      assistantMessage: message("message-assistant", "assistant", "pending"),
    });
    await expect(
      new AgentLifecycleRepository(reconciled.store).createOrReconcile(input),
    ).resolves.toMatchObject({ kind: "reconciled" });

    const activeConflict = {
      code: "23505",
      constraint: "agent_runs_session_active_unique",
    };
    const busy = mockStore(activeConflict);
    busy.transaction.findActiveRun.mockResolvedValue(run("running"));
    await expect(
      new AgentLifecycleRepository(busy.store).createOrReconcile(input),
    ).rejects.toMatchObject({ code: "session_busy" });
  });

  it("rejects cross-owner sessions and mismatched session models", async () => {
    const missing = mockStore();
    missing.transaction.findOwnedSession.mockResolvedValue(null);
    await expect(
      new AgentLifecycleRepository(missing.store).createOrReconcile(input),
    ).rejects.toMatchObject({
      code: "session_not_found",
    });

    const mismatch = mockStore();
    mismatch.transaction.findOwnedSession.mockResolvedValue(session("model-2"));
    await expect(
      new AgentLifecycleRepository(mismatch.store).createOrReconcile(input),
    ).rejects.toMatchObject({
      code: "model_mismatch",
    });
    expect(mismatch.transaction.insertMessages).not.toHaveBeenCalled();
  });

  it("updates pending to running and its assistant message exactly once", async () => {
    const { store, transaction } = mockStore();
    transaction.transitionRun
      .mockResolvedValueOnce(run("running"))
      .mockResolvedValueOnce(null);
    const repository = new AgentLifecycleRepository(store, () => now);

    await expect(repository.start("user-1", "run-1")).resolves.toMatchObject({
      status: "running",
    });
    await expect(repository.start("user-1", "run-1")).resolves.toBeNull();
    expect(transaction.transitionRun).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        runId: "run-1",
        from: "pending",
        to: "running",
      }),
    );
    expect(transaction.updateAssistant).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["completed", "complete"],
    ["cancelled", "cancel"],
    ["failed", "fail"],
  ] as const)("conditionally transitions running to %s", async (status, method) => {
    const { store, transaction } = mockStore();
    transaction.transitionRun.mockResolvedValue(run(status));
    const repository = new AgentLifecycleRepository(store, () => now);

    if (method === "complete") {
      await repository.complete({
        userId: "user-1",
        runId: "run-1",
        content: "answer",
      });
    } else if (method === "cancel") {
      await repository.cancel("user-1", "run-1", { content: "partial" });
    } else {
      await repository.fail("user-1", "run-1", "provider_error", "Failed");
    }

    expect(transaction.transitionRun).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        runId: "run-1",
        from: "running",
        to: status,
      }),
    );
    expect(transaction.updateAssistant).toHaveBeenCalledWith(
      expect.objectContaining({ status }),
    );
  });

  it("persists terminal artifacts transactionally on failure", async () => {
    const { store, transaction } = mockStore();
    transaction.transitionRun.mockResolvedValue(run("failed", ["public"]));
    const repository = new AgentLifecycleRepository(store, () => now);

    await repository.fail("user-1", "run-1", "provider_error", "Failed", {
      content: "partial",
      usage: { inputTokens: 8, outputTokens: 3, totalTokens: 11 },
      toolCalls: [
        {
          callId: "tool-1",
          name: "search_web",
          arguments: { query: "test" },
          result: { ok: true },
          status: "completed",
        },
      ],
      sources: [
        {
          sourceKey: "W1",
          title: "Source",
          url: "https://example.com",
          accessedAt: now,
        },
      ],
      dataClasses: ["public"],
    });

    expect(transaction.insertToolCalls).toHaveBeenCalledOnce();
    expect(transaction.insertSources).toHaveBeenCalledOnce();
    expect(transaction.transitionRun).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "failed",
        usage: { inputTokens: 8, outputTokens: 3, totalTokens: 11 },
        toolCallCount: 1,
      }),
    );
    expect(transaction.updateAssistant).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", content: "partial" }),
    );
  });

  it("persists source keys and maps citations to generated source UUIDs", async () => {
    const { store, transaction } = mockStore();
    const repository = new AgentLifecycleRepository(store);

    await repository.persistAssistantContent("user-1", "run-1", "partial");
    await repository.persistArtifacts("user-1", "run-1", {
      sources: [
        {
          sourceKey: "W1",
          title: "Source",
          url: "https://example.com",
          accessedAt: now,
        },
      ],
      citations: [{ sourceKey: "W1", quote: "Evidence" }],
    });

    expect(transaction.lockRunningRun).toHaveBeenNthCalledWith(
      1,
      "user-1",
      "run-1",
    );
    expect(transaction.lockRunningRun).toHaveBeenNthCalledWith(
      2,
      "user-1",
      "run-1",
    );
    expect(transaction.updateAssistant).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "message-assistant",
        sessionId: "session-1",
        content: "partial",
      }),
    );
    expect(transaction.insertSources).toHaveBeenCalledWith(
      "run-1",
      [expect.objectContaining({ sourceKey: "W1" })],
    );
    expect(transaction.findSourceIdsByKeys).not.toHaveBeenCalled();
    expect(transaction.insertCitations).toHaveBeenCalledWith(
      expect.objectContaining({ id: "run-1", assistantMessageId: "message-assistant" }),
      [expect.objectContaining({ sourceId: sourceUuid, quote: "Evidence" })],
    );
    expect(transaction.insertCitations.mock.calls[0]?.[1]?.[0]).not.toHaveProperty(
      "sourceKey",
    );
  });

  it("persists public then private provenance across runs", async () => {
    const publicRuntime = mockStore();
    const publicRepository = new AgentLifecycleRepository(publicRuntime.store);
    await publicRepository.createOrReconcile(input);
    publicRuntime.transaction.transitionRun.mockResolvedValue(run("completed"));
    await publicRepository.complete({
      userId: "user-1",
      runId: "run-1",
      content: "public answer",
      dataClasses: ["public"],
    });

    const privateRuntime = mockStore();
    privateRuntime.transaction.lockRunningRun.mockResolvedValue(
      run("running", ["public", "private_document"]),
    );
    privateRuntime.transaction.transitionRun.mockResolvedValue(
      run("completed", ["public", "private_document"]),
    );
    const privateRepository = new AgentLifecycleRepository(privateRuntime.store);
    const privateInput = {
      ...input,
      clientRequestId: "request-2",
      message: "my private document",
      dataClasses: ["public", "private_document"] as const,
    };
    await privateRepository.createOrReconcile(privateInput);
    await privateRepository.complete({
      userId: "user-1",
      runId: "run-1",
      content: "private answer",
      dataClasses: ["public", "private_document"],
    });

    expect(publicRuntime.transaction.insertMessages).toHaveBeenCalledWith(
      expect.objectContaining({ dataClasses: ["public"] }),
    );
    expect(publicRuntime.transaction.updateAssistant).toHaveBeenCalledWith(
      expect.objectContaining({ dataClasses: ["public"] }),
    );
    expect(privateRuntime.transaction.insertMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        dataClasses: ["public", "private_document"],
      }),
    );
    expect(privateRuntime.transaction.transitionRun).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "completed",
        dataClasses: ["public", "private_document"],
      }),
    );
    expect(privateRuntime.transaction.updateAssistant).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        dataClasses: ["public", "private_document"],
      }),
    );
  });

  it("does not resolve a citation alias from another run", async () => {
    const { store, transaction } = mockStore();
    transaction.findSourceIdsByKeys.mockImplementation(async (runId) =>
      runId === "run-2" ? new Map([["W1", sourceUuid]]) : new Map(),
    );
    const repository = new AgentLifecycleRepository(store);

    await expect(
      repository.persistArtifacts("user-1", "run-1", {
        citations: [{ sourceKey: "W1", quote: "Other-run evidence" }],
      }),
    ).rejects.toMatchObject({ code: "state_conflict" });

    expect(transaction.findSourceIdsByKeys).toHaveBeenCalledWith("run-1", ["W1"]);
    expect(transaction.insertCitations).not.toHaveBeenCalled();
  });

  it("loads messages and newest history through the user-scoped boundary", async () => {
    const { store, loadMessages, loadContextMessages } = mockStore();
    const repository = new AgentLifecycleRepository(store);

    await repository.loadMessages("user-1", "session-1");
    await repository.loadRecentHistory("user-1", "session-1");

    expect(loadMessages).toHaveBeenNthCalledWith(1, "user-1", "session-1");
    expect(loadContextMessages).toHaveBeenCalledWith("user-1", "session-1", 20);
  });
});
