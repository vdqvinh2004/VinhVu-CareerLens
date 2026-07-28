import { readFile } from "node:fs/promises";

import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import type { ModelProviderRequest } from "@/lib/ai/agent/provider";
import {
  DEFAULT_FPT_MAX_OUTPUT_TOKENS,
  FPT_RESPONSES_ENDPOINT,
  FptResponsesError,
  FptResponsesProvider,
  buildFptResponsesRequest,
  parseFptResponse,
} from "@/lib/ai/fpt/responses";

const fixture = (name: string) =>
  readFile(new URL(`../fixtures/fpt/${name}`, import.meta.url), "utf8");

function request(overrides: Partial<ModelProviderRequest> = {}): ModelProviderRequest {
  return {
    model: "fixture-model",
    input: [{ type: "message", id: "msg-user", role: "user", text: "Weather?" }],
    signal: new AbortController().signal,
    timeoutMs: 5_000,
    ...overrides,
  };
}

async function collect<T>(values: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const value of values) result.push(value);
  return result;
}

describe("FPT Responses request translation", () => {
  it("replays canonical history and maps generic Zod tool definitions", () => {
    const body = buildFptResponsesRequest(
      request({
        input: [
          { type: "message", id: "sys", role: "system", text: "Be concise." },
          { type: "message", id: "user", role: "user", text: "Weather?" },
          {
            type: "tool.call",
            id: "call-1",
            name: "get_weather",
            arguments: { city: "Ha Noi" },
          },
          {
            type: "tool.result",
            callId: "call-1",
            name: "get_weather",
            output: { temperature: 31 },
            isError: false,
          },
          {
            type: "tool.result",
            callId: "call-2",
            name: "get_weather",
            output: "unavailable",
            isError: true,
          },
        ],
        tools: [
          {
            name: "get_weather",
            description: "Get weather for a city.",
            inputSchema: z.object({ city: z.string() }),
          },
        ],
        toolChoice: "auto",
        maxOutputTokens: 500,
      }),
      true,
    );

    expect(body).toEqual({
      model: "fixture-model",
      input: [
        { role: "system", content: "Be concise." },
        { role: "user", content: "Weather?" },
        {
          type: "function_call",
          call_id: "call-1",
          name: "get_weather",
          arguments: '{"city":"Ha Noi"}',
        },
        {
          type: "function_call_output",
          call_id: "call-1",
          output: '{"temperature":31}',
        },
        {
          type: "function_call_output",
          call_id: "call-2",
          output: '{"error":true,"output":"unavailable"}',
        },
      ],
      store: false,
      stream: true,
      tools: [
        {
          type: "function",
          name: "get_weather",
          description: "Get weather for a city.",
          parameters: {
            type: "object",
            properties: { city: { type: "string" } },
            required: ["city"],
          },
        },
      ],
      tool_choice: "auto",
      max_output_tokens: 500,
    });
    expect(body).not.toHaveProperty("previous_response_id");
  });

  it("rejects invalid request bounds and non-JSON canonical data", () => {
    expect(() => buildFptResponsesRequest(request({ timeoutMs: 0 }), false)).toThrow(
      FptResponsesError,
    );
    expect(() =>
      buildFptResponsesRequest(
        request({
          input: [
            {
              type: "tool.call",
              id: "call-1",
              name: "bad",
              arguments: undefined,
            },
          ],
        }),
        false,
      ),
    ).toThrow(/serialize/);
  });

  it("applies a safe output-token default and rejects invalid explicit limits", () => {
    expect(buildFptResponsesRequest(request(), false)).toMatchObject({
      max_output_tokens: DEFAULT_FPT_MAX_OUTPUT_TOKENS,
    });
    expect(() =>
      buildFptResponsesRequest(request({ maxOutputTokens: 0 }), false),
    ).toThrow(/maxOutputTokens/);
  });
});

describe("FPT Responses non-streaming adapter", () => {
  it("parses representative message, tool call, and usage output", async () => {
    const parsed = parseFptResponse(JSON.parse(await fixture("response.json")));

    expect(parsed).toEqual({
      items: [
        {
          type: "message",
          id: "msg_fixture_001",
          role: "assistant",
          text: "I will check both cities.",
        },
        {
          type: "tool.call",
          id: "call_fixture_001",
          name: "get_weather",
          arguments: { city: "Ha Noi" },
        },
      ],
      usage: { inputTokens: 31, outputTokens: 17, totalTokens: 48 },
    });
  });

  it("uses injected endpoint/fetch, bearer auth, store false, and no provider state", async () => {
    const raw = await fixture("response.json");
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(raw, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const provider = new FptResponsesProvider({
      apiKey: "secret-key",
      endpoint: "https://fpt.test/v1/responses",
      fetch: fetchMock,
    });

    await provider.generate(request());

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://fpt.test/v1/responses");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer secret-key",
      Accept: "application/json",
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({ store: false, stream: false });
    expect(JSON.parse(String(init?.body))).not.toHaveProperty("previous_response_id");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("suppresses reasoning and rejects unknown output contracts and HTTP errors", async () => {
    expect(
      parseFptResponse({
        object: "response",
        status: "completed",
        output: [
          { type: "reasoning", id: "reasoning-1", summary: "private chain" },
        ],
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      }).items,
    ).toEqual([]);
    expect(() =>
      parseFptResponse({
        object: "response",
        status: "completed",
        output: [{ type: "future_item", id: "future-1" }],
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      }),
    ).toThrow(/Unsupported FPT output item type future_item/);

    const provider = new FptResponsesProvider({
      apiKey: "secret-key",
      fetch: async () => new Response("provider exploded", { status: 503 }),
    });
    await expect(provider.generate(request())).rejects.toThrow(
      "FPT Responses API returned 503: provider exploded",
    );
  });

  it("bounds successful and error response bodies and cancels on overflow", async () => {
    const successCancel = vi.fn();
    const successBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("12345"));
      },
      cancel: successCancel,
    });
    const successProvider = new FptResponsesProvider({
      apiKey: "secret-key",
      maxResponseBytes: 4,
      fetch: async () => new Response(successBody, { status: 200 }),
    });

    await expect(successProvider.generate(request())).rejects.toThrow(
      /response body exceeds the allowed size/,
    );
    expect(successCancel).toHaveBeenCalledOnce();

    const errorCancel = vi.fn();
    const errorBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("provider detail"));
      },
      cancel: errorCancel,
    });
    const errorProvider = new FptResponsesProvider({
      apiKey: "secret-key",
      maxResponseBytes: 4,
      fetch: async () => new Response(errorBody, { status: 503 }),
    });

    await expect(errorProvider.generate(request())).rejects.toThrow(
      "FPT Responses API returned 503",
    );
    expect(errorCancel).toHaveBeenCalledOnce();
  });
});

describe("FPT Responses streaming adapter", () => {
  it("parses fragmented SSE and assembles interleaved calls exactly once", async () => {
    const bytes = new TextEncoder().encode(await fixture("response-stream.sse"));
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
        controller.close();
      },
    });
    const provider = new FptResponsesProvider({
      apiKey: "secret-key",
      fetch: async () => new Response(stream, { status: 200 }),
    });

    const events = await collect(provider.stream(request()));

    expect(events).toEqual([
      { type: "text.delta", itemId: "msg_stream_001", delta: "Weather in " },
      { type: "text.delta", itemId: "msg_stream_001", delta: "Hà Nội" },
      {
        type: "tool.call",
        item: {
          type: "tool.call",
          id: "call_stream_001",
          name: "get_weather",
          arguments: { city: "Hà Nội" },
        },
      },
      {
        type: "tool.call",
        item: {
          type: "tool.call",
          id: "call_stream_002",
          name: "get_weather",
          arguments: { city: "Da Nang" },
        },
      },
      { type: "usage", usage: { inputTokens: 42, outputTokens: 23, totalTokens: 65 } },
    ]);
  });

  it("rejects malformed, unknown, reasoning, and incomplete streams", async () => {
    const cases = [
      "data: {bad}\n\n",
      'data: {"type":"response.future_event"}\n\n',
      'data: {"type":"response.created","response":{}}\n\n',
    ];

    for (const body of cases) {
      const provider = new FptResponsesProvider({
        apiKey: "secret-key",
        fetch: async () => new Response(body, { status: 200 }),
      });
      await expect(collect(provider.stream(request()))).rejects.toThrow(
        FptResponsesError,
      );
    }
  });

  it("suppresses streamed reasoning content", async () => {
    const body = [
      'data: {"type":"response.output_item.added","item":{"id":"r1","type":"reasoning","summary":[]}}',
      'data: {"type":"response.reasoning_summary_text.delta","item_id":"r1","delta":"private chain"}',
      'data: {"type":"response.output_item.done","item":{"id":"r1","type":"reasoning","summary":[]}}',
      'data: {"type":"response.completed","response":{"status":"completed","usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}}',
      "",
    ].join("\n\n");
    const provider = new FptResponsesProvider({
      apiKey: "secret-key",
      fetch: async () => new Response(body, { status: 200 }),
    });

    expect(await collect(provider.stream(request()))).toEqual([
      { type: "usage", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
    ]);
  });

  it("resolves argument events without call_id and emits only at output_item.done", async () => {
    const body = [
      'data: {"type":"response.output_item.added","item":{"id":"fc-1","type":"function_call","call_id":"call-1","name":"lookup","arguments":""}}',
      'data: {"type":"response.function_call_arguments.delta","item_id":"fc-1","delta":"{\\"id\\":1}"}',
      'data: {"type":"response.function_call_arguments.done","item_id":"fc-1","arguments":"{\\"id\\":1}"}',
      'data: {"type":"response.output_item.added","item":{"id":"msg-1","type":"message","role":"assistant","content":[]}}',
      'data: {"type":"response.output_text.delta","item_id":"msg-1","delta":"before call completion"}',
      'data: {"type":"response.output_item.done","item":{"id":"msg-1","type":"message","role":"assistant","content":[{"type":"output_text","text":"before call completion"}]}}',
      'data: {"type":"response.output_item.done","item":{"id":"fc-1","type":"function_call","call_id":"call-1","name":"lookup","arguments":"{\\"id\\":1}"}}',
      'data: {"type":"response.completed","response":{"status":"completed","usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}}',
      "",
    ].join("\n\n");
    const provider = new FptResponsesProvider({
      apiKey: "secret-key",
      fetch: async () => new Response(body, { status: 200 }),
    });

    expect(await collect(provider.stream(request()))).toEqual([
      { type: "text.delta", itemId: "msg-1", delta: "before call completion" },
      {
        type: "tool.call",
        item: {
          type: "tool.call",
          id: "call-1",
          name: "lookup",
          arguments: { id: 1 },
        },
      },
      { type: "usage", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
    ]);
  });

  it("parses lifecycle-only streams from response.completed output", async () => {
    const body = [
      'data: {"type":"response.created","response":{"status":"in_progress"}}',
      'data: {"type":"response.in_progress","response":{"status":"in_progress"}}',
      'data: {"type":"response.completed","response":{"object":"response","status":"completed","output":[{"id":"fc-1","type":"function_call","call_id":"call-1","name":"lookup","arguments":"{\\"id\\":1}","status":"completed"},{"id":"r1","type":"reasoning","summary":[],"status":"completed"}],"usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}}',
      "",
    ].join("\n\n");
    const provider = new FptResponsesProvider({
      apiKey: "secret-key",
      fetch: async () => new Response(body, { status: 200 }),
    });

    expect(await collect(provider.stream(request()))).toEqual([
      {
        type: "tool.call",
        item: {
          type: "tool.call",
          id: "call-1",
          name: "lookup",
          arguments: { id: 1 },
        },
      },
      { type: "usage", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
    ]);
  });

  it("requires item registration and rejects text deltas for function calls", async () => {
    const cases = [
      'data: {"type":"response.output_text.delta","item_id":"missing","delta":"no"}\n\n',
      [
        'data: {"type":"response.output_item.added","item":{"id":"fc-1","type":"function_call","call_id":"call-1","name":"lookup","arguments":""}}',
        'data: {"type":"response.output_text.delta","item_id":"fc-1","delta":"no"}',
        "",
      ].join("\n\n"),
    ];

    for (const body of cases) {
      const provider = new FptResponsesProvider({
        apiKey: "secret-key",
        fetch: async () => new Response(body, { status: 200 }),
      });
      await expect(collect(provider.stream(request()))).rejects.toThrow(
        FptResponsesError,
      );
    }
  });

  it("cancels the provider body when a consumer stops early", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            'data: {"type":"response.output_item.added","item":{"id":"msg-1","type":"message","role":"assistant","content":[]}}\n\ndata: {"type":"response.output_text.delta","item_id":"msg-1","delta":"first"}\n\n',
          ),
        );
      },
      cancel,
    });
    const provider = new FptResponsesProvider({
      apiKey: "secret-key",
      fetch: async () => new Response(body, { status: 200 }),
    });

    for await (const event of provider.stream(request())) {
      expect(event).toMatchObject({ type: "text.delta", delta: "first" });
      break;
    }

    expect(cancel).toHaveBeenCalledOnce();
  });

  it("enforces cumulative streamed assistant text and cancels on overflow", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            [
              'data: {"type":"response.output_item.added","item":{"id":"msg-1","type":"message","role":"assistant","content":[]}}',
              'data: {"type":"response.output_text.delta","item_id":"msg-1","delta":"abc"}',
              'data: {"type":"response.output_item.added","item":{"id":"msg-2","type":"message","role":"assistant","content":[]}}',
              'data: {"type":"response.output_text.delta","item_id":"msg-2","delta":"def"}',
              "",
            ].join("\n\n"),
          ),
        );
      },
      cancel,
    });
    const provider = new FptResponsesProvider({
      apiKey: "secret-key",
      maxStreamTextChars: 5,
      fetch: async () => new Response(body, { status: 200 }),
    });

    await expect(collect(provider.stream(request()))).rejects.toThrow(
      /assistant text exceeds the allowed size/,
    );
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("enforces cumulative streamed function arguments and cancels on overflow", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            [
              'data: {"type":"response.output_item.added","item":{"id":"fc-1","type":"function_call","call_id":"call-1","name":"lookup","arguments":""}}',
              'data: {"type":"response.function_call_arguments.delta","item_id":"fc-1","call_id":"call-1","delta":"{\\"a\\""}',
              'data: {"type":"response.function_call_arguments.delta","item_id":"fc-1","call_id":"call-1","delta":":1}"}',
              "",
            ].join("\n\n"),
          ),
        );
      },
      cancel,
    });
    const provider = new FptResponsesProvider({
      apiKey: "secret-key",
      maxFunctionArgumentsChars: 5,
      fetch: async () => new Response(body, { status: 200 }),
    });

    await expect(collect(provider.stream(request()))).rejects.toThrow(
      /function arguments exceed the allowed size/,
    );
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("enforces cumulative raw SSE bytes including suppressed reasoning", async () => {
    const cancel = vi.fn();
    const encoder = new TextEncoder();
    const first = encoder.encode(
      'data: {"type":"response.output_item.added","item":{"id":"r1","type":"reasoning","summary":[]}}\n\n',
    );
    const second = encoder.encode(
      'data: {"type":"response.reasoning_summary_text.delta","item_id":"r1","delta":"private chain"}\n\n',
    );
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(first);
        controller.enqueue(second);
      },
      cancel,
    });
    const provider = new FptResponsesProvider({
      apiKey: "secret-key",
      maxResponseBytes: first.byteLength + second.byteLength - 1,
      fetch: async () => new Response(body, { status: 200 }),
    });

    await expect(collect(provider.stream(request()))).rejects.toThrow(
      /SSE stream exceeds the allowed size/,
    );
    expect(cancel).toHaveBeenCalledOnce();
    expect(cancel.mock.calls[0][0]).toBeInstanceOf(FptResponsesError);
  });

  it("bounds unterminated SSE lines and accumulated event data", async () => {
    const cases = [
      `data: ${"x".repeat(20)}`,
      "data: 12345\ndata: 67890\n",
    ];

    for (const raw of cases) {
      const cancel = vi.fn();
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(raw));
        },
        cancel,
      });
      const provider = new FptResponsesProvider({
        apiKey: "secret-key",
        maxStreamBufferBytes: 16,
        fetch: async () => new Response(body, { status: 200 }),
      });

      await expect(collect(provider.stream(request()))).rejects.toThrow(
        /buffered event data exceeds the allowed size/,
      );
      expect(cancel).toHaveBeenCalledOnce();
      expect(cancel.mock.calls[0][0]).toBeInstanceOf(FptResponsesError);
    }
  });

  it("propagates caller abort and enforces the request timeout", async () => {
    const waitForAbort = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit): Promise<Response> =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
            once: true,
          });
        }),
    );
    const provider = new FptResponsesProvider({
      apiKey: "secret-key",
      fetch: waitForAbort,
    });
    const caller = new AbortController();
    const callerReason = new Error("cancelled by caller");
    const callerRequest = request({ signal: caller.signal });
    const pendingCaller = provider.generate(callerRequest);
    caller.abort(callerReason);
    await expect(pendingCaller).rejects.toBe(callerReason);

    await expect(provider.generate(request({ timeoutMs: 1 }))).rejects.toMatchObject({
      name: "TimeoutError",
    });
    expect(waitForAbort).toHaveBeenCalledTimes(2);
  });

  it("keeps cancellation and timeout active while reading response bodies", async () => {
    const hangingBody = () =>
      new ReadableStream<Uint8Array>({
        start() {},
      });
    const provider = new FptResponsesProvider({
      apiKey: "secret-key",
      fetch: async () => new Response(hangingBody(), { status: 503 }),
    });
    const caller = new AbortController();
    const reason = new Error("stop reading error body");
    const pending = provider.generate(request({ signal: caller.signal }));
    caller.abort(reason);
    await expect(pending).rejects.toBe(reason);

    const streamingProvider = new FptResponsesProvider({
      apiKey: "secret-key",
      fetch: async () => new Response(hangingBody(), { status: 200 }),
    });
    const streamCaller = new AbortController();
    const streamReason = new Error("stop stream reader");
    const streamPending = collect(
      streamingProvider.stream(request({ signal: streamCaller.signal })),
    );
    streamCaller.abort(streamReason);
    await expect(streamPending).rejects.toBe(streamReason);

    await expect(
      collect(streamingProvider.stream(request({ timeoutMs: 1 }))),
    ).rejects.toMatchObject({ name: "TimeoutError" });
  });
});

describe("FPT Responses defaults", () => {
  it("targets the required FPT endpoint", () => {
    expect(FPT_RESPONSES_ENDPOINT).toBe("https://mkp-api.fptcloud.com/v1/responses");
  });

  it("rejects invalid configured response and stream limits", () => {
    expect(
      () => new FptResponsesProvider({ apiKey: "secret", maxResponseBytes: 0 }),
    ).toThrow(/maxResponseBytes/);
    expect(
      () => new FptResponsesProvider({ apiKey: "secret", maxStreamTextChars: 0 }),
    ).toThrow(/maxStreamTextChars/);
    expect(
      () => new FptResponsesProvider({ apiKey: "secret", maxStreamBufferBytes: 0 }),
    ).toThrow(/maxStreamBufferBytes/);
    expect(
      () =>
        new FptResponsesProvider({
          apiKey: "secret",
          maxFunctionArgumentsChars: 0,
        }),
    ).toThrow(/maxFunctionArgumentsChars/);
  });
});
