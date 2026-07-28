import { describe, expect, it, vi } from "vitest";

import {
  AgentLifecycleError,
  type AgentRunAllocation,
  type PersistedAgentMessage,
} from "@/lib/ai/agent/lifecycle";
import type {
  AgentProvider,
  AgentProviderRequest,
  AgentProviderResponse,
} from "@/lib/ai/agent/orchestrator";
import type { ModelProviderEvent } from "@/lib/ai/agent/provider";
import { AgentSseParser, parseAgentSseStream } from "@/lib/ai/agent/sse";
import type { AgentRun, ChatMessage } from "@/lib/db/schema";
import { createChatService } from "@/lib/ai/chat/service";
import type { TavilyClient } from "@/lib/ai/tavily";
import {
  createWebResearchTools,
  type WebCache,
  type WebResearchState,
} from "@/lib/ai/web";

const now = new Date("2026-07-19T12:00:00.000Z");
const requestInput = {
  clientRequestId: "request-1",
  sessionId: "session-1",
  message: "Tư vấn ngành học",
  model: "model-1",
  forceWeb: false,
};

function run(status: AgentRun["status"] = "pending"): AgentRun {
  return {
    id: "run-1",
    userId: "user-1",
    sessionId: "session-1",
    clientRequestId: "request-1",
    model: "model-1",
    forceWeb: false,
    status,
    userMessageId: "user-message-1",
    assistantMessageId: "assistant-message-1",
    errorCode: null,
    errorMessage: null,
    usage: null,
    dataClasses: ["public"],
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

function chatMessage(
  id: string,
  role: ChatMessage["role"],
  status: ChatMessage["status"],
  content: string,
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

function persisted(
  id: string,
  role: ChatMessage["role"],
  status: ChatMessage["status"],
  content: string,
  dataClasses: ChatMessage["dataClasses"] = ["public"],
): PersistedAgentMessage {
  return {
    ...chatMessage(id, role, status, content, dataClasses),
    run: null,
    sources: [],
    citations: [],
  };
}

function allocation(
  kind: AgentRunAllocation["kind"] = "created",
  status: AgentRun["status"] = "pending",
): AgentRunAllocation {
  return {
    kind,
    run: run(status),
    userMessage: chatMessage(
      "user-message-1",
      "user",
      "completed",
      requestInput.message,
    ),
    assistantMessage: chatMessage(
      "assistant-message-1",
      "assistant",
      status === "completed"
        ? "completed"
        : status === "cancelled"
          ? "cancelled"
          : status === "failed"
            ? "failed"
            : "pending",
      status === "completed" || status === "cancelled" || status === "failed"
        ? "Nên cân nhắc ngành phù hợp."
        : "",
    ),
  };
}

function lifecycle(initial = allocation()) {
  return {
    createOrReconcile: vi.fn(async () => initial),
    start: vi.fn(async (): Promise<AgentRun | null> => run("running")),
    complete: vi.fn(async (): Promise<AgentRun | null> => run("completed")),
    cancel: vi.fn(async (): Promise<AgentRun | null> => run("cancelled")),
    fail: vi.fn(async (): Promise<AgentRun | null> => run("failed")),
    cancelPending: vi.fn(async (): Promise<AgentRun | null> => run("cancelled")),
    failPending: vi.fn(async (): Promise<AgentRun | null> => run("failed")),
    loadRun: vi.fn(async (): Promise<AgentRun | null> => run("running")),
    loadMessages: vi.fn(async () => [
      persisted("user-message-1", "user", "completed", requestInput.message),
      persisted("assistant-message-1", "assistant", "pending", ""),
    ]),
    loadRecentHistory: vi.fn(async () => [
      persisted("user-message-1", "user", "completed", requestInput.message),
      persisted("assistant-message-1", "assistant", "pending", ""),
    ]),
  };
}

class TurnProvider implements AgentProvider {
  readonly requests: AgentProviderRequest[] = [];

  constructor(
    private readonly turns: Array<readonly ModelProviderEvent[] | Error>,
    private readonly repairs: AgentProviderResponse[] = [],
  ) {}

  async generate(request: AgentProviderRequest): Promise<AgentProviderResponse> {
    this.requests.push(request);
    const repair = this.repairs.shift();
    if (!repair) throw new Error("unexpected provider generate call");
    return repair;
  }

  async *stream(request: AgentProviderRequest): AsyncIterable<ModelProviderEvent> {
    this.requests.push(request);
    const turn = this.turns.shift();
    if (!turn) throw new Error("missing provider turn");
    if (turn instanceof Error) throw turn;
    for (const event of turn) yield event;
  }
}

function textTurn(text: string): ModelProviderEvent[] {
  return [
    { type: "text.delta", itemId: "assistant-output", delta: text },
    {
      type: "usage",
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    },
  ];
}

function dataStore() {
  return { updateFirstSessionTitle: vi.fn(async () => undefined) };
}

function memoryCache(): WebCache {
  const values = new Map<string, unknown>();
  const key = (input: unknown) => JSON.stringify(input);
  return {
    key,
    async get<T>(input: unknown) {
      return (values.get(key(input)) as T | undefined) ?? null;
    },
    async set(input: unknown, value: unknown) {
      values.set(key(input), value);
      return true;
    },
  };
}

async function events(response: Response) {
  const result = [];
  if (!response.body) throw new Error("response has no body");
  for await (const event of parseAgentSseStream(response.body)) result.push(event);
  return result;
}

function service(
  provider: AgentProvider,
  overrides: Partial<Parameters<typeof createChatService>[0]> = {},
) {
  const repository = lifecycle();
  const data = dataStore();
  return {
    repository,
    data,
    value: createChatService({
      lifecycle: repository,
      data,
      provider,
      now: () => now,
      ...overrides,
    }),
  };
}

describe("production chat service", () => {
  it("does no history, allocation, or start work for a pre-aborted request", async () => {
    const runtime = service(new TurnProvider([]));
    const controller = new AbortController();
    controller.abort("user");

    const response = await runtime.value.stream(requestInput, {
      userId: "user-1",
      signal: controller.signal,
    });

    expect(response.status).toBe(499);
    expect(runtime.repository.loadRecentHistory).not.toHaveBeenCalled();
    expect(runtime.repository.createOrReconcile).not.toHaveBeenCalled();
    expect(runtime.repository.start).not.toHaveBeenCalled();
  });

  it("checks cancellation and the established deadline between preparation boundaries", async () => {
    const cancellationController = new AbortController();
    const cancelled = service(new TurnProvider([]));
    cancelled.repository.loadRecentHistory.mockImplementation(async () => {
      cancellationController.abort("user");
      return [];
    });

    expect(
      (
        await cancelled.value.stream(requestInput, {
          userId: "user-1",
          signal: cancellationController.signal,
        })
      ).status,
    ).toBe(499);
    expect(cancelled.repository.createOrReconcile).not.toHaveBeenCalled();

    let clock = 0;
    const timedOut = service(new TurnProvider([]), {
      now: () => new Date(clock),
      runTimeoutMs: 5,
    });
    timedOut.repository.loadRecentHistory.mockImplementation(async () => {
      clock = 10;
      return [];
    });
    expect(
      (
        await timedOut.value.stream(requestInput, {
          userId: "user-1",
          signal: new AbortController().signal,
        })
      ).status,
    ).toBe(408);
    expect(timedOut.repository.createOrReconcile).not.toHaveBeenCalled();
    expect(timedOut.repository.start).not.toHaveBeenCalled();
  });

  it("completes a text-only run and emits only finalized application SSE", async () => {
    const runtime = service(
      new TurnProvider([textTurn("Nên cân nhắc sở thích và năng lực của bạn.")]),
    );
    const response = await runtime.value.stream(requestInput, {
      userId: "user-1",
      signal: new AbortController().signal,
    });
    const output = await events(response);

    expect(output.map((event) => event.type)).toEqual([
      "run.started",
      "status",
      "text.delta",
      "run.completed",
    ]);
    expect(output.find((event) => event.type === "text.delta")).toMatchObject({
      delta: "Nên cân nhắc sở thích và năng lực của bạn.",
    });
    expect(runtime.repository.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Nên cân nhắc sở thích và năng lực của bạn.",
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      }),
    );
    expect(runtime.repository.fail).not.toHaveBeenCalled();
    expect(runtime.data.updateFirstSessionTitle).toHaveBeenCalledOnce();
    expect(runtime.data.updateFirstSessionTitle).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-1" }),
    );
    expect(runtime.repository.loadRecentHistory.mock.invocationCallOrder[0]).toBeLessThan(
      runtime.repository.createOrReconcile.mock.invocationCallOrder[0]!,
    );
    expect(runtime.repository.loadRecentHistory).toHaveBeenCalledWith(
      "user-1",
      "session-1",
      20,
    );
  });

  it("streams no-evidence provider text without completion-time replacement", async () => {
    const runtime = service(
      new TurnProvider([
        textTurn(
          "Nước đóng băng ở 0°C. [Nguồn bịa](https://invented.invalid) Xem www.fake.example.",
        ),
      ]),
    );

    const output = await events(
      await runtime.value.stream(requestInput, {
        userId: "user-1",
        signal: new AbortController().signal,
      }),
    );
    const delta = output.find((event) => event.type === "text.delta");

    expect(delta).toMatchObject({
      delta:
        "Nước đóng băng ở 0°C. [Nguồn bịa](https://invented.invalid) Xem www.fake.example.",
    });
    expect(output.filter((event) => event.type === "text.delta")).toHaveLength(1);
    expect(runtime.repository.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Nước đóng băng ở 0°C. Nguồn bịa Xem",
      }),
    );
  });

  it("searches, reads, validates citations, emits sources before safe text, and persists W keys", async () => {
    const tavily: TavilyClient = {
      search: vi.fn(async () => [
        {
          title: "Báo cáo việc làm",
          url: "https://safe.example.com/report",
          content: "ignored",
          score: 0.9,
          publishedAt: null,
        },
      ]),
      extract: vi.fn(async (urls: readonly string[]) => ({
        results: urls.map((url) => ({
          url,
          content: "Nhu cầu việc làm tăng 12% trong 2026.",
        })),
        failures: [],
      })),
    };
    const provider = new TurnProvider(
      [
        [
          {
            type: "tool.call",
            item: {
              type: "tool.call",
              id: "search-1",
              name: "search_web",
              arguments: { query: "việc làm 2026" },
            },
          },
        ],
        [
          {
            type: "tool.call",
            item: {
              type: "tool.call",
              id: "read-1",
              name: "read_pages",
              arguments: { sourceIds: ["W1"] },
            },
          },
        ],
        textTurn(
          "Nhu cầu việc làm tăng 12% trong 2026 [[E1]]. https://invented.invalid",
        ),
      ],
      [
        {
          items: [
            {
              type: "message",
              id: "citation-repair",
              role: "assistant",
              text: "Nhu cầu việc làm tăng 12% trong 2026 [[E1]].",
            },
          ],
          usage: { inputTokens: 7, outputTokens: 4, totalTokens: 11 },
        },
      ],
    );
    const runtime = service(provider, {
      createWebTools(state: WebResearchState) {
        const tools = createWebResearchTools({
          tavily,
          state,
          searchCache: memoryCache(),
          extractCache: memoryCache(),
          urlPolicy: {
            resolver: async () => [{ address: "93.184.216.34", family: 4 }],
          },
        });
        return [tools.searchWeb, tools.readPages];
      },
    });

    const output = await events(
      await runtime.value.stream(requestInput, {
        userId: "user-1",
        signal: new AbortController().signal,
      }),
    );
    const types = output.map((event) => event.type);
    const sourceIndex = types.indexOf("source.available");
    const textIndex = types.indexOf("text.delta");

    expect(sourceIndex).toBeGreaterThan(-1);
    expect(sourceIndex).toBeLessThan(textIndex);
    expect(output[sourceIndex]).toMatchObject({ source: { id: "W1" } });
    expect(JSON.stringify(output)).not.toContain("invented.invalid");
    expect(output[textIndex]).toMatchObject({
      delta: "Nhu cầu việc làm tăng 12% trong 2026 [1].",
    });
    expect(output.at(-1)).toMatchObject({
      type: "run.completed",
      citations: [expect.objectContaining({ sourceId: "W1" })],
    });
    expect(runtime.repository.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        usage: { inputTokens: 17, outputTokens: 9, totalTokens: 26 },
        sources: [expect.objectContaining({ sourceKey: "W1" })],
        citations: [
          {
            sourceKey: "W1",
            quote: "Nhu cầu việc làm tăng 12% trong 2026.",
          },
        ],
        toolCalls: [
          expect.objectContaining({ callId: "search-1", status: "completed" }),
          expect.objectContaining({ callId: "read-1", status: "completed" }),
        ],
      }),
    );
    const repairRequest = provider.requests.at(-1)!;
    expect(repairRequest).toMatchObject({
      tools: [],
      toolChoice: "none",
      maxOutputTokens: 2_048,
    });
    expect(JSON.stringify(repairRequest.input)).not.toContain("invented.invalid");
    expect(JSON.stringify(repairRequest.input)).not.toContain("safe.example.com");
    expect(provider.requests).toHaveLength(4);
  });

  it("makes one citation repair call and fails closed when repair remains invalid", async () => {
    const provider = new TurnProvider(
      [],
      [
        {
          items: [
            {
              type: "message",
              id: "bad-repair",
              role: "assistant",
              text: "An unsupported different claim [[E1]]. https://bad.invalid",
            },
          ],
          usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
        },
      ],
    );
    const runtime = service(provider, {
      createWebTools(state) {
        state.addEvidence("W1", "Nhu cầu việc làm tăng 12% trong 2026.");
        return [];
      },
      async executeAgent(options) {
        const finalized = await options.callbacks!.finalizeText!({
          text: "Khẳng định không được hỗ trợ [[E1]].",
          sources: [
            {
              id: "W1",
              title: "Báo cáo",
              url: "https://safe.example.com/report",
              publishedAt: null,
              accessedAt: now.toISOString(),
            },
          ],
        });
        await options.callbacks!.onTextDelta!({ itemId: "final", delta: finalized.text });
        return {
          text: finalized.text,
          items: [],
          toolRecords: [],
          sources: [],
          citations: finalized.citations,
          dataClasses: options.dataClasses,
          citationInputs: { sources: [], citations: finalized.citations },
          usage: {
            providerRequests: finalized.usage ? 1 : 0,
            inputTokens: finalized.usage?.inputTokens ?? 0,
            outputTokens: finalized.usage?.outputTokens ?? 0,
            totalTokens: finalized.usage?.totalTokens ?? 0,
            toolCalls: 0,
            networkCalls: 0,
          },
        };
      },
    });

    const output = await events(
      await runtime.value.stream(requestInput, {
        userId: "user-1",
        signal: new AbortController().signal,
      }),
    );

    expect(provider.requests).toHaveLength(1);
    expect(output.find((event) => event.type === "text.delta")).toMatchObject({
      delta: "An unsupported different claim .",
    });
    expect(JSON.stringify(output)).not.toContain("bad.invalid");
    expect(runtime.repository.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "An unsupported different claim .",
        usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
      }),
    );
  });

  it("rejects force-web when unavailable or when private content is detected", async () => {
    const unavailable = service(new TurnProvider([]));
    const unavailableEvents = await events(
      await unavailable.value.stream(
        { ...requestInput, forceWeb: true },
        { userId: "user-1", signal: new AbortController().signal },
      ),
    );
    expect(unavailableEvents.at(-1)).toMatchObject({
      type: "error",
      code: "force_web_unavailable",
    });

    const privateRuntime = service(new TurnProvider([]));
    privateRuntime.repository.loadRecentHistory.mockResolvedValue([
      persisted(
        "user-message-1",
        "user",
        "completed",
        "Email của tôi là student@example.com",
      ),
      persisted("assistant-message-1", "assistant", "pending", ""),
    ]);
    const privateEvents = await events(
      await privateRuntime.value.stream(
        {
          ...requestInput,
          message: "Email của tôi là student@example.com",
          forceWeb: true,
        },
        { userId: "user-1", signal: new AbortController().signal },
      ),
    );
    expect(privateEvents.at(-1)).toMatchObject({
      type: "error",
      code: "private_web_forbidden",
      retryable: false,
    });
    expect(privateRuntime.repository.fail).toHaveBeenCalledOnce();
  });

  it("replays a completed duplicate and rejects an active session without starting another run", async () => {
    const replayRepository = lifecycle(allocation("reconciled", "completed"));
    replayRepository.loadMessages.mockResolvedValue([
      {
        ...persisted(
          "assistant-message-1",
          "assistant",
          "completed",
          "Câu trả lời đã lưu.",
        ),
        sources: [
          {
            id: "00000000-0000-4000-8000-000000000001",
            runId: "run-1",
            sourceKey: "W1",
            title: "Nguồn",
            url: "https://safe.example.com",
            urlHash: "hash",
            publishedAt: null,
            accessedAt: now,
            createdAt: now,
          },
        ],
        citations: [
          {
            id: "citation-1",
            runId: "run-1",
            sourceId: "00000000-0000-4000-8000-000000000001",
            messageId: "assistant-message-1",
            ordinal: 0,
            quote: "Bằng chứng",
            supportStatus: "supported",
            createdAt: now,
          },
        ],
      },
    ]);
    const replay = createChatService({
      lifecycle: replayRepository,
      data: dataStore(),
      provider: new TurnProvider([]),
      now: () => now,
    });
    const replayEvents = await events(
      await replay.stream(requestInput, {
        userId: "user-1",
        signal: new AbortController().signal,
      }),
    );
    expect(replayEvents.map((event) => event.type)).toEqual([
      "run.started",
      "source.available",
      "text.delta",
      "run.completed",
    ]);
    expect(replayEvents.find((event) => event.type === "source.available")).toMatchObject({
      source: { id: "W1" },
    });
    expect(replayEvents.at(-1)).toMatchObject({
      type: "run.completed",
      citations: [{ sourceId: "W1", quote: "Bằng chứng" }],
    });
    expect(JSON.stringify(replayEvents)).not.toContain(
      "00000000-0000-4000-8000-000000000001",
    );
    expect(replayRepository.start).not.toHaveBeenCalled();

    const busyRepository = lifecycle();
    busyRepository.createOrReconcile.mockRejectedValue(
      new AgentLifecycleError("session_busy", "busy"),
    );
    const busy = createChatService({
      lifecycle: busyRepository,
      data: dataStore(),
      provider: new TurnProvider([]),
    });
    expect(
      (
        await busy.stream(requestInput, {
          userId: "user-1",
          signal: new AbortController().signal,
        })
      ).status,
    ).toBe(409);
    expect(busyRepository.start).not.toHaveBeenCalled();

    const mismatchRepository = lifecycle();
    mismatchRepository.createOrReconcile.mockRejectedValue(
      new AgentLifecycleError("model_mismatch", "wrong model"),
    );
    const mismatch = createChatService({
      lifecycle: mismatchRepository,
      data: dataStore(),
      provider: new TurnProvider([]),
    });
    expect(
      (
        await mismatch.stream(requestInput, {
          userId: "user-1",
          signal: new AbortController().signal,
        })
      ).status,
    ).toBe(409);
  });

  it.each([
    ["failed", "error"],
    ["cancelled", "run.cancelled"],
  ] as const)("replays a %s duplicate as typed terminal SSE", async (status, terminalType) => {
    const replayAllocation = allocation("reconciled", status);
    if (status === "failed") {
      replayAllocation.run = {
        ...replayAllocation.run,
        errorCode: "provider_failed",
        errorMessage: "Original safe error",
      };
    }
    const replayRepository = lifecycle(replayAllocation);
    replayRepository.loadMessages.mockResolvedValue([
      persisted(
        "assistant-message-1",
        "assistant",
        status,
        "Original partial content",
      ),
    ]);
    const replay = createChatService({
      lifecycle: replayRepository,
      data: dataStore(),
      provider: new TurnProvider([]),
      now: () => now,
    });

    const output = await events(
      await replay.stream(requestInput, {
        userId: "user-1",
        signal: new AbortController().signal,
      }),
    );

    expect(output.map((event) => event.type)).toEqual([
      "run.started",
      "text.delta",
      terminalType,
    ]);
    expect(output[1]).toMatchObject({ delta: "Original partial content" });
    if (status === "failed") {
      expect(output.at(-1)).toMatchObject({
        code: "provider_failed",
        message: "Original safe error",
      });
    }
    expect(replayRepository.start).not.toHaveBeenCalled();
  });

  it("terminalizes provider failures and records Tavily failures without exposing details", async () => {
    const providerFailure = service(
      new TurnProvider([new Error("secret provider response")]),
    );
    const failedEvents = await events(
      await providerFailure.value.stream(requestInput, {
        userId: "user-1",
        signal: new AbortController().signal,
      }),
    );
    expect(failedEvents.at(-1)).toMatchObject({ type: "error", code: "agent_failed" });
    expect(JSON.stringify(failedEvents)).not.toContain("secret provider response");
    expect(providerFailure.repository.fail).toHaveBeenCalledOnce();

    const tavily: TavilyClient = {
      search: vi.fn(async () => {
        throw new Error("paid provider detail");
      }),
      extract: vi.fn(async () => ({ results: [], failures: [] })),
    };
    const tavilyFailure = service(
      new TurnProvider([
        [
          {
            type: "tool.call",
            item: {
              type: "tool.call",
              id: "search-1",
              name: "search_web",
              arguments: { query: "học bổng" },
            },
          },
        ],
        textTurn("Nên thử lại sau."),
      ]),
      {
        createWebTools(state) {
          const tools = createWebResearchTools({
            tavily,
            state,
            searchCache: memoryCache(),
            extractCache: memoryCache(),
          });
          return [tools.searchWeb, tools.readPages];
        },
      },
    );
    const tavilyEvents = await events(
      await tavilyFailure.value.stream(requestInput, {
        userId: "user-1",
        signal: new AbortController().signal,
      }),
    );
    expect(tavilyEvents.at(-1)?.type).toBe("run.completed");
    expect(tavilyFailure.repository.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCalls: [expect.objectContaining({ status: "failed" })],
      }),
    );
    expect(JSON.stringify(tavilyEvents)).not.toContain("paid provider detail");
  });

  it("propagates request abort and stream cancellation through the run signal", async () => {
    const requestController = new AbortController();
    let observedSignal: AbortSignal | undefined;
    const runtime = service(new TurnProvider([]), {
      executeAgent: async (options) => {
        observedSignal = options.signal;
        await new Promise<never>((_resolve, reject) => {
          options.signal?.addEventListener(
            "abort",
            () => reject(options.signal?.reason),
            { once: true },
          );
        });
        throw new Error("unreachable");
      },
    });
    const response = await runtime.value.stream(requestInput, {
      userId: "user-1",
      signal: requestController.signal,
    });
    if (!response.body) throw new Error("missing response body");
    const reader = response.body.getReader();
    const parser = new AgentSseParser();
    const first = await reader.read();
    expect(first.done).toBe(false);
    expect(parser.push(first.value!).at(0)?.type).toBe("run.started");
    requestController.abort("user");
    const parsed = [];
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      parsed.push(...parser.push(next.value));
    }
    parsed.push(...parser.finish());
    expect(observedSignal?.aborted).toBe(true);
    expect(parsed.at(-1)).toMatchObject({ type: "run.cancelled", reason: "user" });
    expect(runtime.repository.cancel).toHaveBeenCalledOnce();

    let streamCancelSignal: AbortSignal | undefined;
    const streamCancel = service(new TurnProvider([]), {
      executeAgent: async (options) => {
        streamCancelSignal = options.signal;
        await new Promise<never>((_resolve, reject) => {
          options.signal?.addEventListener("abort", () => reject(options.signal?.reason), {
            once: true,
          });
        });
        throw new Error("unreachable");
      },
    });
    const cancelledResponse = await streamCancel.value.stream(requestInput, {
      userId: "user-1",
      signal: new AbortController().signal,
    });
    const cancelledReader = cancelledResponse.body!.getReader();
    await cancelledReader.read();
    await cancelledReader.cancel("user");
    expect(streamCancelSignal?.aborted).toBe(true);
    expect(streamCancel.repository.cancel).toHaveBeenCalledOnce();
  });

  it("persists already-streamed safe text when the user cancels a text-only run", async () => {
    const requestController = new AbortController();
    const provider: AgentProvider = {
      generate: vi.fn(async () => {
        throw new Error("unreachable");
      }),
      async *stream(request) {
        yield { type: "text.delta" as const, itemId: "partial", delta: "Safe partial" };
        await new Promise<never>((_resolve, reject) => {
          request.signal.addEventListener("abort", () => reject(request.signal.reason), {
            once: true,
          });
        });
      },
    };
    const runtime = service(provider);
    const response = await runtime.value.stream(requestInput, {
      userId: "user-1",
      signal: requestController.signal,
    });
    const reader = response.body!.getReader();
    const parser = new AgentSseParser();
    const output: ReturnType<AgentSseParser["push"]> = [];
    while (!output.some((event) => event.type === "text.delta")) {
      const next = await reader.read();
      if (next.done) throw new Error("stream ended before partial text");
      output.push(...parser.push(next.value));
    }
    requestController.abort("user");
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      output.push(...parser.push(next.value));
    }
    output.push(...parser.finish());

    expect(output.filter((event) => event.type === "text.delta")).toHaveLength(1);
    expect(output.at(-1)).toMatchObject({ type: "run.cancelled", reason: "user" });
    expect(runtime.repository.cancel).toHaveBeenCalledWith(
      "user-1",
      "run-1",
      expect.objectContaining({ content: "Safe partial" }),
    );
    expect(runtime.repository.complete).not.toHaveBeenCalled();
  });

  it.each([
    ["user", "user"],
    ["timeout", "timeout"],
  ] as const)("cancels an in-flight citation repair on %s", async (kind, reason) => {
    const requestController = new AbortController();
    const generate = vi.fn(async (request: AgentProviderRequest) => {
      await new Promise<never>((_resolve, reject) => {
        request.signal.addEventListener("abort", () => reject(request.signal.reason), {
          once: true,
        });
      });
      throw new Error("unreachable");
    });
    const provider: AgentProvider = {
      generate,
      stream: async function* () {
        throw new Error("unreachable");
      },
    };
    const runtime = service(provider, {
      ...(kind === "timeout" ? { runTimeoutMs: 5 } : {}),
      createWebTools(state) {
        state.addEvidence("W1", "Nhu cầu tăng 12%.");
        return [];
      },
      async executeAgent(options) {
        await options.callbacks!.finalizeText!({
          text: "Khẳng định sai [[E1]].",
          sources: [],
        });
        throw new Error("unreachable");
      },
    });
    const response = await runtime.value.stream(requestInput, {
      userId: "user-1",
      signal: requestController.signal,
    });
    await vi.waitFor(() => expect(generate).toHaveBeenCalledOnce());
    if (kind === "user") requestController.abort("user");

    const output = await events(response);
    expect(output.at(-1)).toMatchObject({ type: "run.cancelled", reason });
    expect(generate).toHaveBeenCalledOnce();
    expect(runtime.repository.complete).not.toHaveBeenCalled();
  });

  it("keeps lifecycle completion before the terminal event and parses fragmented typed SSE", async () => {
    let completed = false;
    const runtime = service(
      new TurnProvider([textTurn("Nên chọn lộ trình phù hợp.")]),
    );
    runtime.repository.complete.mockImplementation(async () => {
      completed = true;
      return run("completed");
    });
    const response = await runtime.value.stream(requestInput, {
      userId: "user-1",
      signal: new AbortController().signal,
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    const parser = new AgentSseParser();
    const output = [];
    for (const byte of bytes) output.push(...parser.push(Uint8Array.of(byte)));
    output.push(...parser.finish());

    expect(completed).toBe(true);
    expect(output.at(-1)?.type).toBe("run.completed");
    expect(runtime.repository.complete.mock.invocationCallOrder[0]).toBeLessThan(
      runtime.data.updateFirstSessionTitle.mock.invocationCallOrder[0],
    );
  });

  it.each(["null", "throw"] as const)(
    "emits one persistence error and no false completion when completion returns %s",
    async (failure) => {
      const runtime = service(new TurnProvider([textTurn("Stable answer")]));
      if (failure === "null") runtime.repository.complete.mockResolvedValue(null);
      else runtime.repository.complete.mockRejectedValue(new Error("database unavailable"));
      runtime.repository.fail.mockResolvedValue(null);

      const output = await events(
        await runtime.value.stream(requestInput, {
          userId: "user-1",
          signal: new AbortController().signal,
        }),
      );

      expect(output.at(-1)).toMatchObject({
        type: "error",
        code: "persistence_unavailable",
      });
      expect(output.filter((event) => event.type === "error")).toHaveLength(1);
      expect(output.some((event) => event.type === "run.completed")).toBe(false);
      expect(runtime.repository.fail).toHaveBeenCalledWith(
        "user-1",
        "run-1",
        "persistence_unavailable",
        expect.any(String),
        expect.objectContaining({ content: "Stable answer" }),
      );
    },
  );

  it("emits a persisted failure after a completion conflict when fail succeeds", async () => {
    const runtime = service(new TurnProvider([textTurn("Stable answer")]));
    runtime.repository.complete.mockResolvedValue(null);

    const output = await events(
      await runtime.value.stream(requestInput, {
        userId: "user-1",
        signal: new AbortController().signal,
      }),
    );

    expect(output.at(-1)).toMatchObject({
      type: "error",
      code: "persistence_unavailable",
    });
    expect(output.some((event) => event.type === "run.completed")).toBe(false);
    expect(runtime.repository.fail).toHaveBeenCalledOnce();
  });

  it.each(["complete", "cancel", "fail"] as const)(
    "emits committed truth after an ambiguous %s write",
    async (method) => {
      const runtime = service(new TurnProvider([textTurn("Stable answer")]));
      const committed =
        method === "complete"
          ? run("completed")
          : method === "cancel"
            ? run("cancelled")
            : {
                ...run("failed"),
                errorCode: "provider_failed",
                errorMessage: "Safe failure",
              };
      runtime.repository[method].mockResolvedValue(null);
      runtime.repository.loadRun.mockResolvedValue(committed);
      if (method === "cancel") {
        const controller = new AbortController();
        const waiting = service(new TurnProvider([]), {
          lifecycle: runtime.repository,
          executeAgent: async (options) => {
            await new Promise<never>((_resolve, reject) => {
              options.signal?.addEventListener("abort", () => reject(options.signal?.reason), {
                once: true,
              });
            });
            throw new Error("unreachable");
          },
        });
        const response = await waiting.value.stream(requestInput, {
          userId: "user-1",
          signal: controller.signal,
        });
        controller.abort("user");
        const output = await events(response);
        expect(output.at(-1)?.type).toBe("run.cancelled");
        return;
      }
      if (method === "fail") {
        runtime.value = createChatService({
          lifecycle: runtime.repository,
          data: runtime.data,
          provider: new TurnProvider([new Error("provider failed")]),
          now: () => now,
        });
      }
      const output = await events(
        await runtime.value.stream(requestInput, {
          userId: "user-1",
          signal: new AbortController().signal,
        }),
      );
      expect(output.at(-1)?.type).toBe(method === "complete" ? "run.completed" : "error");
      expect(output.filter((event) => ["run.completed", "run.cancelled", "error"].includes(event.type))).toHaveLength(1);
    },
  );

  it("terminalizes only a newly allocated pending run when start fails", async () => {
    const created = service(new TurnProvider([]));
    created.repository.start.mockRejectedValue(new Error("start failed"));
    created.repository.loadRun.mockResolvedValue(run("pending"));
    expect(
      (
        await created.value.stream(requestInput, {
          userId: "user-1",
          signal: new AbortController().signal,
        })
      ).status,
    ).toBe(409);
    expect(created.repository.failPending).toHaveBeenCalledOnce();

    const reconciledRepository = lifecycle(allocation("reconciled", "pending"));
    const reconciled = createChatService({
      lifecycle: reconciledRepository,
      data: dataStore(),
      provider: new TurnProvider([]),
    });
    expect(
      (
        await reconciled.stream(requestInput, {
          userId: "user-1",
          signal: new AbortController().signal,
        })
      ).status,
    ).toBe(409);
    expect(reconciledRepository.failPending).not.toHaveBeenCalled();
    expect(reconciledRepository.cancelPending).not.toHaveBeenCalled();
    expect(reconciledRepository.cancel).not.toHaveBeenCalled();
  });

  it("fails a created run when an ambiguous start actually committed running", async () => {
    const runtime = service(new TurnProvider([]));
    runtime.repository.start.mockRejectedValue(new Error("response lost"));
    runtime.repository.loadRun.mockResolvedValue(run("running"));

    const response = await runtime.value.stream(requestInput, {
      userId: "user-1",
      signal: new AbortController().signal,
    });

    expect(response.status).toBe(409);
    expect(runtime.repository.fail).toHaveBeenCalledWith(
      "user-1",
      "run-1",
      "start_failed",
      expect.any(String),
    );
    expect(runtime.repository.failPending).not.toHaveBeenCalled();
  });

  it("cancels a newly allocated pending run when the request aborts after allocation", async () => {
    const controller = new AbortController();
    const runtime = service(new TurnProvider([]));
    runtime.repository.createOrReconcile.mockImplementation(async () => {
      controller.abort("user");
      return allocation();
    });

    const response = await runtime.value.stream(requestInput, {
      userId: "user-1",
      signal: controller.signal,
    });

    expect(response.status).toBe(499);
    expect(runtime.repository.cancelPending).toHaveBeenCalledWith("user-1", "run-1");
    expect(runtime.repository.start).not.toHaveBeenCalled();
  });

  it("fails a newly allocated pending run when its preparation deadline expires", async () => {
    let clock = 0;
    const runtime = service(new TurnProvider([]), {
      now: () => new Date(clock),
      runTimeoutMs: 5,
    });
    runtime.repository.createOrReconcile.mockImplementation(async () => {
      clock = 10;
      return allocation();
    });

    const response = await runtime.value.stream(requestInput, {
      userId: "user-1",
      signal: new AbortController().signal,
    });

    expect(response.status).toBe(408);
    expect(runtime.repository.failPending).toHaveBeenCalledWith(
      "user-1",
      "run-1",
      "deadline_exceeded",
      expect.any(String),
    );
    expect(runtime.repository.start).not.toHaveBeenCalled();
  });

  it("persists known progress and sanitized partial text on cancellation", async () => {
    const controller = new AbortController();
    const runtime = service(new TurnProvider([]), {
      async executeAgent(options) {
        await options.callbacks?.onProgress?.({
          usage: {
            providerRequests: 1,
            inputTokens: 9,
            outputTokens: 2,
            totalTokens: 11,
            toolCalls: 1,
            networkCalls: 1,
          },
          toolRecords: [
            {
              call: {
                type: "tool.call",
                id: "search-1",
                name: "search_web",
                arguments: { query: "test" },
              },
              result: {
                type: "tool.result",
                callId: "search-1",
                name: "search_web",
                output: { ok: true },
                isError: false,
              },
              status: "completed",
            },
          ],
          sources: [
            {
              id: "W1",
              title: "Source",
              url: "https://safe.example.com",
              publishedAt: null,
              accessedAt: now.toISOString(),
            },
          ],
          dataClasses: new Set(["public"]),
        });
        await options.callbacks?.onTextDelta?.({
          itemId: "partial",
          delta: "Partial https://unsafe.invalid",
        });
        await new Promise<never>((_resolve, reject) => {
          options.signal?.addEventListener("abort", () => reject(options.signal?.reason), {
            once: true,
          });
        });
        throw new Error("unreachable");
      },
    });
    const response = await runtime.value.stream(requestInput, {
      userId: "user-1",
      signal: controller.signal,
    });
    const reader = response.body!.getReader();
    const parser = new AgentSseParser();
    while (true) {
      const next = await reader.read();
      if (next.done) throw new Error("stream ended before partial text");
      if (parser.push(next.value).some((event) => event.type === "text.delta")) break;
    }
    controller.abort("user");
    while (!(await reader.read()).done) {
      // Drain until terminal persistence completes.
    }

    expect(runtime.repository.cancel).toHaveBeenCalledWith(
      "user-1",
      "run-1",
      expect.objectContaining({
        content: "Partial",
        usage: { inputTokens: 9, outputTokens: 2, totalTokens: 11 },
        toolCalls: [expect.objectContaining({ callId: "search-1" })],
        sources: [expect.objectContaining({ sourceKey: "W1" })],
      }),
    );
  });

  it("persists known provider, tool, and source progress on failure", async () => {
    const runtime = service(new TurnProvider([]), {
      async executeAgent(options) {
        await options.callbacks?.onTextDelta?.({
          itemId: "partial",
          delta: "Partial https://unsafe.invalid",
        });
        await options.callbacks?.onProgress?.({
          usage: {
            providerRequests: 1,
            inputTokens: 12,
            outputTokens: 4,
            totalTokens: 16,
            toolCalls: 1,
            networkCalls: 1,
          },
          toolRecords: [
            {
              call: {
                type: "tool.call",
                id: "search-1",
                name: "search_web",
                arguments: { query: "test" },
              },
              result: {
                type: "tool.result",
                callId: "search-1",
                name: "search_web",
                output: { ok: true },
                isError: false,
              },
              status: "completed",
            },
          ],
          sources: [
            {
              id: "W1",
              title: "Source",
              url: "https://safe.example.com",
              publishedAt: null,
              accessedAt: now.toISOString(),
            },
          ],
          dataClasses: new Set(["public"]),
        });
        throw new Error("provider failed");
      },
    });

    await events(
      await runtime.value.stream(requestInput, {
        userId: "user-1",
        signal: new AbortController().signal,
      }),
    );

    expect(runtime.repository.fail).toHaveBeenCalledWith(
      "user-1",
      "run-1",
      "agent_failed",
      expect.any(String),
      expect.objectContaining({
        content: "Partial",
        usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 },
        toolCalls: [expect.objectContaining({ callId: "search-1" })],
        sources: [expect.objectContaining({ sourceKey: "W1" })],
      }),
    );
  });

  it.each(["null", "throw"] as const)(
    "emits one persistence error when failure persistence returns %s",
    async (failure) => {
      const runtime = service(new TurnProvider([new Error("provider failed")]));
      if (failure === "null") runtime.repository.fail.mockResolvedValue(null);
      else runtime.repository.fail.mockRejectedValue(new Error("database unavailable"));

      const output = await events(
        await runtime.value.stream(requestInput, {
          userId: "user-1",
          signal: new AbortController().signal,
        }),
      );

      expect(output.at(-1)).toMatchObject({
        type: "error",
        code: "persistence_unavailable",
      });
      expect(output.filter((event) => event.type === "error")).toHaveLength(1);
    },
  );

  it.each(["null", "throw"] as const)(
    "emits one persistence error and no false cancellation when cancellation returns %s",
    async (failure) => {
    const requestController = new AbortController();
    const runtime = service(new TurnProvider([]), {
      executeAgent: async (options) => {
        await new Promise<never>((_resolve, reject) => {
          options.signal?.addEventListener(
            "abort",
            () => reject(options.signal?.reason),
            { once: true },
          );
        });
        throw new Error("unreachable");
      },
    });
    if (failure === "null") runtime.repository.cancel.mockResolvedValue(null);
    else runtime.repository.cancel.mockRejectedValue(new Error("database unavailable"));
    const response = await runtime.value.stream(requestInput, {
      userId: "user-1",
      signal: requestController.signal,
    });
    requestController.abort("user");

    const output = await events(response);

    expect(output.some((event) => event.type === "run.cancelled")).toBe(false);
    expect(output.at(-1)).toMatchObject({
      type: "error",
      code: "persistence_unavailable",
    });
    expect(output.filter((event) => event.type === "error")).toHaveLength(1);
    },
  );

  it("carries tool-produced private provenance into the next run", async () => {
    const first = service(new TurnProvider([]), {
      executeAgent: async () => ({
        text: "Private result",
        items: [],
        toolRecords: [],
        sources: [],
        citations: [],
        dataClasses: new Set(["public", "private_document"]),
        citationInputs: { sources: [], citations: [] },
        usage: {
          providerRequests: 1,
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
          toolCalls: 1,
          networkCalls: 0,
        },
      }),
    });
    await events(
      await first.value.stream(requestInput, {
        userId: "user-1",
        signal: new AbortController().signal,
      }),
    );
    expect(first.repository.complete).toHaveBeenCalledWith(
      expect.objectContaining({ dataClasses: ["public", "private_document"] }),
    );

    let nextClasses: ReadonlySet<string> | undefined;
    const second = service(new TurnProvider([]), {
      executeAgent: async (options) => {
        nextClasses = options.dataClasses;
        return {
          text: "Next result",
          items: [],
          toolRecords: [],
          sources: [],
          citations: [],
          dataClasses: options.dataClasses,
          citationInputs: { sources: [], citations: [] },
          usage: {
            providerRequests: 1,
            inputTokens: 1,
            outputTokens: 1,
            totalTokens: 2,
            toolCalls: 0,
            networkCalls: 0,
          },
        };
      },
    });
    second.repository.loadRecentHistory.mockResolvedValue([
      persisted(
        "prior-private-answer",
        "assistant",
        "completed",
        "Benign summary",
        ["public", "private_document"],
      ),
    ]);
    await events(
      await second.value.stream(
        { ...requestInput, clientRequestId: "request-2", message: "Continue" },
        { userId: "user-1", signal: new AbortController().signal },
      ),
    );

    expect([...nextClasses!]).toEqual(["public"]);
    expect(second.repository.createOrReconcile).toHaveBeenCalledWith(
      expect.objectContaining({
        dataClasses: ["public"],
      }),
    );
  });
});
