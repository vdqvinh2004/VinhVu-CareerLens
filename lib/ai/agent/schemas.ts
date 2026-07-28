import { z } from "zod";

export const AGENT_SSE_VERSION = 1 as const;

const identifierSchema = z.string().trim().min(1).max(200);
const timestampSchema = z.iso.datetime({ offset: true });

const agentRunRequestShape = {
  clientRequestId: identifierSchema,
  sessionId: identifierSchema,
  message: z.string().trim().min(1).max(20_000),
  model: identifierSchema,
  forceWeb: z.boolean().default(false),
};

export const agentRunRequestSchema = z.strictObject(agentRunRequestShape);

export function createAgentRunRequestSchema(
  allowedModels: Iterable<string>,
) {
  const modelAllowList = new Set(allowedModels);

  return z.strictObject({
    ...agentRunRequestShape,
    model: identifierSchema.refine((model) => modelAllowList.has(model), {
      error: "Model is not configured",
    }),
  });
}

export const agentSourceSchema = z.strictObject({
  id: identifierSchema,
  title: z.string().trim().min(1).max(1_000),
  url: z.string().max(8_192).pipe(z.url({ protocol: /^https?$/ })),
  publishedAt: timestampSchema.nullable(),
  accessedAt: timestampSchema,
});

export const agentCitationSchema = z.strictObject({
  sourceId: identifierSchema,
  quote: z.string().min(1).max(10_000),
});

const eventBase = {
  version: z.literal(AGENT_SSE_VERSION),
  runId: identifierSchema,
};

export const runStartedEventSchema = z.strictObject({
  ...eventBase,
  type: z.literal("run.started"),
  userMessageId: identifierSchema,
  assistantMessageId: identifierSchema,
  startedAt: timestampSchema,
});

export const statusEventSchema = z.strictObject({
  ...eventBase,
  type: z.literal("status"),
  phase: z.enum(["thinking", "searching", "reading", "synthesizing"]),
  message: z.string().trim().min(1).max(500),
});

export const sourceAvailableEventSchema = z.strictObject({
  ...eventBase,
  type: z.literal("source.available"),
  source: agentSourceSchema,
});

export const textDeltaEventSchema = z.strictObject({
  ...eventBase,
  type: z.literal("text.delta"),
  messageId: identifierSchema,
  delta: z.string().min(1).max(100_000),
});

export const runCompletedEventSchema = z.strictObject({
  ...eventBase,
  type: z.literal("run.completed"),
  messageId: identifierSchema,
  completedAt: timestampSchema,
  citations: z.array(agentCitationSchema).max(500),
});

export const runCancelledEventSchema = z.strictObject({
  ...eventBase,
  type: z.literal("run.cancelled"),
  messageId: identifierSchema,
  cancelledAt: timestampSchema,
  reason: z.enum(["user", "disconnect", "timeout", "server"]),
});

export const errorEventSchema = z.strictObject({
  ...eventBase,
  type: z.literal("error"),
  code: z.string().trim().min(1).max(100),
  message: z.string().trim().min(1).max(1_000),
  retryable: z.boolean(),
  occurredAt: timestampSchema,
});

export const agentEventSchema = z.discriminatedUnion("type", [
  runStartedEventSchema,
  statusEventSchema,
  sourceAvailableEventSchema,
  textDeltaEventSchema,
  runCompletedEventSchema,
  runCancelledEventSchema,
  errorEventSchema,
]);

export type AgentRunRequest = z.infer<typeof agentRunRequestSchema>;
export type AgentEvent = z.infer<typeof agentEventSchema>;
export type RunStartedEvent = z.infer<typeof runStartedEventSchema>;
export type StatusEvent = z.infer<typeof statusEventSchema>;
export type SourceAvailableEvent = z.infer<typeof sourceAvailableEventSchema>;
export type TextDeltaEvent = z.infer<typeof textDeltaEventSchema>;
export type RunCompletedEvent = z.infer<typeof runCompletedEventSchema>;
export type RunCancelledEvent = z.infer<typeof runCancelledEventSchema>;
export type ErrorEvent = z.infer<typeof errorEventSchema>;
