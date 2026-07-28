import { describe, expect, it } from "vitest";

import {
  AgentSseDecodeError,
  AgentSseParser,
  encodeAgentSseEvent,
  parseAgentSseStream,
} from "@/lib/ai/agent/sse";
import {
  AGENT_SSE_VERSION,
  type AgentEvent,
  type RunCompletedEvent,
  type RunStartedEvent,
  type TextDeltaEvent,
} from "@/lib/ai/agent/schemas";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function textDelta(delta = "Hello"): TextDeltaEvent {
  return {
    version: AGENT_SSE_VERSION,
    type: "text.delta",
    runId: "run-1",
    messageId: "message-1",
    delta,
  };
}

function runStarted(): RunStartedEvent {
  return {
    version: AGENT_SSE_VERSION,
    type: "run.started",
    runId: "run-1",
    userMessageId: "user-message-1",
    assistantMessageId: "message-1",
    startedAt: "2026-07-19T10:00:00Z",
  };
}

function runCompleted(): RunCompletedEvent {
  return {
    version: AGENT_SSE_VERSION,
    type: "run.completed",
    runId: "run-1",
    messageId: "message-1",
    completedAt: "2026-07-19T10:00:01Z",
    citations: [],
  };
}

function encodeEvents(events: AgentEvent[]): Uint8Array {
  return new Uint8Array(events.flatMap((event) => [...encodeAgentSseEvent(event)]));
}

describe("agent SSE codec", () => {
  it("encodes exactly one complete event", () => {
    const event = textDelta("Hello");

    expect(decoder.decode(encodeAgentSseEvent(event))).toBe(
      'event: text.delta\ndata: {"version":1,"runId":"run-1","type":"text.delta","messageId":"message-1","delta":"Hello"}\n\n',
    );
  });

  it("rejects an event outside the versioned schema", () => {
    expect(() =>
      encodeAgentSseEvent({ ...textDelta(), version: 2 } as never),
    ).toThrow();
  });
});

describe("incremental agent SSE parser", () => {
  it("preserves fragmented UTF-8 and JSON across arbitrary chunks", () => {
    const events = [runStarted(), textDelta("Việc làm mới"), runCompleted()];
    const bytes = encodeEvents(events);
    const parser = new AgentSseParser();
    const parsedEvents: AgentEvent[] = [];

    for (const byte of bytes) {
      parsedEvents.push(...parser.push(Uint8Array.of(byte)));
    }
    parsedEvents.push(...parser.finish());

    expect(parsedEvents).toEqual(events);
  });

  it("handles CRLF and multiline data fields", () => {
    const event = textDelta("Hello");
    const json = JSON.stringify(event);
    const splitAt = json.indexOf(",") + 1;
    const deltaPayload = [
      "event: text.delta",
      `data: ${json.slice(0, splitAt)}`,
      `data: ${json.slice(splitAt)}`,
      "",
      "",
    ].join("\r\n");
    const parser = new AgentSseParser();

    expect(parser.push(encodeAgentSseEvent(runStarted()))).toEqual([runStarted()]);
    expect(parser.push(encoder.encode(deltaPayload))).toEqual([event]);
    expect(parser.push(encodeAgentSseEvent(runCompleted()))).toEqual([
      runCompleted(),
    ]);
    expect(parser.finish()).toEqual([]);
  });

  it("returns multiple events from one chunk", () => {
    const events = [runStarted(), textDelta("A"), textDelta("B"), runCompleted()];
    const parser = new AgentSseParser();

    expect(parser.push(encodeEvents(events))).toEqual(events);
    expect(parser.finish()).toEqual([]);
  });

  it("flushes the decoder and dispatches an unterminated event at EOF", () => {
    const event = runCompleted();
    const payload = `event: run.completed\ndata: ${JSON.stringify(event)}`;
    const parser = new AgentSseParser();

    expect(parser.push(encodeAgentSseEvent(runStarted()))).toEqual([runStarted()]);
    expect(parser.push(encoder.encode(payload))).toEqual([]);
    expect(parser.finish()).toEqual([event]);
    expect(parser.finish()).toEqual([]);
  });

  it("rejects incomplete UTF-8 at EOF", () => {
    const parser = new AgentSseParser();

    parser.push(Uint8Array.of(0xe1, 0xbb));
    expect(() => parser.finish()).toThrow(AgentSseDecodeError);
  });

  it("rejects malformed JSON and event-name mismatches", () => {
    const malformed = new AgentSseParser();
    expect(() => malformed.push(encoder.encode("data: {bad}\n\n"))).toThrow(
      AgentSseDecodeError,
    );

    const mismatch = new AgentSseParser();
    expect(() =>
      mismatch.push(
        encoder.encode(
          `event: status\ndata: ${JSON.stringify(textDelta())}\n\n`,
        ),
      ),
    ).toThrow(/does not match/);
  });

  it("requires run.started to be the first event", () => {
    const parser = new AgentSseParser();

    expect(() => parser.push(encodeAgentSseEvent(textDelta()))).toThrow(
      /must start with run\.started/,
    );
  });

  it("requires consistent run and assistant message IDs", () => {
    const wrongRun = new AgentSseParser();
    wrongRun.push(encodeAgentSseEvent(runStarted()));
    expect(() =>
      wrongRun.push(
        encodeAgentSseEvent({ ...textDelta(), runId: "different-run" }),
      ),
    ).toThrow(/runId/);

    const wrongMessage = new AgentSseParser();
    wrongMessage.push(encodeAgentSseEvent(runStarted()));
    expect(() =>
      wrongMessage.push(
        encodeAgentSseEvent({ ...runCompleted(), messageId: "different-message" }),
      ),
    ).toThrow(/messageId/);
  });

  it("rejects duplicate starts and events after the terminal event", () => {
    const duplicateStart = new AgentSseParser();
    duplicateStart.push(encodeAgentSseEvent(runStarted()));
    expect(() => duplicateStart.push(encodeAgentSseEvent(runStarted()))).toThrow(
      /only one run\.started/,
    );

    const afterTerminal = new AgentSseParser();
    afterTerminal.push(encodeEvents([runStarted(), runCompleted()]));
    expect(() => afterTerminal.push(encodeAgentSseEvent(runCompleted()))).toThrow(
      /after terminal event/,
    );
  });

  it("rejects EOF when no terminal event was received", () => {
    const parser = new AgentSseParser();
    parser.push(encodeEvents([runStarted(), textDelta()]));

    expect(() => parser.finish()).toThrow(/without a terminal event/);
  });

  it("parses a browser/server ReadableStream incrementally", async () => {
    const expectedEvents = [
      runStarted(),
      textDelta("A"),
      textDelta("B"),
      runCompleted(),
    ];
    const bytes = encodeEvents(expectedEvents);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 7));
        controller.enqueue(bytes.slice(7));
        controller.close();
      },
    });
    const events: AgentEvent[] = [];

    for await (const event of parseAgentSseStream(stream)) {
      events.push(event);
    }

    expect(events).toEqual(expectedEvents);
  });
});
