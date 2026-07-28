import { describe, expect, it } from "vitest";

import {
  AGENT_SSE_VERSION,
  agentEventSchema,
  agentRunRequestSchema,
  createAgentRunRequestSchema,
} from "@/lib/ai/agent/schemas";

const runId = "run-1";
const timestamp = "2026-07-19T10:00:00Z";

describe("agent run request schema", () => {
  it("validates and defaults a request", () => {
    expect(
      agentRunRequestSchema.parse({
        clientRequestId: "request-1",
        sessionId: "session-1",
        message: "  Find current software roles  ",
        model: "Qwen3.6-27B",
      }),
    ).toEqual({
      clientRequestId: "request-1",
      sessionId: "session-1",
      message: "Find current software roles",
      model: "Qwen3.6-27B",
      forceWeb: false,
    });
  });

  it("rejects unknown fields and empty messages", () => {
    expect(
      agentRunRequestSchema.safeParse({
        clientRequestId: "request-1",
        sessionId: "session-1",
        message: " ",
        model: "Qwen3.6-27B",
        forceWeb: false,
        role: "admin",
      }).success,
    ).toBe(false);
  });

  it("rejects models outside a caller-provided allow-list", () => {
    const configuredRequestSchema = createAgentRunRequestSchema([
      "Qwen3.6-27B",
      "Qwen3.6-Plus",
    ]);
    const request = {
      clientRequestId: "request-1",
      sessionId: "session-1",
      message: "Find current software roles",
      forceWeb: false,
    };

    expect(
      configuredRequestSchema.safeParse({
        ...request,
        model: "Qwen3.6-27B",
      }).success,
    ).toBe(true);
    expect(
      configuredRequestSchema.safeParse({
        ...request,
        model: "unknown-model",
      }).success,
    ).toBe(false);
  });
});

describe("agent event schema", () => {
  it.each([
    {
      version: AGENT_SSE_VERSION,
      type: "run.started",
      runId,
      userMessageId: "user-message-1",
      assistantMessageId: "assistant-message-1",
      startedAt: timestamp,
    },
    {
      version: AGENT_SSE_VERSION,
      type: "status",
      runId,
      phase: "searching",
      message: "Searching the web",
    },
    {
      version: AGENT_SSE_VERSION,
      type: "source.available",
      runId,
      source: {
        id: "source-1",
        title: "Example",
        url: "https://example.com/report",
        publishedAt: null,
        accessedAt: timestamp,
      },
    },
    {
      version: AGENT_SSE_VERSION,
      type: "text.delta",
      runId,
      messageId: "assistant-message-1",
      delta: "Hello",
    },
    {
      version: AGENT_SSE_VERSION,
      type: "run.completed",
      runId,
      messageId: "assistant-message-1",
      completedAt: timestamp,
      citations: [{ sourceId: "source-1", quote: "Exact evidence" }],
    },
    {
      version: AGENT_SSE_VERSION,
      type: "run.cancelled",
      runId,
      messageId: "assistant-message-1",
      cancelledAt: timestamp,
      reason: "user",
    },
    {
      version: AGENT_SSE_VERSION,
      type: "error",
      runId,
      code: "UPSTREAM_FAILED",
      message: "The model request failed",
      retryable: true,
      occurredAt: timestamp,
    },
  ] as const)("accepts the $type event", (event) => {
    expect(agentEventSchema.parse(event)).toEqual(event);
  });

  it("rejects unsupported protocol versions and extra fields", () => {
    expect(
      agentEventSchema.safeParse({
        version: 2,
        type: "text.delta",
        runId,
        messageId: "assistant-message-1",
        delta: "Hello",
      }).success,
    ).toBe(false);

    expect(
      agentEventSchema.safeParse({
        version: AGENT_SSE_VERSION,
        type: "text.delta",
        runId,
        messageId: "assistant-message-1",
        delta: "Hello",
        rawProviderEvent: {},
      }).success,
    ).toBe(false);
  });

  it.each(["javascript:alert(1)", "data:text/html,hello", "mailto:test@example.com"])(
    "rejects the unsafe source URL %s",
    (url) => {
      expect(agentEventSchema.safeParse({
        version: AGENT_SSE_VERSION,
        type: "source.available",
        runId,
        source: {
          id: "source-1",
          title: "Unsafe",
          url,
          publishedAt: null,
          accessedAt: timestamp,
        },
      }).success).toBe(false);
    },
  );
});
