import "server-only";

import { createHash } from "node:crypto";

import {
  and,
  asc,
  desc,
  eq,
  inArray,
  lt,
  or,
  sql,
} from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  agentCitations,
  agentRuns,
  agentSources,
  agentToolCalls,
  chatMessages,
  chatSessions,
  type AgentCitationRecord,
  type AgentRun,
  type AgentRunUsage,
  type AgentSourceRecord,
  type AgentToolCall,
  type ChatMessage,
  type ChatSession,
} from "@/lib/db/schema";

import { TOOL_DATA_CLASSES, type ToolDataClass } from "./tools";

const UNIQUE_VIOLATION_CODE = "23505";
const REQUEST_UNIQUE_CONSTRAINT = "agent_runs_user_client_request_unique";
const ACTIVE_SESSION_UNIQUE_CONSTRAINT = "agent_runs_session_active_unique";
export const DEFAULT_STALE_RUN_THRESHOLD_MS = 5 * 60_000;

type RunStatus = AgentRun["status"];
type TerminalRunStatus = Extract<RunStatus, "completed" | "cancelled" | "failed">;
type MessageStatus = ChatMessage["status"];
type Database = ReturnType<typeof getDb>;
type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DatabaseExecutor = Database | DatabaseTransaction;

export type CreateAgentRunInput = {
  userId: string;
  sessionId: string;
  clientRequestId: string;
  message: string;
  model: string;
  forceWeb?: boolean;
  dataClasses?: readonly ToolDataClass[];
};

export type AgentRunAllocation = {
  kind: "created" | "reconciled";
  run: AgentRun;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
};

export type AgentToolCallInput = {
  id?: string;
  callId: string;
  name: string;
  arguments: unknown;
  result?: unknown;
  status: AgentToolCall["status"];
  errorMessage?: string | null;
  createdAt?: Date;
  startedAt?: Date | null;
  finishedAt?: Date | null;
};

export type AgentSourceInput = {
  sourceKey: string;
  title: string;
  url: string;
  urlHash?: string;
  publishedAt?: Date | string | null;
  accessedAt: Date | string;
};

export type AgentCitationInput = {
  sourceKey: string;
  quote: string;
  supportStatus?: AgentCitationRecord["supportStatus"];
};

export type PersistRunArtifactsInput = {
  toolCalls?: readonly AgentToolCallInput[];
  sources?: readonly AgentSourceInput[];
  citations?: readonly AgentCitationInput[];
};

export type CompleteAgentRunInput = PersistRunArtifactsInput & {
  userId: string;
  runId: string;
  content: string;
  usage?: AgentRunUsage | null;
  dataClasses?: readonly ToolDataClass[];
};

export type FinishAgentRunInput = PersistRunArtifactsInput & {
  content?: string;
  usage?: AgentRunUsage | null;
  dataClasses?: readonly ToolDataClass[];
};

export type PersistedAgentMessage = ChatMessage & {
  run: AgentRun | null;
  sources: AgentSourceRecord[];
  citations: AgentCitationRecord[];
};

export type AgentLifecycleErrorCode =
  | "idempotency_conflict"
  | "model_mismatch"
  | "session_busy"
  | "session_not_found"
  | "state_conflict";

export class AgentLifecycleError extends Error {
  constructor(
    public readonly code: AgentLifecycleErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AgentLifecycleError";
  }
}

type RunBundle = Omit<AgentRunAllocation, "kind">;

type TransitionRunInput = {
  userId: string;
  runId: string;
  from: RunStatus;
  to: Exclude<RunStatus, "pending">;
  now: Date;
  usage?: AgentRunUsage | null;
  toolCallCount?: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  dataClasses?: ToolDataClass[];
};

type UpdateAssistantInput = {
  messageId: string;
  sessionId: string;
  expectedStatus: MessageStatus;
  status: MessageStatus;
  content?: string;
  dataClasses?: ToolDataClass[];
};

type RecoverStaleRunsInput = {
  userId: string;
  sessionId: string;
  staleBefore: Date;
  now: Date;
};

type ResolvedAgentCitationInput = Omit<AgentCitationInput, "sourceKey"> & {
  sourceId: string;
};

export interface AgentLifecycleTransaction {
  findRunByRequest(userId: string, clientRequestId: string): Promise<RunBundle | null>;
  findOwnedRun(userId: string, runId: string): Promise<AgentRun | null>;
  findOwnedSession(userId: string, sessionId: string): Promise<ChatSession | null>;
  findActiveRun(userId: string, sessionId: string): Promise<AgentRun | null>;
  recoverStaleActiveRuns(input: RecoverStaleRunsInput): Promise<AgentRun[]>;
  lockRunningRun(userId: string, runId: string): Promise<AgentRun | null>;
  insertMessages(input: CreateAgentRunInput): Promise<{
    userMessage: ChatMessage;
    assistantMessage: ChatMessage;
  }>;
  insertRun(
    input: CreateAgentRunInput,
    messages: { userMessage: ChatMessage; assistantMessage: ChatMessage },
  ): Promise<AgentRun>;
  touchSession(userId: string, sessionId: string, now: Date): Promise<boolean>;
  transitionRun(input: TransitionRunInput): Promise<AgentRun | null>;
  updateAssistant(input: UpdateAssistantInput): Promise<boolean>;
  insertToolCalls(runId: string, toolCalls: readonly AgentToolCallInput[]): Promise<void>;
  insertSources(
    runId: string,
    sources: readonly AgentSourceInput[],
  ): Promise<ReadonlyMap<string, string>>;
  findSourceIdsByKeys(
    runId: string,
    sourceKeys: readonly string[],
  ): Promise<ReadonlyMap<string, string>>;
  insertCitations(
    run: AgentRun,
    citations: readonly ResolvedAgentCitationInput[],
  ): Promise<void>;
}

export interface AgentLifecycleStore extends AgentLifecycleTransaction {
  transaction<T>(
    operation: (transaction: AgentLifecycleTransaction) => Promise<T>,
  ): Promise<T>;
  loadMessages(
    userId: string,
    sessionId: string,
  ): Promise<PersistedAgentMessage[]>;
  loadContextMessages(
    userId: string,
    sessionId: string,
    limit: number,
  ): Promise<PersistedAgentMessage[]>;
}

export function canTransitionAgentRun(from: RunStatus, to: RunStatus) {
  return (
    (from === "pending" && to === "running") ||
    (from === "pending" && (to === "cancelled" || to === "failed")) ||
    (from === "running" &&
      (to === "completed" || to === "cancelled" || to === "failed"))
  );
}

export function selectNewestHistory<T extends Pick<ChatMessage, "id" | "createdAt">>(
  messages: readonly T[],
  limit = 20,
) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError("History limit must be a positive integer");
  }

  return [...messages]
    .sort((left, right) => {
      const byDate = right.createdAt.getTime() - left.createdAt.getTime();
      return byDate || right.id.localeCompare(left.id);
    })
    .slice(0, limit)
    .reverse();
}

export function isEligibleContextMessage(
  message: Pick<ChatMessage, "role" | "status" | "content">,
) {
  return (
    message.role === "user" ||
    (message.role === "assistant" &&
      message.status === "completed" &&
      message.content.trim().length > 0)
  );
}

export function selectNewestEligibleHistory<
  T extends Pick<ChatMessage, "id" | "createdAt" | "role" | "status" | "content">,
>(messages: readonly T[], limit = 20) {
  return selectNewestHistory(messages.filter(isEligibleContextMessage), limit);
}

function normalizeDataClasses(
  dataClasses: readonly ToolDataClass[] | undefined,
): ToolDataClass[] {
  const values = dataClasses ?? ["public"];
  const normalized = TOOL_DATA_CLASSES.filter((dataClass) =>
    values.includes(dataClass),
  );
  if (
    normalized.length === 0 ||
    values.some((dataClass) => !TOOL_DATA_CLASSES.includes(dataClass))
  ) {
    throw new TypeError("Agent data classes must contain supported values");
  }
  return normalized;
}

function isDatabaseError(
  error: unknown,
  code: string,
  constraint?: string,
) {
  const visited = new Set<unknown>();
  let current = error;

  while (typeof current === "object" && current !== null && !visited.has(current)) {
    visited.add(current);
    const candidate = current as { cause?: unknown; code?: unknown; constraint?: unknown };
    if (
      candidate.code === code &&
      (constraint === undefined || candidate.constraint === constraint)
    ) {
      return true;
    }
    current = candidate.cause;
  }

  return false;
}

function reconcileRun(existing: RunBundle, input: CreateAgentRunInput): AgentRunAllocation {
  if (
    existing.run.sessionId !== input.sessionId ||
    existing.run.model !== input.model ||
    existing.run.forceWeb !== (input.forceWeb ?? false) ||
    existing.userMessage.content !== input.message.trim()
  ) {
    throw new AgentLifecycleError(
      "idempotency_conflict",
      "The client request id was already used with different run input",
    );
  }

  return { kind: "reconciled", ...existing };
}

async function requireSession(
  transaction: AgentLifecycleTransaction,
  input: CreateAgentRunInput,
) {
  const session = await transaction.findOwnedSession(input.userId, input.sessionId);
  if (!session) {
    throw new AgentLifecycleError(
      "session_not_found",
      "The chat session does not exist or is not owned by the user",
    );
  }
  if (session.model !== input.model) {
    throw new AgentLifecycleError(
      "model_mismatch",
      "The requested model does not match the session model",
    );
  }
}

async function persistArtifacts(
  transaction: AgentLifecycleTransaction,
  run: AgentRun,
  input: PersistRunArtifactsInput,
) {
  const sourceIdsByKey = new Map<string, string>();

  if (input.toolCalls?.length) {
    await transaction.insertToolCalls(run.id, input.toolCalls);
  }
  if (input.sources?.length) {
    const insertedSources = await transaction.insertSources(run.id, input.sources);
    for (const [sourceKey, sourceId] of insertedSources) {
      sourceIdsByKey.set(sourceKey, sourceId);
    }
  }
  if (input.citations?.length) {
    const unresolvedSourceKeys = [
      ...new Set(
        input.citations
          .map((citation) => citation.sourceKey)
          .filter((sourceKey) => !sourceIdsByKey.has(sourceKey)),
      ),
    ];
    if (unresolvedSourceKeys.length) {
      const persistedSources = await transaction.findSourceIdsByKeys(
        run.id,
        unresolvedSourceKeys,
      );
      for (const [sourceKey, sourceId] of persistedSources) {
        sourceIdsByKey.set(sourceKey, sourceId);
      }
    }

    const citations = input.citations.map(({ sourceKey, ...citation }) => {
      const sourceId = sourceIdsByKey.get(sourceKey);
      if (!sourceId) {
        throw new AgentLifecycleError(
          "state_conflict",
          `Source ${sourceKey} does not belong to agent run ${run.id}`,
        );
      }
      return { ...citation, sourceId };
    });
    await transaction.insertCitations(run, citations);
  }
}

export class AgentLifecycleRepository {
  constructor(
    private readonly store: AgentLifecycleStore,
    private readonly now: () => Date = () => new Date(),
    private readonly staleRunThresholdMs = DEFAULT_STALE_RUN_THRESHOLD_MS,
  ) {
    if (!Number.isSafeInteger(staleRunThresholdMs) || staleRunThresholdMs < 1) {
      throw new RangeError("Stale run threshold must be a positive integer");
    }
  }

  async createOrReconcile(input: CreateAgentRunInput): Promise<AgentRunAllocation> {
    const normalized = {
      ...input,
      message: input.message.trim(),
      dataClasses: normalizeDataClasses(input.dataClasses),
    };
    if (!normalized.message) {
      throw new TypeError("Agent message must not be empty");
    }

    try {
      return await this.store.transaction(async (transaction) => {
        let existing = await transaction.findRunByRequest(
          normalized.userId,
          normalized.clientRequestId,
        );
        if (existing) {
          const reconciled = reconcileRun(existing, normalized);
          const now = this.now();
          if (
            (existing.run.status === "pending" || existing.run.status === "running") &&
            existing.run.updatedAt < new Date(now.getTime() - this.staleRunThresholdMs)
          ) {
            await transaction.recoverStaleActiveRuns({
              userId: normalized.userId,
              sessionId: normalized.sessionId,
              staleBefore: new Date(now.getTime() - this.staleRunThresholdMs),
              now,
            });
            existing = await transaction.findRunByRequest(
              normalized.userId,
              normalized.clientRequestId,
            );
            if (!existing) {
              throw new AgentLifecycleError(
                "state_conflict",
                "The stale idempotent run could not be reloaded",
              );
            }
            return reconcileRun(existing, normalized);
          }
          return reconciled;
        }

        await requireSession(transaction, normalized);
        const now = this.now();
        await transaction.recoverStaleActiveRuns({
          userId: normalized.userId,
          sessionId: normalized.sessionId,
          staleBefore: new Date(now.getTime() - this.staleRunThresholdMs),
          now,
        });
        const active = await transaction.findActiveRun(
          normalized.userId,
          normalized.sessionId,
        );
        if (active) {
          throw new AgentLifecycleError(
            "session_busy",
            "The chat session already has an active run",
          );
        }

        const messages = await transaction.insertMessages(normalized);
        const run = await transaction.insertRun(normalized, messages);
        const touched = await transaction.touchSession(
          normalized.userId,
          normalized.sessionId,
          now,
        );
        if (!touched) {
          throw new AgentLifecycleError(
            "state_conflict",
            "The chat session could not be refreshed after run allocation",
          );
        }
        return { kind: "created", run, ...messages };
      });
    } catch (error) {
      if (!isDatabaseError(error, UNIQUE_VIOLATION_CODE)) {
        throw error;
      }

      const existing = await this.store.findRunByRequest(
        normalized.userId,
        normalized.clientRequestId,
      );
      if (existing) {
        return reconcileRun(existing, normalized);
      }
      if (
        isDatabaseError(error, UNIQUE_VIOLATION_CODE, ACTIVE_SESSION_UNIQUE_CONSTRAINT) ||
        (await this.store.findActiveRun(normalized.userId, normalized.sessionId))
      ) {
        throw new AgentLifecycleError(
          "session_busy",
          "The chat session already has an active run",
          { cause: error },
        );
      }
      if (isDatabaseError(error, UNIQUE_VIOLATION_CODE, REQUEST_UNIQUE_CONSTRAINT)) {
        throw new AgentLifecycleError(
          "state_conflict",
          "The idempotent run could not be reconciled",
          { cause: error },
        );
      }
      throw error;
    }
  }

  start(userId: string, runId: string) {
    return this.store.transaction(async (transaction) => {
      const run = await transaction.transitionRun({
        userId,
        runId,
        from: "pending",
        to: "running",
        now: this.now(),
      });
      if (!run) return null;

      const updated = await transaction.updateAssistant({
        messageId: run.assistantMessageId,
        sessionId: run.sessionId,
        expectedStatus: "pending",
        status: "streaming",
      });
      if (!updated) {
        throw new AgentLifecycleError(
          "state_conflict",
          "The assistant message was not pending when its run started",
        );
      }
      return run;
    });
  }

  loadRun(userId: string, runId: string) {
    return this.store.findOwnedRun(userId, runId);
  }

  persistAssistantContent(userId: string, runId: string, content: string) {
    return this.store.transaction(async (transaction) => {
      const run = await transaction.lockRunningRun(userId, runId);
      if (!run) return false;
      return transaction.updateAssistant({
        messageId: run.assistantMessageId,
        sessionId: run.sessionId,
        expectedStatus: "streaming",
        status: "streaming",
        content,
      });
    });
  }

  persistArtifacts(
    userId: string,
    runId: string,
    input: PersistRunArtifactsInput,
  ) {
    return this.store.transaction(async (transaction) => {
      const run = await transaction.lockRunningRun(userId, runId);
      if (!run) return false;
      await persistArtifacts(transaction, run, input);
      return true;
    });
  }

  complete(input: CompleteAgentRunInput) {
    return this.store.transaction(async (transaction) => {
      const running = await transaction.lockRunningRun(input.userId, input.runId);
      if (!running) return null;
      const dataClasses = input.dataClasses
        ? normalizeDataClasses(input.dataClasses)
        : running.dataClasses;

      await persistArtifacts(transaction, running, input);
      const run = await transaction.transitionRun({
        userId: input.userId,
        runId: input.runId,
        from: "running",
        to: "completed",
        now: this.now(),
        usage: input.usage,
        toolCallCount: input.toolCalls?.length ?? running.toolCallCount,
        dataClasses,
      });
      if (!run) return null;

      const updated = await transaction.updateAssistant({
        messageId: run.assistantMessageId,
        sessionId: run.sessionId,
        expectedStatus: "streaming",
        status: "completed",
        content: input.content,
        dataClasses,
      });
      if (!updated) {
        throw new AgentLifecycleError(
          "state_conflict",
          "The assistant message was not streaming when its run completed",
        );
      }
      return run;
    });
  }

  cancel(userId: string, runId: string, input: FinishAgentRunInput = {}) {
    return this.finish(userId, runId, "cancelled", input);
  }

  fail(
    userId: string,
    runId: string,
    errorCode: string,
    errorMessage: string,
    input: FinishAgentRunInput = {},
  ) {
    return this.finish(userId, runId, "failed", {
      ...input,
      errorCode,
      errorMessage,
    });
  }

  cancelPending(userId: string, runId: string) {
    return this.finish(userId, runId, "cancelled", {}, "pending");
  }

  failPending(
    userId: string,
    runId: string,
    errorCode: string,
    errorMessage: string,
  ) {
    return this.finish(
      userId,
      runId,
      "failed",
      { errorCode, errorMessage },
      "pending",
    );
  }

  loadMessages(userId: string, sessionId: string) {
    return this.store.loadMessages(userId, sessionId);
  }

  loadRecentHistory(userId: string, sessionId: string, limit = 20) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new RangeError("History limit must be a positive integer");
    }
    return this.store.loadContextMessages(userId, sessionId, limit);
  }

  private finish(
    userId: string,
    runId: string,
    status: Exclude<TerminalRunStatus, "completed">,
    input: FinishAgentRunInput & { errorCode?: string; errorMessage?: string },
    from: "pending" | "running" = "running",
  ) {
    return this.store.transaction(async (transaction) => {
      const running =
        from === "running" ? await transaction.lockRunningRun(userId, runId) : null;
      if (from === "running" && !running) return null;
      if (running) await persistArtifacts(transaction, running, input);
      const dataClasses = input.dataClasses
        ? normalizeDataClasses(input.dataClasses)
        : undefined;
      const run = await transaction.transitionRun({
        userId,
        runId,
        from,
        to: status,
        now: this.now(),
        usage: input.usage,
        toolCallCount: input.toolCalls?.length,
        dataClasses,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
      });
      if (!run) return null;

      const updated = await transaction.updateAssistant({
        messageId: run.assistantMessageId,
        sessionId: run.sessionId,
        expectedStatus: from === "pending" ? "pending" : "streaming",
        status,
        content: input.content,
        dataClasses,
      });
      if (!updated) {
        throw new AgentLifecycleError(
          "state_conflict",
          `The assistant message was not streaming when its run ${status}`,
        );
      }
      return run;
    });
  }
}

class DrizzleLifecycleTransaction implements AgentLifecycleTransaction {
  constructor(protected readonly database: DatabaseExecutor) {}

  async findRunByRequest(userId: string, clientRequestId: string) {
    const [run] = await this.database
      .select()
      .from(agentRuns)
      .where(
        and(
          eq(agentRuns.userId, userId),
          eq(agentRuns.clientRequestId, clientRequestId),
        ),
      )
      .limit(1);
    if (!run) return null;

    const messages = await this.database
      .select()
      .from(chatMessages)
      .where(inArray(chatMessages.id, [run.userMessageId, run.assistantMessageId]));
    const userMessage = messages.find((message) => message.id === run.userMessageId);
    const assistantMessage = messages.find(
      (message) => message.id === run.assistantMessageId,
    );
    if (!userMessage || !assistantMessage) {
      throw new AgentLifecycleError(
        "state_conflict",
        "The persisted run is missing one of its allocated messages",
      );
    }
    return { run, userMessage, assistantMessage };
  }

  async findOwnedSession(userId: string, sessionId: string) {
    const [session] = await this.database
      .select()
      .from(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
      .limit(1);
    return session ?? null;
  }

  async findOwnedRun(userId: string, runId: string) {
    const [run] = await this.database
      .select()
      .from(agentRuns)
      .where(and(eq(agentRuns.id, runId), eq(agentRuns.userId, userId)))
      .limit(1);
    return run ?? null;
  }

  async findActiveRun(userId: string, sessionId: string) {
    const [run] = await this.database
      .select()
      .from(agentRuns)
      .where(
        and(
          eq(agentRuns.userId, userId),
          eq(agentRuns.sessionId, sessionId),
          inArray(agentRuns.status, ["pending", "running"]),
        ),
      )
      .limit(1);
    return run ?? null;
  }

  async recoverStaleActiveRuns(input: RecoverStaleRunsInput) {
    const staleRuns = await this.database
      .select()
      .from(agentRuns)
      .where(
        and(
          eq(agentRuns.userId, input.userId),
          eq(agentRuns.sessionId, input.sessionId),
          inArray(agentRuns.status, ["pending", "running"]),
          lt(agentRuns.updatedAt, input.staleBefore),
        ),
      )
      .for("update");
    if (!staleRuns.length) return [];

    const staleRunIds = staleRuns.map((run) => run.id);
    const assistantMessageIds = staleRuns.map((run) => run.assistantMessageId);
    const recoveredRuns = await this.database
      .update(agentRuns)
      .set({
        status: "failed",
        startedAt: sql`coalesce(${agentRuns.startedAt}, ${input.now})`,
        finishedAt: input.now,
        updatedAt: input.now,
        errorCode: "stale_run_recovered",
        errorMessage: "The active agent run lease expired",
      })
      .where(
        and(
          inArray(agentRuns.id, staleRunIds),
          inArray(agentRuns.status, ["pending", "running"]),
          lt(agentRuns.updatedAt, input.staleBefore),
        ),
      )
      .returning();
    if (recoveredRuns.length !== staleRuns.length) {
      throw new AgentLifecycleError(
        "state_conflict",
        "A stale agent run changed while it was being recovered",
      );
    }

    const recoveredMessages = await this.database
      .update(chatMessages)
      .set({ status: "failed" })
      .where(
        and(
          inArray(chatMessages.id, assistantMessageIds),
          eq(chatMessages.sessionId, input.sessionId),
          eq(chatMessages.role, "assistant"),
        ),
      )
      .returning({ id: chatMessages.id });
    if (recoveredMessages.length !== staleRuns.length) {
      throw new AgentLifecycleError(
        "state_conflict",
        "A stale agent run is missing its assistant message",
      );
    }

    return recoveredRuns;
  }

  async lockRunningRun(userId: string, runId: string) {
    const [run] = await this.database
      .select()
      .from(agentRuns)
      .where(
        and(
          eq(agentRuns.id, runId),
          eq(agentRuns.userId, userId),
          eq(agentRuns.status, "running"),
        ),
      )
      .limit(1)
      .for("update");
    return run ?? null;
  }

  async insertMessages(input: CreateAgentRunInput) {
    const messages = await this.database
      .insert(chatMessages)
      .values([
        {
          sessionId: input.sessionId,
          role: "user" as const,
          content: input.message,
          status: "completed" as const,
          dataClasses: [...(input.dataClasses ?? ["public"])],
          clientRequestId: input.clientRequestId,
        },
        {
          sessionId: input.sessionId,
          role: "assistant" as const,
          content: "",
          model: input.model,
          status: "pending" as const,
          dataClasses: [...(input.dataClasses ?? ["public"])],
        },
      ])
      .returning();
    const userMessage = messages.find((message) => message.role === "user");
    const assistantMessage = messages.find((message) => message.role === "assistant");
    if (!userMessage || !assistantMessage) {
      throw new AgentLifecycleError(
        "state_conflict",
        "The run messages could not be allocated",
      );
    }
    return { userMessage, assistantMessage };
  }

  async insertRun(
    input: CreateAgentRunInput,
    messages: { userMessage: ChatMessage; assistantMessage: ChatMessage },
  ) {
    const [run] = await this.database
      .insert(agentRuns)
      .values({
        userId: input.userId,
        sessionId: input.sessionId,
        clientRequestId: input.clientRequestId,
        model: input.model,
        forceWeb: input.forceWeb ?? false,
        dataClasses: [...(input.dataClasses ?? ["public"])],
        userMessageId: messages.userMessage.id,
        assistantMessageId: messages.assistantMessage.id,
      })
      .returning();
    if (!run) throw new Error("Agent run insert did not return a row");
    return run;
  }

  async touchSession(userId: string, sessionId: string, now: Date) {
    const [session] = await this.database
      .update(chatSessions)
      .set({ updatedAt: now })
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
      .returning({ id: chatSessions.id });
    return Boolean(session);
  }

  async transitionRun(input: TransitionRunInput) {
    if (!canTransitionAgentRun(input.from, input.to)) {
      throw new TypeError(`Invalid agent run transition: ${input.from} -> ${input.to}`);
    }

    const terminal = input.to === "completed" || input.to === "cancelled" || input.to === "failed";
    const [run] = await this.database
      .update(agentRuns)
      .set({
        status: input.to,
        updatedAt: input.now,
        ...(input.to === "running" || input.from === "pending"
          ? { startedAt: input.now }
          : {}),
        ...(terminal ? { finishedAt: input.now } : {}),
        ...(input.usage !== undefined ? { usage: input.usage } : {}),
        ...(input.toolCallCount !== undefined
          ? { toolCallCount: input.toolCallCount }
          : {}),
        ...(input.dataClasses !== undefined
          ? { dataClasses: input.dataClasses }
          : {}),
        errorCode: input.to === "failed" ? input.errorCode : null,
        errorMessage: input.to === "failed" ? input.errorMessage : null,
      })
      .where(
        and(
          eq(agentRuns.id, input.runId),
          eq(agentRuns.userId, input.userId),
          eq(agentRuns.status, input.from),
        ),
      )
      .returning();
    return run ?? null;
  }

  async updateAssistant(input: UpdateAssistantInput) {
    const [message] = await this.database
      .update(chatMessages)
      .set({
        status: input.status,
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.dataClasses !== undefined
          ? { dataClasses: input.dataClasses }
          : {}),
      })
      .where(
        and(
          eq(chatMessages.id, input.messageId),
          eq(chatMessages.sessionId, input.sessionId),
          eq(chatMessages.role, "assistant"),
          eq(chatMessages.status, input.expectedStatus),
        ),
      )
      .returning({ id: chatMessages.id });
    return Boolean(message);
  }

  async insertToolCalls(runId: string, toolCalls: readonly AgentToolCallInput[]) {
    await this.database.insert(agentToolCalls).values(
      toolCalls.map((toolCall) => ({
        ...toolCall,
        runId,
        errorMessage: toolCall.errorMessage ?? null,
      })),
    );
  }

  async insertSources(runId: string, sources: readonly AgentSourceInput[]) {
    const insertedSources = await this.database
      .insert(agentSources)
      .values(
        sources.map((source) => ({
          runId,
          sourceKey: source.sourceKey,
          title: source.title,
          url: source.url,
          urlHash:
            source.urlHash ?? createHash("sha256").update(source.url).digest("hex"),
          publishedAt:
            typeof source.publishedAt === "string"
              ? new Date(source.publishedAt)
              : source.publishedAt,
          accessedAt:
            typeof source.accessedAt === "string"
              ? new Date(source.accessedAt)
              : source.accessedAt,
        })),
      )
      .returning({ id: agentSources.id, sourceKey: agentSources.sourceKey });

    return new Map(
      insertedSources.map((source) => [source.sourceKey, source.id]),
    );
  }

  async findSourceIdsByKeys(runId: string, sourceKeys: readonly string[]) {
    const sources = await this.database
      .select({ id: agentSources.id, sourceKey: agentSources.sourceKey })
      .from(agentSources)
      .where(
        and(
          eq(agentSources.runId, runId),
          inArray(agentSources.sourceKey, [...new Set(sourceKeys)]),
        ),
      );

    return new Map(sources.map((source) => [source.sourceKey, source.id]));
  }

  async insertCitations(
    run: AgentRun,
    citations: readonly ResolvedAgentCitationInput[],
  ) {
    await this.database.insert(agentCitations).values(
      citations.map((citation, ordinal) => ({
        runId: run.id,
        sourceId: citation.sourceId,
        messageId: run.assistantMessageId,
        ordinal,
        quote: citation.quote,
        supportStatus: citation.supportStatus ?? "supported",
      })),
    );
  }
}

class DrizzleLifecycleStore
  extends DrizzleLifecycleTransaction
  implements AgentLifecycleStore
{
  constructor(private readonly rootDatabase: Database) {
    super(rootDatabase);
  }

  transaction<T>(
    operation: (transaction: AgentLifecycleTransaction) => Promise<T>,
  ) {
    return this.rootDatabase.transaction((transaction) =>
      operation(new DrizzleLifecycleTransaction(transaction)),
    );
  }

  async loadMessages(userId: string, sessionId: string) {
    const session = await this.findOwnedSession(userId, sessionId);
    if (!session) return [];

    const messages = await this.rootDatabase
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id));
    return this.attachArtifacts(userId, sessionId, messages);
  }

  async loadContextMessages(userId: string, sessionId: string, limit: number) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new RangeError("History limit must be a positive integer");
    }
    const session = await this.findOwnedSession(userId, sessionId);
    if (!session) return [];

    const newest = await this.rootDatabase
      .select()
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.sessionId, sessionId),
          or(
            eq(chatMessages.role, "user"),
            and(
              eq(chatMessages.role, "assistant"),
              eq(chatMessages.status, "completed"),
              sql`length(btrim(${chatMessages.content})) > 0`,
            ),
          ),
        ),
      )
      .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
      .limit(limit);

    return this.attachArtifacts(userId, sessionId, [...newest].reverse());
  }

  private async attachArtifacts(
    userId: string,
    sessionId: string,
    chronological: ChatMessage[],
  ): Promise<PersistedAgentMessage[]> {
    if (!chronological.length) return [];

    const assistantIds = chronological
      .filter((message) => message.role === "assistant")
      .map((message) => message.id);
    if (!assistantIds.length) {
      return chronological.map((message) => ({
        ...message,
        run: null,
        sources: [],
        citations: [],
      }));
    }

    const runs = await this.rootDatabase
      .select()
      .from(agentRuns)
      .where(
        and(
          eq(agentRuns.userId, userId),
          eq(agentRuns.sessionId, sessionId),
          inArray(agentRuns.assistantMessageId, assistantIds),
        ),
      );
    const runIds = runs.map((run) => run.id);
    const [sources, citations] = runIds.length
      ? await Promise.all([
          this.rootDatabase
            .select()
            .from(agentSources)
            .where(inArray(agentSources.runId, runIds))
            .orderBy(asc(agentSources.createdAt), asc(agentSources.id)),
          this.rootDatabase
            .select()
            .from(agentCitations)
            .where(inArray(agentCitations.runId, runIds))
            .orderBy(asc(agentCitations.ordinal), asc(agentCitations.id)),
        ])
      : [[], []];
    const runByMessage = new Map(runs.map((run) => [run.assistantMessageId, run]));

    return chronological.map((message) => {
      const run = runByMessage.get(message.id) ?? null;
      return {
        ...message,
        run,
        sources: run ? sources.filter((source) => source.runId === run.id) : [],
        citations: run
          ? citations.filter((citation) => citation.runId === run.id)
          : [],
      };
    });
  }
}

export function createAgentLifecycleRepository(
  store: AgentLifecycleStore = new DrizzleLifecycleStore(getDb()),
  now?: () => Date,
  staleRunThresholdMs = Number(
    process.env.AGENT_RUN_STALE_THRESHOLD_MS ?? DEFAULT_STALE_RUN_THRESHOLD_MS,
  ),
) {
  return new AgentLifecycleRepository(store, now, staleRunThresholdMs);
}
