export type AgentMessageRole = "system" | "user" | "assistant";

export type AgentMessageItem = {
  type: "message";
  id: string;
  role: AgentMessageRole;
  text: string;
};

export type AgentToolCallItem = {
  type: "tool.call";
  id: string;
  name: string;
  arguments: unknown;
};

export type AgentToolResultItem = {
  type: "tool.result";
  callId: string;
  name: string;
  output: unknown;
  isError: boolean;
};

export type AgentModelItem =
  | AgentMessageItem
  | AgentToolCallItem
  | AgentToolResultItem;

export type AgentSource = {
  id: string;
  title: string;
  url: string;
  publishedAt: string | null;
  accessedAt: string;
};

export type AgentCitation = {
  sourceId: string;
  quote: string;
};
