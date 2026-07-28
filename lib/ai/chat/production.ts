import "server-only";

import { checkRateLimit, type RateLimitPolicy } from "@/lib/auth/rate-limit";

import { createAgentLifecycleRepository } from "../agent/lifecycle";
import { FptResponsesProvider } from "../fpt";
import { createTavilyClient } from "../tavily";
import { createWebResearchTools, type WebResearchState } from "../web";
import type { AgentRunRequest } from "../agent/schemas";
import { createChatDataStore, isPersistedChatRequest } from "./data";
import { createChatService, type ChatService } from "./service";

const CHAT_POLICY: RateLimitPolicy = {
  capacity: 12,
  refillTokens: 12,
  refillIntervalMs: 60_000,
};
const SEARCH_POLICY: RateLimitPolicy = {
  capacity: 6,
  refillTokens: 6,
  refillIntervalMs: 10 * 60_000,
};
const EXTRACT_POLICY: RateLimitPolicy = {
  capacity: 12,
  refillTokens: 12,
  refillIntervalMs: 10 * 60_000,
};

let service: ChatService | undefined;

async function requireWebLimit(
  scope: "search" | "extract",
  userId: string,
): Promise<void> {
  const result = await checkRateLimit(
    `ai:web-${scope}`,
    userId,
    scope === "search" ? SEARCH_POLICY : EXTRACT_POLICY,
  );
  if (!result.allowed) throw new Error(`Web ${scope} rate limit exceeded`);
}

export function getProductionChatService(): ChatService {
  if (service) return service;
  const apiKey = process.env.FPT_AI_API_KEY?.trim();
  if (!apiKey) throw new Error("FPT_AI_API_KEY is required");

  const tavilyKey = process.env.TAVILY_API_KEY?.trim();
  const tavily = tavilyKey ? createTavilyClient({ apiKey: tavilyKey }) : undefined;
  service = createChatService({
    lifecycle: createAgentLifecycleRepository(),
    data: createChatDataStore(),
    provider: new FptResponsesProvider({ apiKey }),
    createWebTools: tavily
      ? (state: WebResearchState) => {
          const tools = createWebResearchTools({
            tavily,
            state,
            beforeNetworkRequest: ({ scope, context }) =>
              requireWebLimit(scope, context.actor.id),
          });
          return [tools.searchWeb, tools.readPages];
        }
      : undefined,
  });
  return service;
}

export function checkChatRateLimit(userId: string) {
  return checkRateLimit("ai:chat", userId, CHAT_POLICY);
}

export function isChatRetry(userId: string, input: AgentRunRequest) {
  return isPersistedChatRequest(userId, input);
}
