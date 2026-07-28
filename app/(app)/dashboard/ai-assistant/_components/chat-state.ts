import type { AgentEvent, SourceAvailableEvent } from "@/lib/ai/agent/schemas";
import type { PersistedAgentMessage } from "@/lib/ai/agent/lifecycle";

export type PublicSource = SourceAvailableEvent["source"];

export type PublicCitation = {
  ordinal: number;
  sourceId: string;
  quote: string;
};

export type PublicRunMetadata = {
  id: string;
  clientRequestId: string;
  forceWeb: boolean;
  status: "pending" | "running" | "completed" | "cancelled" | "failed";
  error: {
    code: string;
    message: string;
    retryable: boolean;
  } | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
};

export type FailureKind = "local_cancel" | "typed_terminal" | "transport";

export type PublicMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model: string | null;
  clientRequestId: string | null;
  status: "pending" | "streaming" | "completed" | "cancelled" | "failed";
  failureKind: FailureKind | null;
  run: PublicRunMetadata | null;
  sources: PublicSource[];
  citations: PublicCitation[];
};

const NON_RETRYABLE_RUN_ERRORS = new Set([
  "force_web_not_used",
  "force_web_unavailable",
  "private_web_forbidden",
]);

export function isSafePublicUrl(value: string) {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function isActiveMessage(message: Pick<PublicMessage, "run" | "status">) {
  return (
    message.status === "pending" ||
    message.status === "streaming" ||
    message.run?.status === "pending" ||
    message.run?.status === "running"
  );
}

export type ResearchPhase = "thinking" | "searching" | "reading" | "synthesizing";

export type UIMessage = PublicMessage & {
  localId: string;
  runId?: string;
  phase?: ResearchPhase;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
};

export type CitationTextPart =
  | { type: "text"; value: string }
  | { type: "citation"; marker: string; citation: PublicCitation; source: PublicSource };

export function mapPersistedMessagesToPublic(
  messages: readonly PersistedAgentMessage[],
): PublicMessage[] {
  return messages.map((message) => {
    const sourceKeysById = new Map(
      message.sources.flatMap((source) =>
        isSafePublicUrl(source.url) ? [[source.id, source.sourceKey] as const] : [],
      ),
    );

    return {
      id: message.id,
      role: message.role,
      content: message.content,
      model: message.model,
      clientRequestId: message.clientRequestId ?? message.run?.clientRequestId ?? null,
      status: message.status,
      failureKind:
        message.status === "failed" && message.run?.status === "failed"
          ? "typed_terminal" as const
          : null,
      run: message.run
        ? {
            id: message.run.id,
            clientRequestId: message.run.clientRequestId,
            forceWeb: message.run.forceWeb,
            status: message.run.status,
            error: message.run.status === "failed"
              ? {
                  code: message.run.errorCode ?? "agent_failed",
                  message:
                    message.run.errorMessage ??
                    "The assistant could not complete this request.",
                  retryable: !NON_RETRYABLE_RUN_ERRORS.has(
                    message.run.errorCode ?? "",
                  ),
                }
              : null,
            createdAt: message.run.createdAt.toISOString(),
            startedAt: message.run.startedAt?.toISOString() ?? null,
            finishedAt: message.run.finishedAt?.toISOString() ?? null,
            updatedAt: message.run.updatedAt.toISOString(),
          }
        : null,
      sources: message.sources.flatMap((source) =>
        isSafePublicUrl(source.url)
          ? [{
              id: source.sourceKey,
              title: source.title,
              url: source.url,
              publishedAt: source.publishedAt?.toISOString() ?? null,
              accessedAt: source.accessedAt.toISOString(),
            }]
          : [],
      ),
      citations: message.citations.flatMap((citation) => {
        const sourceId = sourceKeysById.get(citation.sourceId);
        return sourceId
          ? [{ ordinal: citation.ordinal + 1, sourceId, quote: citation.quote }]
          : [];
      }),
    };
  });
}

export function createUiMessage(message: PublicMessage): UIMessage {
  return {
    ...message,
    localId: message.id,
    runId: message.run?.id,
    error: message.run?.error ?? undefined,
  };
}

export function classifyAbortFailure(
  error: unknown,
  signal: Pick<AbortSignal, "aborted" | "reason">,
): FailureKind | null {
  if (signal.aborted && signal.reason === "user") return "local_cancel";
  return typeof error === "object" && error !== null && "name" in error &&
    error.name === "AbortError"
    ? "transport"
    : null;
}

export function prepareTransportRetry(
  messages: readonly UIMessage[],
  assistantLocalId: string,
): UIMessage[] {
  return messages.map((message) =>
    message.localId === assistantLocalId
      ? {
          ...message,
          id: message.localId,
          content: "",
          status: "pending" as const,
          failureKind: null,
          run: null,
          runId: undefined,
          phase: "thinking" as const,
          error: undefined,
          sources: [],
          citations: [],
        }
      : message,
  );
}

export function resolveRetryClientRequestId(
  message: Pick<UIMessage, "clientRequestId" | "failureKind">,
  createId: () => string,
) {
  return message.failureKind === "transport" && message.clientRequestId
    ? message.clientRequestId
    : createId();
}

export function releaseStaleActiveMessages(
  messages: UIMessage[],
  now: number,
  staleAfterMs: number,
  errorMessage: string,
): UIMessage[] {
  let changed = false;
  const next = messages.map((message) => {
    if (!isActiveMessage(message) || !message.run) return message;
    const updatedAt = Date.parse(message.run.updatedAt);
    if (!Number.isFinite(updatedAt) || now - updatedAt < staleAfterMs) return message;
    changed = true;
    const error = {
      code: "run_incomplete",
      message: errorMessage,
      retryable: true,
    };
    return {
      ...message,
      status: "failed" as const,
      // A new request ID lets the server recover the stale run and create its replacement atomically.
      failureKind: "typed_terminal" as const,
      run: { ...message.run, status: "failed" as const, error },
      phase: undefined,
      error,
    };
  });
  return changed ? next : messages;
}

export function applyAgentEvent(message: UIMessage, event: AgentEvent): UIMessage {
  switch (event.type) {
    case "run.started":
      return {
        ...message,
        id: event.assistantMessageId,
        runId: event.runId,
        status: "streaming",
        failureKind: null,
        phase: "thinking",
        error: undefined,
      };
    case "status":
      return { ...message, runId: event.runId, status: "streaming", phase: event.phase };
    case "source.available":
      return {
        ...message,
        runId: event.runId,
        sources: message.sources.some((source) => source.id === event.source.id)
          ? message.sources
          : [...message.sources, event.source],
      };
    case "text.delta":
      return {
        ...message,
        runId: event.runId,
        id: event.messageId,
        status: "streaming",
        content: message.content + event.delta,
      };
    case "run.completed":
      return {
        ...message,
        runId: event.runId,
        id: event.messageId,
        status: "completed",
        phase: undefined,
        citations: event.citations.map((citation, index) => ({
          ordinal: index + 1,
          ...citation,
        })),
      };
    case "run.cancelled":
      return {
        ...message,
        runId: event.runId,
        id: event.messageId,
        status: "cancelled",
        phase: undefined,
      };
    case "error":
      return {
        ...message,
        runId: event.runId,
        status: "failed",
        failureKind: "typed_terminal",
        phase: undefined,
        error: {
          code: event.code,
          message: event.message,
          retryable: event.retryable,
        },
      };
  }
}

const CITATION_MARKER = /\[(\d+)\]/g;

export function resolveCitationText(
  text: string,
  citations: readonly PublicCitation[],
  sources: readonly PublicSource[],
): CitationTextPart[] {
  const citationsByOrdinal = new Map(citations.map((citation) => [citation.ordinal, citation]));
  const sourcesById = new Map(sources.map((source) => [source.id, source]));
  const parts: CitationTextPart[] = [];
  let cursor = 0;

  for (const match of text.matchAll(CITATION_MARKER)) {
    const index = match.index;
    if (index > cursor) parts.push({ type: "text", value: text.slice(cursor, index) });

    const marker = match[0];
    const citation = citationsByOrdinal.get(Number(match[1]));
    const source = citation ? sourcesById.get(citation.sourceId) : undefined;
    if (citation && source) {
      parts.push({ type: "citation", marker, citation, source });
    } else {
      parts.push({ type: "text", value: marker });
    }
    cursor = index + marker.length;
  }

  if (cursor < text.length) parts.push({ type: "text", value: text.slice(cursor) });
  return parts;
}
