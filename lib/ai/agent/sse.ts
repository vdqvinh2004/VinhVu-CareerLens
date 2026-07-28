import { agentEventSchema, type AgentEvent } from "./schemas";

const textEncoder = new TextEncoder();

export class AgentSseDecodeError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AgentSseDecodeError";
  }
}

export function encodeAgentSseEvent(event: AgentEvent): Uint8Array {
  const parsed = agentEventSchema.parse(event);
  return textEncoder.encode(
    `event: ${parsed.type}\ndata: ${JSON.stringify(parsed)}\n\n`,
  );
}

const TERMINAL_EVENT_TYPES = new Set<AgentEvent["type"]>([
  "run.completed",
  "run.cancelled",
  "error",
]);

export class AgentStreamProtocolTracker {
  private runId: string | undefined;
  private assistantMessageId: string | undefined;
  private eventCount = 0;
  private terminalType: AgentEvent["type"] | undefined;

  accept(event: AgentEvent): void {
    if (this.terminalType) {
      throw new AgentSseDecodeError(
        `Agent event ${event.type} received after terminal event ${this.terminalType}`,
      );
    }

    if (this.eventCount === 0) {
      if (event.type !== "run.started") {
        throw new AgentSseDecodeError("Agent stream must start with run.started");
      }
      this.runId = event.runId;
      this.assistantMessageId = event.assistantMessageId;
    } else {
      if (event.type === "run.started") {
        throw new AgentSseDecodeError("Agent stream may contain only one run.started event");
      }
      if (event.runId !== this.runId) {
        throw new AgentSseDecodeError(
          `Agent event runId ${event.runId} does not match ${this.runId}`,
        );
      }
      if (
        (event.type === "text.delta" ||
          event.type === "run.completed" ||
          event.type === "run.cancelled") &&
        event.messageId !== this.assistantMessageId
      ) {
        throw new AgentSseDecodeError(
          `Agent event messageId ${event.messageId} does not match ${this.assistantMessageId}`,
        );
      }
    }

    this.eventCount += 1;
    if (TERMINAL_EVENT_TYPES.has(event.type)) {
      this.terminalType = event.type;
    }
  }

  finish(): void {
    if (!this.terminalType) {
      throw new AgentSseDecodeError(
        "Agent stream ended without a terminal event",
      );
    }
  }
}

export class AgentSseParser {
  private readonly decoder = new TextDecoder("utf-8", { fatal: true });
  private textBuffer = "";
  private eventName: string | undefined;
  private dataLines: string[] = [];
  private finished = false;
  private readonly protocol = new AgentStreamProtocolTracker();

  push(chunk: Uint8Array): AgentEvent[] {
    if (this.finished) {
      throw new AgentSseDecodeError("Cannot push after the parser has finished");
    }

    try {
      this.textBuffer += this.decoder.decode(chunk, { stream: true });
      return this.processCompleteLines(false);
    } catch (error) {
      if (error instanceof AgentSseDecodeError) {
        throw error;
      }
      throw this.wrapError("Invalid UTF-8 in agent event stream", error);
    }
  }

  finish(): AgentEvent[] {
    if (this.finished) {
      return [];
    }
    this.finished = true;

    try {
      this.textBuffer += this.decoder.decode();
      const events = this.processCompleteLines(true);

      if (this.textBuffer.length > 0) {
        this.processLine(this.textBuffer, events);
        this.textBuffer = "";
      }

      this.dispatch(events);
      this.protocol.finish();
      return events;
    } catch (error) {
      if (error instanceof AgentSseDecodeError) {
        throw error;
      }
      throw this.wrapError("Invalid agent event stream at EOF", error);
    }
  }

  private processCompleteLines(atEof: boolean): AgentEvent[] {
    const events: AgentEvent[] = [];

    while (true) {
      const boundary = this.findLineBoundary(atEof);
      if (!boundary) {
        return events;
      }

      const line = this.textBuffer.slice(0, boundary.index);
      this.textBuffer = this.textBuffer.slice(boundary.nextIndex);
      this.processLine(line, events);
    }
  }

  private findLineBoundary(
    atEof: boolean,
  ): { index: number; nextIndex: number } | undefined {
    for (let index = 0; index < this.textBuffer.length; index += 1) {
      const character = this.textBuffer[index];
      if (character === "\n") {
        return { index, nextIndex: index + 1 };
      }
      if (character === "\r") {
        if (index + 1 === this.textBuffer.length && !atEof) {
          return undefined;
        }
        return {
          index,
          nextIndex: this.textBuffer[index + 1] === "\n" ? index + 2 : index + 1,
        };
      }
    }

    return undefined;
  }

  private processLine(line: string, events: AgentEvent[]) {
    if (line === "") {
      this.dispatch(events);
      return;
    }
    if (line.startsWith(":")) {
      return;
    }

    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    let value = separator === -1 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) {
      value = value.slice(1);
    }

    if (field === "event") {
      this.eventName = value;
    } else if (field === "data") {
      this.dataLines.push(value);
    }
  }

  private dispatch(events: AgentEvent[]) {
    if (this.dataLines.length === 0) {
      this.eventName = undefined;
      return;
    }

    const data = this.dataLines.join("\n");
    const eventName = this.eventName;
    this.dataLines = [];
    this.eventName = undefined;

    try {
      const event = agentEventSchema.parse(JSON.parse(data));
      if (eventName && eventName !== event.type) {
        throw new AgentSseDecodeError(
          `SSE event name ${eventName} does not match payload type ${event.type}`,
        );
      }
      this.protocol.accept(event);
      events.push(event);
    } catch (error) {
      if (error instanceof AgentSseDecodeError) {
        throw error;
      }
      throw this.wrapError("Invalid agent SSE event payload", error);
    }
  }

  private wrapError(message: string, cause: unknown) {
    return new AgentSseDecodeError(message, { cause });
  }
}

export async function* parseAgentSseStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<AgentEvent> {
  const parser = new AgentSseParser();
  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      for (const event of parser.push(value)) {
        yield event;
      }
    }
    for (const event of parser.finish()) {
      yield event;
    }
  } finally {
    reader.releaseLock();
  }
}
