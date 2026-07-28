import type { AgentToolDefinition } from "./tools";
import type {
  AgentMessageItem,
  AgentModelItem,
  AgentToolCallItem,
} from "./types";

export type ModelToolDefinition = Pick<
  AgentToolDefinition,
  "name" | "description" | "inputSchema"
>;

export type ModelToolChoice = "auto" | "none" | "required";

export type ModelProviderRequest = {
  model: string;
  input: readonly AgentModelItem[];
  tools?: readonly ModelToolDefinition[];
  toolChoice?: ModelToolChoice;
  maxOutputTokens?: number;
  signal: AbortSignal;
  timeoutMs: number;
};

export type ModelUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type ModelProviderResponse = {
  items: Array<AgentMessageItem | AgentToolCallItem>;
  usage: ModelUsage;
};

export type ModelProviderEvent =
  | {
      type: "text.delta";
      itemId: string;
      delta: string;
    }
  | {
      type: "tool.call";
      item: AgentToolCallItem;
    }
  | {
      type: "usage";
      usage: ModelUsage;
    };

export interface ModelProvider {
  generate(request: ModelProviderRequest): Promise<ModelProviderResponse>;
  stream(request: ModelProviderRequest): AsyncIterable<ModelProviderEvent>;
}
