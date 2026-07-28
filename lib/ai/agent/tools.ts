import type { z } from "zod";

import type { AgentSource } from "./types";

export const TOOL_DATA_CLASSES = [
  "public",
  "personal_data",
  "private_document",
] as const;

export type ToolDataClass = (typeof TOOL_DATA_CLASSES)[number];
export type ToolNetworkAccess = "none" | "public_web";
export type ToolSideEffect = "none" | "read" | "write";

export type ToolPolicyMetadata = {
  networkAccess: ToolNetworkAccess;
  sideEffect: ToolSideEffect;
  acceptsDataClasses: readonly ToolDataClass[];
  producesDataClass: ToolDataClass;
};

export type ToolExecutionBudget = {
  maxToolCalls: number;
  remainingToolCalls: number;
  maxNetworkCalls: number;
  remainingNetworkCalls: number;
  deadlineAt: number;
};

export type ToolActor = {
  type: "user" | "system";
  id: string;
};

export type ToolNetworkBudgetController = {
  consume(): void;
};

export type SourceRegistration = Omit<AgentSource, "id">;

export interface ToolSourceRegistry {
  get(sourceId: string): AgentSource | undefined;
  register(source: SourceRegistration, preferredId?: string): AgentSource;
}

export type ToolExecutionContext = {
  actor: ToolActor;
  runId: string;
  dataClasses: ReadonlySet<ToolDataClass>;
  budget: Readonly<ToolExecutionBudget>;
  networkBudget: Readonly<ToolNetworkBudgetController>;
  sources: ToolSourceRegistry;
  signal: AbortSignal;
  now: () => Date;
};

export type AgentToolDefinition<
  InputSchema extends z.ZodType = z.ZodType,
  Output = unknown,
> = {
  name: string;
  description: string;
  inputSchema: InputSchema;
  policy: ToolPolicyMetadata;
  execute: (
    input: z.output<InputSchema>,
    context: ToolExecutionContext,
  ) => Promise<Output>;
};

export type ToolPolicyDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: "data_classification_required";
    }
  | {
      allowed: false;
      reason: "data_class_not_accepted" | "sensitive_data_to_public_web";
      dataClass: ToolDataClass;
    };

export function evaluateToolPolicy(
  policy: ToolPolicyMetadata,
  dataClasses: Iterable<ToolDataClass>,
): ToolPolicyDecision {
  let hasDataClass = false;

  for (const dataClass of dataClasses) {
    hasDataClass = true;

    if (policy.networkAccess === "public_web" && dataClass !== "public") {
      return {
        allowed: false,
        reason: "sensitive_data_to_public_web",
        dataClass,
      };
    }

    if (!policy.acceptsDataClasses.includes(dataClass)) {
      return {
        allowed: false,
        reason: "data_class_not_accepted",
        dataClass,
      };
    }
  }

  if (!hasDataClass) {
    return { allowed: false, reason: "data_classification_required" };
  }

  return { allowed: true };
}
