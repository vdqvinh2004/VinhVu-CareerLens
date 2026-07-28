import "server-only";

import { toJSONSchema } from "zod";

import type {
  ModelProvider,
  ModelProviderEvent,
  ModelProviderRequest,
  ModelProviderResponse,
  ModelUsage,
} from "../agent/provider";
import type {
  AgentMessageItem,
  AgentModelItem,
  AgentToolCallItem,
  AgentToolResultItem,
} from "../agent/types";

export const FPT_RESPONSES_ENDPOINT =
  "https://mkp-api.fptcloud.com/v1/responses";
export const DEFAULT_FPT_MAX_OUTPUT_TOKENS = 4_096;
export const DEFAULT_FPT_MAX_RESPONSE_BYTES = 4 * 1_024 * 1_024;
export const DEFAULT_FPT_MAX_STREAM_BUFFER_BYTES = 256 * 1_024;
export const DEFAULT_FPT_MAX_STREAM_TEXT_CHARS = 256 * 1_024;
export const DEFAULT_FPT_MAX_FUNCTION_ARGUMENTS_CHARS = 64 * 1_024;

type Fetch = typeof fetch;

export type FptResponsesProviderOptions = {
  apiKey: string;
  endpoint?: string;
  fetch?: Fetch;
  maxResponseBytes?: number;
  maxStreamBufferBytes?: number;
  maxStreamTextChars?: number;
  maxFunctionArgumentsChars?: number;
};

export class FptResponsesError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "FptResponsesError";
  }
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function object(value: unknown, context: string): JsonObject {
  if (!isObject(value)) {
    throw new FptResponsesError(`Malformed FPT ${context}`);
  }
  return value;
}

function string(value: unknown, context: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new FptResponsesError(`Malformed FPT ${context}`);
  }
  return value;
}

function integer(value: unknown, context: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new FptResponsesError(`Malformed FPT ${context}`);
  }
  return value as number;
}

function positiveInteger(value: number, context: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new FptResponsesError(`${context} must be a positive safe integer`);
  }
  return value;
}

function array(value: unknown, context: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new FptResponsesError(`Malformed FPT ${context}`);
  }
  return value;
}

function parseJson(text: string, context: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (cause) {
    throw new FptResponsesError(`Malformed FPT ${context} JSON`, { cause });
  }
}

function serializeJson(value: unknown, context: string): string {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) {
      throw new TypeError("Value is not JSON serializable");
    }
    return serialized;
  } catch (cause) {
    throw new FptResponsesError(`Cannot serialize ${context}`, { cause });
  }
}

function serializeToolOutput(item: AgentToolResultItem): string {
  if (item.isError) {
    return serializeJson({ error: true, output: item.output }, "tool error output");
  }
  return typeof item.output === "string"
    ? item.output
    : serializeJson(item.output, "tool output");
}

function mapInputItem(item: AgentModelItem): JsonObject {
  switch (item.type) {
    case "message":
      return { role: item.role, content: item.text };
    case "tool.call":
      return {
        type: "function_call",
        call_id: item.id,
        name: item.name,
        arguments: serializeJson(item.arguments, `arguments for ${item.name}`),
      };
    case "tool.result":
      return {
        type: "function_call_output",
        call_id: item.callId,
        output: serializeToolOutput(item),
      };
    default:
      throw new FptResponsesError("Unsupported canonical model input item");
  }
}

export function buildFptResponsesRequest(
  request: ModelProviderRequest,
  stream: boolean,
): JsonObject {
  if (!request.model || !Number.isFinite(request.timeoutMs) || request.timeoutMs <= 0) {
    throw new FptResponsesError("Invalid model provider request");
  }

  const body: JsonObject = {
    model: request.model,
    input: request.input.map(mapInputItem),
    store: false,
    stream,
  };

  if (request.tools) {
    body.tools = request.tools.map((tool) => {
      const parameters = {
        ...toJSONSchema(tool.inputSchema, {
          target: "draft-07",
          io: "input",
          unrepresentable: "throw",
          cycles: "throw",
          reused: "inline",
        }),
      };
      delete parameters.$schema;
      return {
        type: "function",
        name: tool.name,
        description: tool.description,
        parameters,
      };
    });
  }
  if (request.toolChoice) body.tool_choice = request.toolChoice;
  body.max_output_tokens = positiveInteger(
    request.maxOutputTokens ?? DEFAULT_FPT_MAX_OUTPUT_TOKENS,
    "maxOutputTokens",
  );

  return body;
}

function parseUsage(value: unknown): ModelUsage {
  const usage = object(value, "usage");
  return {
    inputTokens: integer(usage.input_tokens, "usage.input_tokens"),
    outputTokens: integer(usage.output_tokens, "usage.output_tokens"),
    totalTokens: integer(usage.total_tokens, "usage.total_tokens"),
  };
}

function parseToolCall(value: unknown): AgentToolCallItem {
  const item = object(value, "function_call item");
  if (item.type !== "function_call") {
    throw new FptResponsesError("Malformed FPT function_call item type");
  }
  const callId = string(item.call_id, "function_call.call_id");
  return {
    type: "tool.call",
    id: callId,
    name: string(item.name, "function_call.name"),
    arguments: parseJson(
      string(item.arguments, `function_call ${callId} arguments`),
      `function_call ${callId} arguments`,
    ),
  };
}

function parseMessage(value: unknown): AgentMessageItem {
  const item = object(value, "message item");
  if (item.type !== "message" || item.role !== "assistant") {
    throw new FptResponsesError("Malformed FPT assistant message item");
  }
  const id = string(item.id, "message.id");
  let text = "";
  for (const rawPart of array(item.content, `message ${id} content`)) {
    const part = object(rawPart, `message ${id} content part`);
    if (part.type !== "output_text") {
      throw new FptResponsesError(
        `Unsupported FPT message content type ${String(part.type)}`,
      );
    }
    if (typeof part.text !== "string") {
      throw new FptResponsesError(`Malformed FPT message ${id} text`);
    }
    text += part.text;
  }
  return { type: "message", id, role: "assistant", text };
}

function parseOutputItem(
  value: unknown,
): AgentMessageItem | AgentToolCallItem | undefined {
  const item = object(value, "output item");
  if (item.type === "message") return parseMessage(item);
  if (item.type === "function_call") return parseToolCall(item);
  if (item.type === "reasoning") {
    string(item.id, "reasoning item id");
    return undefined;
  }
  throw new FptResponsesError(`Unsupported FPT output item type ${String(item.type)}`);
}

export function parseFptResponse(value: unknown): ModelProviderResponse {
  const response = object(value, "response");
  if (response.object !== "response" || response.status !== "completed") {
    throw new FptResponsesError("FPT response did not complete successfully");
  }
  const items = array(response.output, "response.output")
    .map(parseOutputItem)
    .filter((item) => item !== undefined);
  return { items, usage: parseUsage(response.usage) };
}

type SseMessage = { event?: string; data: string };

class SseDecoder {
  private readonly decoder = new TextDecoder("utf-8", { fatal: true });
  private buffer = new Uint8Array();
  private event: string | undefined;
  private eventBytes = 0;
  private data: string[] = [];
  private dataBytes = 0;
  private finished = false;

  constructor(private readonly maxBufferedBytes: number) {}

  push(chunk: Uint8Array): SseMessage[] {
    if (this.finished) throw new FptResponsesError("FPT SSE decoder already finished");
    try {
      this.append(chunk);
      return this.readLines(false);
    } catch (cause) {
      if (cause instanceof FptResponsesError) throw cause;
      throw new FptResponsesError("Invalid UTF-8 in FPT SSE stream", { cause });
    }
  }

  finish(): SseMessage[] {
    if (this.finished) return [];
    this.finished = true;
    try {
      const messages = this.readLines(true);
      if (this.buffer.byteLength > 0) {
        this.readLine(this.buffer, messages);
        this.buffer = new Uint8Array();
      }
      this.dispatch(messages);
      return messages;
    } catch (cause) {
      if (cause instanceof FptResponsesError) throw cause;
      throw new FptResponsesError("Invalid FPT SSE stream at EOF", { cause });
    }
  }

  private readLines(atEof: boolean): SseMessage[] {
    const messages: SseMessage[] = [];
    let offset = 0;
    while (true) {
      let boundary = -1;
      let width = 1;
      for (let index = offset; index < this.buffer.length; index += 1) {
        if (this.buffer[index] === 0x0a) {
          boundary = index;
          break;
        }
        if (this.buffer[index] === 0x0d) {
          if (index + 1 === this.buffer.length && !atEof) break;
          boundary = index;
          width = this.buffer[index + 1] === 0x0a ? 2 : 1;
          break;
        }
      }
      if (boundary === -1) break;
      const line = this.buffer.subarray(offset, boundary);
      offset = boundary + width;
      this.readLine(line, messages);
    }
    if (offset > 0) this.buffer = this.buffer.slice(offset);
    this.assertBufferedSize();
    return messages;
  }

  private readLine(lineBytes: Uint8Array, messages: SseMessage[]): void {
    if (lineBytes.byteLength === 0) {
      this.dispatch(messages);
      return;
    }
    const line = this.decoder.decode(lineBytes);
    if (line.startsWith(":")) return;
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    let value = separator === -1 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") {
      this.event = value;
      this.eventBytes = lineBytes.byteLength;
    }
    if (field === "data") {
      this.data.push(value);
      this.dataBytes += lineBytes.byteLength;
    }
    this.assertEventDataSize();
  }

  private dispatch(messages: SseMessage[]): void {
    if (this.data.length > 0) {
      messages.push({ event: this.event, data: this.data.join("\n") });
    }
    this.event = undefined;
    this.eventBytes = 0;
    this.data = [];
    this.dataBytes = 0;
  }

  private append(chunk: Uint8Array): void {
    if (this.buffer.byteLength === 0) {
      this.buffer = new Uint8Array(chunk);
      return;
    }
    const combined = new Uint8Array(this.buffer.byteLength + chunk.byteLength);
    combined.set(this.buffer);
    combined.set(chunk, this.buffer.byteLength);
    this.buffer = combined;
  }

  private assertEventDataSize(): void {
    if (this.eventBytes + this.dataBytes > this.maxBufferedBytes) {
      throw new FptResponsesError("FPT SSE buffered event data exceeds the allowed size");
    }
  }

  private assertBufferedSize(): void {
    if (
      this.eventBytes + this.dataBytes + this.buffer.byteLength >
      this.maxBufferedBytes
    ) {
      throw new FptResponsesError("FPT SSE buffered event data exceeds the allowed size");
    }
  }
}

type PendingCall = {
  itemId: string;
  name?: string;
  arguments: string;
  argumentsDone: boolean;
  emitted?: AgentToolCallItem;
};

type OutputItemType = "message" | "function_call" | "reasoning";

type OutputItemState = {
  type: OutputItemType;
  done: boolean;
};

class ResponsesStreamProcessor {
  private readonly calls = new Map<string, PendingCall>();
  private readonly items = new Map<string, OutputItemState>();
  private readonly text = new Map<string, string>();
  private assistantTextChars = 0;
  private functionArgumentsChars = 0;
  private completed = false;

  constructor(
    private readonly maxTextChars: number,
    private readonly maxArgumentsChars: number,
  ) {}

  process(message: SseMessage): ModelProviderEvent[] {
    if (message.data === "[DONE]") {
      if (!this.completed) throw new FptResponsesError("FPT SSE ended before response.completed");
      return [];
    }
    const raw = object(parseJson(message.data, "SSE event"), "SSE event");
    const type = string(raw.type, "SSE event type");
    if (message.event && message.event !== type) {
      throw new FptResponsesError(
        `FPT SSE event name ${message.event} does not match ${type}`,
      );
    }
    if (this.completed) {
      throw new FptResponsesError(`FPT SSE event ${type} received after completion`);
    }

    switch (type) {
      case "response.created":
      case "response.in_progress":
        object(raw.response, `${type}.response`);
        return [];
      case "response.output_item.added":
        return this.addOutputItem(raw);
      case "response.content_part.added":
        return this.addContentPart(raw);
      case "response.output_text.delta":
        return this.textDelta(raw);
      case "response.output_text.done":
        return this.textDone(raw);
      case "response.output_text.annotation.added":
        string(raw.item_id, "output_text.annotation.added.item_id");
        object(raw.annotation, "output_text.annotation.added.annotation");
        return [];
      case "response.content_part.done":
        return this.contentPartDone(raw);
      case "response.function_call_arguments.delta":
        return this.callArgumentsDelta(raw);
      case "response.function_call_arguments.done":
        return this.callArgumentsDone(raw);
      case "response.output_item.done":
        return this.outputItemDone(raw);
      case "response.completed":
        return this.responseCompleted(raw);
      case "response.failed":
      case "response.incomplete":
      case "error":
        throw new FptResponsesError(`FPT stream terminated with ${type}`);
      default:
        if (type === "response.reasoning_summary_part.added") {
          return this.suppressReasoningPart(raw, "added");
        }
        if (type === "response.reasoning_summary_part.done") {
          return this.suppressReasoningPart(raw, "done");
        }
        if (type === "response.reasoning_summary_text.delta") {
          return this.suppressReasoningText(raw, "delta");
        }
        if (type === "response.reasoning_summary_text.done") {
          return this.suppressReasoningText(raw, "text");
        }
        if (type === "response.reasoning_text.delta") {
          return this.suppressReasoningText(raw, "delta");
        }
        if (type === "response.reasoning_text.done") {
          return this.suppressReasoningText(raw, "text");
        }
        throw new FptResponsesError(`Unsupported FPT SSE event type ${type}`);
    }
  }

  finish(): void {
    if (!this.completed) {
      throw new FptResponsesError("FPT SSE stream ended without response.completed");
    }
  }

  private addOutputItem(event: JsonObject): ModelProviderEvent[] {
    const item = object(event.item, "output_item.added.item");
    if (item.type === "message") {
      if (item.role !== "assistant") {
        throw new FptResponsesError("FPT output message is not from assistant");
      }
      this.registerItem(string(item.id, "output message id"), "message");
      return [];
    }
    if (item.type === "function_call") {
      const callId = string(item.call_id, "function call ID");
      const itemId = string(item.id, "function call item ID");
      this.registerItem(itemId, "function_call");
      this.registerCall(callId, itemId, item.name);
      if (typeof item.arguments === "string" && item.arguments) {
        this.appendCallArguments(this.calls.get(callId)!, item.arguments);
      }
      return [];
    }
    if (item.type === "reasoning") {
      this.registerItem(string(item.id, "reasoning item id"), "reasoning");
      return [];
    }
    throw new FptResponsesError(`Unsupported FPT output item type ${String(item.type)}`);
  }

  private addContentPart(event: JsonObject): ModelProviderEvent[] {
    const part = object(event.part, "content_part.added.part");
    if (part.type !== "output_text" || typeof part.text !== "string") {
      throw new FptResponsesError(
        `Unsupported FPT content part type ${String(part.type)}`,
      );
    }
    const itemId = string(event.item_id, "content_part.added.item_id");
    this.requireItem(itemId, "message", "content_part.added");
    if (!part.text) return [];
    this.appendText(itemId, part.text);
    return [{ type: "text.delta", itemId, delta: part.text }];
  }

  private textDelta(event: JsonObject): ModelProviderEvent[] {
    const itemId = string(event.item_id, "output_text.delta.item_id");
    if (typeof event.delta !== "string") {
      throw new FptResponsesError("Malformed FPT output_text.delta.delta");
    }
    const item = this.requireTextItem(itemId, "output_text.delta");
    if (item.type === "reasoning") return [];
    this.appendText(itemId, event.delta);
    return event.delta ? [{ type: "text.delta", itemId, delta: event.delta }] : [];
  }

  private textDone(event: JsonObject): ModelProviderEvent[] {
    const itemId = string(event.item_id, "output_text.done.item_id");
    if (typeof event.text !== "string") {
      throw new FptResponsesError("Malformed FPT output_text.done.text");
    }
    const item = this.requireTextItem(itemId, "output_text.done");
    if (item.type === "reasoning") return [];
    return this.completeText(itemId, event.text);
  }

  private contentPartDone(event: JsonObject): ModelProviderEvent[] {
    const itemId = string(event.item_id, "content_part.done.item_id");
    const part = object(event.part, "content_part.done.part");
    if (part.type !== "output_text" || typeof part.text !== "string") {
      throw new FptResponsesError(
        `Unsupported FPT content part type ${String(part.type)}`,
      );
    }
    this.requireItem(itemId, "message", "content_part.done");
    return this.completeText(itemId, part.text);
  }

  private completeText(itemId: string, finalText: string): ModelProviderEvent[] {
    const accumulated = this.text.get(itemId);
    if (accumulated === undefined) {
      this.appendText(itemId, finalText);
      return finalText ? [{ type: "text.delta", itemId, delta: finalText }] : [];
    }
    if (
      this.assistantTextChars - accumulated.length + finalText.length >
      this.maxTextChars
    ) {
      throw new FptResponsesError("FPT streamed assistant text exceeds the allowed size");
    }
    if (accumulated !== finalText) {
      throw new FptResponsesError(`FPT text for item ${itemId} changed at completion`);
    }
    return [];
  }

  private callArgumentsDelta(event: JsonObject): ModelProviderEvent[] {
    const { callId, call } = this.requireEventCall(
      event,
      "function_call_arguments.delta",
    );
    if (typeof event.delta !== "string") {
      throw new FptResponsesError("Malformed FPT function arguments delta");
    }
    if (call.argumentsDone || call.emitted) {
      throw new FptResponsesError(`FPT arguments received after call ${callId} completed`);
    }
    this.appendCallArguments(call, event.delta);
    return [];
  }

  private callArgumentsDone(event: JsonObject): ModelProviderEvent[] {
    const { callId, call } = this.requireEventCall(
      event,
      "function_call_arguments.done",
      event.name,
    );
    if (call.argumentsDone || call.emitted) {
      throw new FptResponsesError(`FPT arguments for call ${callId} completed twice`);
    }
    const finalArguments = string(
      event.arguments,
      `function_call_arguments.done ${callId}.arguments`,
    );
    this.assertFinalArgumentsSize(call, finalArguments);
    if (call.arguments && call.arguments !== finalArguments) {
      throw new FptResponsesError(`FPT arguments for call ${callId} changed at completion`);
    }
    if (!call.arguments) this.appendCallArguments(call, finalArguments);
    parseJson(call.arguments, `function call ${callId} arguments`);
    call.argumentsDone = true;
    return [];
  }

  private outputItemDone(event: JsonObject): ModelProviderEvent[] {
    const item = object(event.item, "output_item.done.item");
    if (item.type === "message") {
      const message = parseMessage(item);
      this.completeItem(message.id, "message");
      return this.completeText(message.id, message.text);
    }
    if (item.type === "function_call") {
      const itemId = string(item.id, "function_call item id");
      const callId = string(item.call_id, "function_call.call_id");
      const name = string(item.name, "function_call.name");
      const call = this.requireCall(callId, itemId, name);
      const finalArguments = string(item.arguments, `function_call ${callId}.arguments`);
      this.assertFinalArgumentsSize(call, finalArguments);
      if (call.arguments && call.arguments !== finalArguments) {
        throw new FptResponsesError(`FPT arguments for call ${callId} changed at completion`);
      }
      if (!call.arguments) this.appendCallArguments(call, finalArguments);
      parseJson(finalArguments, `function_call ${callId} arguments`);
      this.completeItem(itemId, "function_call");
      return this.emitCall(callId, call);
    }
    if (item.type === "reasoning") {
      this.completeItem(string(item.id, "reasoning item id"), "reasoning");
      return [];
    }
    throw new FptResponsesError(`Unsupported FPT output item type ${String(item.type)}`);
  }

  private responseCompleted(event: JsonObject): ModelProviderEvent[] {
    const response = object(event.response, "response.completed.response");
    if (response.status !== "completed") {
      throw new FptResponsesError("FPT response.completed has non-completed status");
    }

    // Some FPT models return only lifecycle SSE events and place the complete
    // message or function call in response.completed instead of delta events.
    if (this.items.size === 0 && this.calls.size === 0 && this.text.size === 0) {
      const completed = parseFptResponse(response);
      const events: ModelProviderEvent[] = [];
      for (const item of completed.items) {
        if (item.type === "message") {
          this.assistantTextChars += item.text.length;
          if (this.assistantTextChars > this.maxTextChars) {
            throw new FptResponsesError(
              "FPT streamed assistant text exceeds the allowed size",
            );
          }
          if (item.text) {
            events.push({ type: "text.delta", itemId: item.id, delta: item.text });
          }
        } else {
          const argumentChars = JSON.stringify(item.arguments).length;
          this.functionArgumentsChars += argumentChars;
          if (this.functionArgumentsChars > this.maxArgumentsChars) {
            throw new FptResponsesError(
              "FPT streamed function arguments exceed the allowed size",
            );
          }
          events.push({ type: "tool.call", item });
        }
      }
      this.completed = true;
      events.push({ type: "usage", usage: completed.usage });
      return events;
    }

    for (const [callId, call] of this.calls) {
      if (!call.emitted) {
        throw new FptResponsesError(`FPT call ${callId} was not completed`);
      }
    }
    for (const [itemId, item] of this.items) {
      if (!item.done) {
        throw new FptResponsesError(`FPT output item ${itemId} was not completed`);
      }
    }
    this.completed = true;
    return [{ type: "usage", usage: parseUsage(response.usage) }];
  }

  private suppressReasoningPart(
    event: JsonObject,
    state: "added" | "done",
  ): ModelProviderEvent[] {
    const itemId = string(event.item_id, `reasoning_summary_part.${state}.item_id`);
    this.requireItem(itemId, "reasoning", `reasoning_summary_part.${state}`);
    object(event.part, `reasoning_summary_part.${state}.part`);
    return [];
  }

  private suppressReasoningText(
    event: JsonObject,
    field: "delta" | "text",
  ): ModelProviderEvent[] {
    const itemId = string(event.item_id, `reasoning text ${field}.item_id`);
    this.requireItem(itemId, "reasoning", `reasoning text ${field}`);
    if (typeof event[field] !== "string") {
      throw new FptResponsesError(`Malformed FPT reasoning text ${field}`);
    }
    return [];
  }

  private registerCall(callId: string, itemId: string, rawName?: unknown): PendingCall {
    const name = rawName === undefined ? undefined : string(rawName, `call ${callId} name`);
    const existing = this.calls.get(callId);
    if (existing) {
      if (existing.itemId !== itemId || (name && existing.name && existing.name !== name)) {
        throw new FptResponsesError(`Inconsistent identity for FPT call ${callId}`);
      }
      if (name) existing.name = name;
      return existing;
    }
    const call = { itemId, name, arguments: "", argumentsDone: false };
    this.calls.set(callId, call);
    return call;
  }

  private requireCall(
    callId: string,
    itemId: string,
    rawName?: unknown,
  ): PendingCall {
    const call = this.calls.get(callId);
    if (!call) {
      throw new FptResponsesError(`FPT call ${callId} was not registered`);
    }
    const name = rawName === undefined ? undefined : string(rawName, `call ${callId} name`);
    if (call.itemId !== itemId || (name && call.name && call.name !== name)) {
      throw new FptResponsesError(`Inconsistent identity for FPT call ${callId}`);
    }
    if (name) call.name = name;
    return call;
  }

  private requireEventCall(
    event: JsonObject,
    context: string,
    rawName?: unknown,
  ): { callId: string; call: PendingCall } {
    const itemId = string(event.item_id, `${context}.item_id`);
    this.requireItem(itemId, "function_call", context);

    let callId: string;
    if (event.call_id === undefined) {
      const matches = [...this.calls.entries()].filter(
        ([, candidate]) => candidate.itemId === itemId,
      );
      if (matches.length !== 1) {
        throw new FptResponsesError(
          `${context} could not resolve a unique call for item ${itemId}`,
        );
      }
      callId = matches[0]![0];
    } else {
      callId = string(event.call_id, `${context}.call_id`);
    }

    return { callId, call: this.requireCall(callId, itemId, rawName) };
  }

  private registerItem(itemId: string, type: OutputItemType): void {
    if (this.items.has(itemId)) {
      throw new FptResponsesError(`FPT output item ${itemId} was registered twice`);
    }
    this.items.set(itemId, { type, done: false });
  }

  private requireItem(
    itemId: string,
    type: OutputItemType,
    event: string,
  ): OutputItemState {
    const item = this.items.get(itemId);
    if (!item) {
      throw new FptResponsesError(`${event} received before output item ${itemId} registration`);
    }
    if (item.type !== type) {
      throw new FptResponsesError(`${event} is invalid for FPT ${item.type} item ${itemId}`);
    }
    if (item.done) {
      throw new FptResponsesError(`${event} received after output item ${itemId} completed`);
    }
    return item;
  }

  private requireTextItem(itemId: string, event: string): OutputItemState {
    const item = this.items.get(itemId);
    if (!item) {
      throw new FptResponsesError(`${event} received before output item ${itemId} registration`);
    }
    if (item.type !== "message" && item.type !== "reasoning") {
      throw new FptResponsesError(`${event} is invalid for FPT ${item.type} item ${itemId}`);
    }
    if (item.done) {
      throw new FptResponsesError(`${event} received after output item ${itemId} completed`);
    }
    return item;
  }

  private completeItem(itemId: string, type: OutputItemType): void {
    const item = this.requireItem(itemId, type, "output_item.done");
    item.done = true;
  }

  private emitCall(callId: string, call: PendingCall): ModelProviderEvent[] {
    const name = call.name;
    if (!name) throw new FptResponsesError(`FPT call ${callId} has no name`);
    const parsed: AgentToolCallItem = {
      type: "tool.call",
      id: callId,
      name,
      arguments: parseJson(call.arguments, `function call ${callId} arguments`),
    };
    if (call.emitted) {
      if (
        call.emitted.name !== parsed.name ||
        serializeJson(call.emitted.arguments, "completed call arguments") !==
          serializeJson(parsed.arguments, "completed call arguments")
      ) {
        throw new FptResponsesError(`FPT call ${callId} changed after completion`);
      }
      return [];
    }
    call.emitted = parsed;
    return [{ type: "tool.call", item: parsed }];
  }

  private appendText(itemId: string, delta: string): void {
    if (this.assistantTextChars + delta.length > this.maxTextChars) {
      throw new FptResponsesError("FPT streamed assistant text exceeds the allowed size");
    }
    this.assistantTextChars += delta.length;
    this.text.set(itemId, (this.text.get(itemId) ?? "") + delta);
  }

  private appendCallArguments(call: PendingCall, delta: string): void {
    if (this.functionArgumentsChars + delta.length > this.maxArgumentsChars) {
      throw new FptResponsesError("FPT streamed function arguments exceed the allowed size");
    }
    this.functionArgumentsChars += delta.length;
    call.arguments += delta;
  }

  private assertFinalArgumentsSize(call: PendingCall, finalArguments: string): void {
    if (
      this.functionArgumentsChars - call.arguments.length + finalArguments.length >
      this.maxArgumentsChars
    ) {
      throw new FptResponsesError("FPT streamed function arguments exceed the allowed size");
    }
  }
}

function composeSignal(signal: AbortSignal, timeoutMs: number): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  if (signal.aborted) abort();
  else signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(
    () => controller.abort(new DOMException("FPT request timed out", "TimeoutError")),
    timeoutMs,
  );
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    },
  };
}

async function readBodyText(
  response: Response,
  signal: AbortSignal,
  maxBytes: number,
): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytesRead = 0;

  const read = async (): Promise<ReadableStreamReadResult<Uint8Array>> => {
    if (signal.aborted) throw signal.reason;
    return await new Promise((resolve, reject) => {
      const onAbort = () => {
        void reader.cancel(signal.reason).catch(() => undefined);
        reject(signal.reason);
      };
      signal.addEventListener("abort", onAbort, { once: true });
      reader.read().then(resolve, reject).finally(() => {
        signal.removeEventListener("abort", onAbort);
      });
    });
  };

  try {
    while (true) {
      const { done, value } = await read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        const error = new FptResponsesError("FPT response body exceeds the allowed size");
        try {
          await reader.cancel(error);
        } catch {
          // Preserve the bounded-read error if cancellation itself fails.
        }
        throw error;
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

async function responseError(
  response: Response,
  signal: AbortSignal,
  maxBytes: number,
): Promise<FptResponsesError> {
  let detail = "";
  try {
    detail = (await readBodyText(response, signal, maxBytes))
      .slice(0, 500)
      .replace(/\s+/g, " ")
      .trim();
  } catch (cause) {
    if (signal.aborted) throw cause;
    // The status remains sufficient if the provider body cannot be read.
  }
  return new FptResponsesError(
    `FPT Responses API returned ${response.status}${detail ? `: ${detail}` : ""}`,
  );
}

export class FptResponsesProvider implements ModelProvider {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly fetch: Fetch;
  private readonly maxResponseBytes: number;
  private readonly maxStreamBufferBytes: number;
  private readonly maxStreamTextChars: number;
  private readonly maxFunctionArgumentsChars: number;

  constructor(options: FptResponsesProviderOptions) {
    if (!options.apiKey) throw new FptResponsesError("FPT API key is required");
    this.apiKey = options.apiKey;
    this.endpoint = options.endpoint ?? FPT_RESPONSES_ENDPOINT;
    this.fetch = options.fetch ?? globalThis.fetch;
    this.maxResponseBytes = positiveInteger(
      options.maxResponseBytes ?? DEFAULT_FPT_MAX_RESPONSE_BYTES,
      "maxResponseBytes",
    );
    this.maxStreamBufferBytes = positiveInteger(
      options.maxStreamBufferBytes ?? DEFAULT_FPT_MAX_STREAM_BUFFER_BYTES,
      "maxStreamBufferBytes",
    );
    this.maxStreamTextChars = positiveInteger(
      options.maxStreamTextChars ?? DEFAULT_FPT_MAX_STREAM_TEXT_CHARS,
      "maxStreamTextChars",
    );
    this.maxFunctionArgumentsChars = positiveInteger(
      options.maxFunctionArgumentsChars ?? DEFAULT_FPT_MAX_FUNCTION_ARGUMENTS_CHARS,
      "maxFunctionArgumentsChars",
    );
  }

  async generate(request: ModelProviderRequest): Promise<ModelProviderResponse> {
    const pending = await this.request(request, false);
    try {
      return parseFptResponse(
        parseJson(
          await readBodyText(
            pending.response,
            pending.signal,
            this.maxResponseBytes,
          ),
          "response",
        ),
      );
    } finally {
      pending.cleanup();
    }
  }

  async *stream(request: ModelProviderRequest): AsyncIterable<ModelProviderEvent> {
    const pending = await this.request(request, true);
    try {
      if (!pending.response.body) {
        throw new FptResponsesError("FPT streaming response has no body");
      }
      const decoder = new SseDecoder(this.maxStreamBufferBytes);
      const processor = new ResponsesStreamProcessor(
        this.maxStreamTextChars,
        this.maxFunctionArgumentsChars,
      );
      const reader = pending.response.body.getReader();
      let bytesRead = 0;
      let streamFinished = false;
      let streamError: unknown;
      try {
        while (true) {
          const { done, value } = await this.readStreamChunk(reader, pending.signal);
          if (done) break;
          if (value.byteLength > this.maxResponseBytes - bytesRead) {
            throw new FptResponsesError("FPT SSE stream exceeds the allowed size");
          }
          bytesRead += value.byteLength;
          for (const message of decoder.push(value)) {
            yield* processor.process(message);
          }
        }
        for (const message of decoder.finish()) {
          yield* processor.process(message);
        }
        processor.finish();
        streamFinished = true;
      } catch (error) {
        streamError = error;
        throw error;
      } finally {
        if (!streamFinished) {
          try {
            await reader.cancel(streamError);
          } catch {
            // Preserve the protocol or cancellation error that ended iteration.
          }
        }
        reader.releaseLock();
      }
    } finally {
      pending.cleanup();
    }
  }

  private async request(
    request: ModelProviderRequest,
    stream: boolean,
  ): Promise<{ response: Response; signal: AbortSignal; cleanup: () => void }> {
    const composed = composeSignal(request.signal, request.timeoutMs);
    let response: Response;
    try {
      response = await this.fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: stream ? "text/event-stream" : "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: serializeJson(buildFptResponsesRequest(request, stream), "FPT request"),
        signal: composed.signal,
      });
    } catch (cause) {
      composed.cleanup();
      throw cause;
    }
    if (!response.ok) {
      try {
        throw await responseError(response, composed.signal, this.maxResponseBytes);
      } finally {
        composed.cleanup();
      }
    }
    return { response, signal: composed.signal, cleanup: composed.cleanup };
  }

  private async readStreamChunk(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    signal: AbortSignal,
  ): Promise<ReadableStreamReadResult<Uint8Array>> {
    if (signal.aborted) throw signal.reason;
    return await new Promise((resolve, reject) => {
      const onAbort = () => {
        void reader.cancel(signal.reason).catch(() => undefined);
        reject(signal.reason);
      };
      signal.addEventListener("abort", onAbort, { once: true });
      reader.read().then(resolve, reject).finally(() => {
        signal.removeEventListener("abort", onAbort);
      });
    });
  }
}
