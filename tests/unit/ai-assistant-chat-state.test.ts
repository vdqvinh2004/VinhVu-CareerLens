import { describe, expect, it } from "vitest";

import {
  applyAgentEvent,
  classifyAbortFailure,
  createUiMessage,
  mapPersistedMessagesToPublic,
  prepareTransportRetry,
  releaseStaleActiveMessages,
  resolveRetryClientRequestId,
  resolveCitationText,
  type UIMessage,
} from "@/app/(app)/dashboard/ai-assistant/_components/chat-state";
import { AGENT_SSE_VERSION, type AgentEvent } from "@/lib/ai/agent/schemas";
import type { PersistedAgentMessage } from "@/lib/ai/agent/lifecycle";

const source = {
  id: "W1",
  title: "Verified source",
  url: "https://example.com/report",
  publishedAt: "2026-07-01T00:00:00.000Z",
  accessedAt: "2026-07-19T10:00:00.000Z",
};

function pendingMessage(): UIMessage {
  return {
    id: "local-assistant",
    localId: "local-assistant",
    role: "assistant",
    content: "",
    model: "allowed-model",
    clientRequestId: "request-1",
    status: "pending",
    failureKind: null,
    run: null,
    sources: [],
    citations: [],
  };
}

describe("AI assistant public message mapping", () => {
  it("replaces internal source UUIDs with public source keys", () => {
    const messages = [{
      id: "message-1",
      sessionId: "session-1",
      role: "assistant",
      content: "Answer [1]",
      model: "allowed-model",
      status: "completed",
      dataClasses: ["public"],
      clientRequestId: null,
      createdAt: new Date("2026-07-19T10:00:00.000Z"),
      run: {
        id: "run-1",
        userId: "user-1",
        sessionId: "session-1",
        clientRequestId: "request-1",
        model: "allowed-model",
        forceWeb: true,
        status: "completed",
        userMessageId: "user-1",
        assistantMessageId: "message-1",
        errorCode: null,
        errorMessage: null,
        usage: null,
        dataClasses: ["public"],
        toolCallCount: 0,
        createdAt: new Date("2026-07-19T09:59:59.000Z"),
        startedAt: new Date("2026-07-19T10:00:00.000Z"),
        finishedAt: new Date("2026-07-19T10:00:01.000Z"),
        updatedAt: new Date("2026-07-19T10:00:01.000Z"),
      },
      sources: [{
        id: "9f08cd17-4d61-4fdf-a5ed-777a62411c75",
        runId: "run-1",
        sourceKey: "W1",
        title: "Verified source",
        url: source.url,
        urlHash: "hash",
        publishedAt: new Date(source.publishedAt),
        accessedAt: new Date(source.accessedAt),
        createdAt: new Date(source.accessedAt),
      }],
      citations: [{
        id: "citation-uuid",
        runId: "run-1",
        sourceId: "9f08cd17-4d61-4fdf-a5ed-777a62411c75",
        messageId: "message-1",
        ordinal: 0,
        quote: "Exact evidence",
        supportStatus: "supported",
        createdAt: new Date(source.accessedAt),
      }],
    }] as unknown as PersistedAgentMessage[];

    expect(mapPersistedMessagesToPublic(messages)).toEqual([{
      id: "message-1",
      role: "assistant",
      content: "Answer [1]",
      model: "allowed-model",
      clientRequestId: "request-1",
      status: "completed",
      failureKind: null,
      run: {
        id: "run-1",
        clientRequestId: "request-1",
        forceWeb: true,
        status: "completed",
        error: null,
        createdAt: "2026-07-19T09:59:59.000Z",
        startedAt: "2026-07-19T10:00:00.000Z",
        finishedAt: "2026-07-19T10:00:01.000Z",
        updatedAt: "2026-07-19T10:00:01.000Z",
      },
      sources: [source],
      citations: [{ ordinal: 1, sourceId: "W1", quote: "Exact evidence" }],
    }]);
  });

  it("drops citations whose source is not attached to the owned message", () => {
    const messages = [{
      id: "message-1",
      role: "assistant",
      content: "Answer",
      model: null,
      status: "completed",
      sources: [],
      citations: [{ sourceId: "foreign-source", ordinal: 0, quote: "No" }],
    }] as unknown as PersistedAgentMessage[];

    expect(mapPersistedMessagesToPublic(messages)[0]?.citations).toEqual([]);
  });

  it("filters unsafe persisted source schemes before exposing links", () => {
    const messages = [{
      id: "message-1",
      role: "assistant",
      content: "Unsafe [1]",
      model: null,
      status: "completed",
      clientRequestId: null,
      run: null,
      sources: [{
        id: "source-uuid",
        sourceKey: "W1",
        title: "Unsafe",
        url: "javascript:alert(1)",
        publishedAt: null,
        accessedAt: new Date("2026-07-19T10:00:00.000Z"),
      }],
      citations: [{ sourceId: "source-uuid", ordinal: 0, quote: "No" }],
    }] as unknown as PersistedAgentMessage[];

    expect(mapPersistedMessagesToPublic(messages)[0]).toMatchObject({
      sources: [],
      citations: [],
    });
  });

  it("restores sanitized non-retryable privacy failures from run metadata", () => {
    const createdAt = new Date("2026-07-19T10:00:00.000Z");
    const messages = [{
      id: "assistant-1",
      role: "assistant",
      content: "",
      model: "allowed-model",
      status: "failed",
      clientRequestId: null,
      run: {
        id: "run-1",
        clientRequestId: "request-1",
        forceWeb: true,
        status: "failed",
        errorCode: "private_web_forbidden",
        errorMessage: "Sanitized privacy message",
        createdAt,
        startedAt: createdAt,
        finishedAt: createdAt,
        updatedAt: createdAt,
      },
      sources: [],
      citations: [],
    }] as unknown as PersistedAgentMessage[];

    expect(createUiMessage(mapPersistedMessagesToPublic(messages)[0]!)).toMatchObject({
      clientRequestId: "request-1",
      failureKind: "typed_terminal",
      error: {
        code: "private_web_forbidden",
        message: "Sanitized privacy message",
        retryable: false,
      },
      run: { forceWeb: true },
    });
  });
});

describe("AI assistant retry reconciliation", () => {
  it("reuses a transport request without inserting another optimistic turn", () => {
    const user = createUiMessage({
      id: "user-1",
      role: "user",
      content: "Hello",
      model: null,
      clientRequestId: "request-1",
      status: "completed",
      failureKind: null,
      run: null,
      sources: [],
      citations: [],
    });
    const failed = {
      ...pendingMessage(),
      status: "failed" as const,
      failureKind: "transport" as const,
      content: "partial",
      error: { code: "stream_failed", message: "Failed", retryable: true },
    };

    const retried = prepareTransportRetry([user, failed], failed.localId);

    expect(retried).toHaveLength(2);
    expect(retried[0]).toBe(user);
    expect(retried[1]).toMatchObject({
      localId: failed.localId,
      clientRequestId: "request-1",
      status: "pending",
      failureKind: null,
      content: "",
    });
    expect(resolveRetryClientRequestId(failed, () => "new-request")).toBe("request-1");
  });

  it("allocates a new request ID for a typed terminal retry", () => {
    expect(resolveRetryClientRequestId({
      clientRequestId: "request-1",
      failureKind: "typed_terminal",
    }, () => "request-2")).toBe("request-2");
  });

  it("allocates a new request ID after an intentional local stop", () => {
    const controller = new AbortController();
    controller.abort("user");

    const failureKind = classifyAbortFailure("user", controller.signal);

    expect(failureKind).toBe("local_cancel");
    expect(resolveRetryClientRequestId({
      clientRequestId: "request-1",
      failureKind,
    }, () => "request-2")).toBe("request-2");
  });

  it("keeps non-user AbortError failures transport-retryable", () => {
    const controller = new AbortController();

    expect(classifyAbortFailure(
      { name: "AbortError" },
      controller.signal,
    )).toBe("transport");
  });

  it("releases a stale persisted active run with a fresh retry request", () => {
    const active = {
      ...pendingMessage(),
      run: {
        id: "run-1",
        clientRequestId: "request-1",
        forceWeb: false,
        status: "running" as const,
        error: null,
        createdAt: "2026-07-19T09:00:00.000Z",
        startedAt: "2026-07-19T09:00:01.000Z",
        finishedAt: null,
        updatedAt: "2026-07-19T09:00:01.000Z",
      },
    };

    expect(releaseStaleActiveMessages(
      [active],
      Date.parse("2026-07-19T09:05:02.000Z"),
      300_000,
      "Incomplete",
    )[0]).toMatchObject({
      clientRequestId: "request-1",
      status: "failed",
      failureKind: "typed_terminal",
      error: { code: "run_incomplete", retryable: true },
      run: { forceWeb: false, status: "failed" },
    });
    expect(resolveRetryClientRequestId(
      releaseStaleActiveMessages(
        [active],
        Date.parse("2026-07-19T09:05:02.000Z"),
        300_000,
        "Incomplete",
      )[0],
      () => "request-2",
    )).toBe("request-2");
  });
});

describe("AI assistant event reducer", () => {
  it("restores the typed lifecycle, sources, text, and completed citations", () => {
    const events: AgentEvent[] = [
      {
        version: AGENT_SSE_VERSION,
        type: "run.started",
        runId: "run-1",
        userMessageId: "user-1",
        assistantMessageId: "assistant-1",
        startedAt: "2026-07-19T10:00:00Z",
      },
      {
        version: AGENT_SSE_VERSION,
        type: "status",
        runId: "run-1",
        phase: "reading",
        message: "Private implementation detail is not retained",
      },
      {
        version: AGENT_SSE_VERSION,
        type: "source.available",
        runId: "run-1",
        source,
      },
      {
        version: AGENT_SSE_VERSION,
        type: "text.delta",
        runId: "run-1",
        messageId: "assistant-1",
        delta: "Answer [1]",
      },
      {
        version: AGENT_SSE_VERSION,
        type: "run.completed",
        runId: "run-1",
        messageId: "assistant-1",
        completedAt: "2026-07-19T10:00:01Z",
        citations: [{ sourceId: "W1", quote: "Exact evidence" }],
      },
    ];

    const result = events.reduce(applyAgentEvent, pendingMessage());

    expect(result).toMatchObject({
      id: "assistant-1",
      localId: "local-assistant",
      runId: "run-1",
      content: "Answer [1]",
      status: "completed",
      phase: undefined,
      sources: [source],
      citations: [{ ordinal: 1, sourceId: "W1", quote: "Exact evidence" }],
    });
    expect(JSON.stringify(result)).not.toContain("Private implementation detail");
  });

  it("preserves partial text on cancellation and retains typed retryability on errors", () => {
    const partial = { ...pendingMessage(), content: "Partial safe text" };
    const cancelled = applyAgentEvent(partial, {
      version: AGENT_SSE_VERSION,
      type: "run.cancelled",
      runId: "run-1",
      messageId: "assistant-1",
      cancelledAt: "2026-07-19T10:00:01Z",
      reason: "user",
    });
    const failed = applyAgentEvent(pendingMessage(), {
      version: AGENT_SSE_VERSION,
      type: "error",
      runId: "run-2",
      code: "provider_timeout",
      message: "Timed out",
      retryable: true,
      occurredAt: "2026-07-19T10:00:01Z",
    });

    expect(cancelled).toMatchObject({ content: "Partial safe text", status: "cancelled" });
    expect(failed.error).toEqual({
      code: "provider_timeout",
      message: "Timed out",
      retryable: true,
    });
  });
});

describe("AI assistant citation resolution", () => {
  it("resolves only ordinal citations backed by an attached verified source", () => {
    const parts = resolveCitationText(
      "Known [1], missing citation [2], missing source [3].",
      [
        { ordinal: 1, sourceId: "W1", quote: "Evidence" },
        { ordinal: 3, sourceId: "W3", quote: "Unattached" },
      ],
      [source],
    );

    expect(parts.filter((part) => part.type === "citation")).toEqual([{
      type: "citation",
      marker: "[1]",
      citation: { ordinal: 1, sourceId: "W1", quote: "Evidence" },
      source,
    }]);
    expect(parts.map((part) => part.type === "text" ? part.value : part.marker).join(""))
      .toBe("Known [1], missing citation [2], missing source [3].");
  });
});
